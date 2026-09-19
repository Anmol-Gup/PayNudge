import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, AlertTriangle, Wallet, Clock, CircleDollarSign, ArrowRight } from 'lucide-react'
import { ButtonLink } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Skeleton, SkeletonCards } from '../components/ui/Skeleton'
import { supabase } from '../lib/supabaseClient'
import { formatCurrency, formatShortDate, getClientFullName } from '../lib/format'
import { useAuth } from '../context/AuthContext'
import type { Client, Invoice } from '../types'

const RECENT_LIMIT = 6

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 22) return 'Good evening'
  return 'Good night'
}

export function Dashboard() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [recentClients, setRecentClients] = useState<Client[]>([])
  const [receivedByInvoice, setReceivedByInvoice] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const load = async () => {
    setLoading(true)
    setError(null)

    const [{ data: invoiceData, error: invoiceError }, { data: clientData }] = await Promise.all([
      supabase.from('invoices').select('*, client:clients(*)').order('due_date', { ascending: true }),
      supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(RECENT_LIMIT),
    ])

    if (invoiceError) {
      setError('Something went wrong while loading your invoices.')
      setLoading(false)
      return
    }

    const invoicesList = (invoiceData as Invoice[]) ?? []
    setInvoices(invoicesList)
    setRecentClients((clientData as Client[]) ?? [])

    try {
      const invoiceIds = invoicesList.map((i) => i.id)
      if (invoiceIds.length > 0) {
        const { data: paymentsData } = await supabase
          .from('invoice_payments')
          .select('invoice_id, amount')
          .in('invoice_id', invoiceIds)

        const receivedMap = new Map<string, number>()
        for (const row of paymentsData ?? []) {
          receivedMap.set(row.invoice_id, (receivedMap.get(row.invoice_id) ?? 0) + Number(row.amount))
        }
        setReceivedByInvoice(receivedMap)
      }
    } catch (err) {
      console.error('Failed to load payment totals for dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const remainingFor = (invoice: Invoice) =>
    invoice.status === 'partially_paid'
      ? Math.max(Number(invoice.amount) - (receivedByInvoice.get(invoice.id) ?? 0), 0)
      : Number(invoice.amount)

  const metrics = useMemo(() => {
    const active = invoices.filter(
      (i) => i.status === 'sent' || i.status === 'overdue' || i.status === 'partially_paid'
    )
    const outstanding = active.reduce((sum, i) => sum + remainingFor(i), 0)

    const overdueInvoices = invoices.filter((i) => i.status === 'overdue')
    const overdueAmount = overdueInvoices.reduce((sum, i) => sum + Number(i.amount), 0)

    const now = new Date()
    const weekFromNow = new Date()
    weekFromNow.setDate(now.getDate() + 7)
    const dueSoonInvoices = active.filter((i) => {
      const due = new Date(i.due_date)
      return due >= now && due <= weekFromNow
    })
    const dueSoonAmount = dueSoonInvoices.reduce((sum, i) => sum + Number(i.amount), 0)

    const paidThisMonth = invoices.filter((i) => {
      if (i.status !== 'paid' || !i.paid_at) return false
      const paidDate = new Date(i.paid_at)
      return paidDate.getMonth() === now.getMonth() && paidDate.getFullYear() === now.getFullYear()
    })
    const paidAmount = paidThisMonth.reduce((sum, i) => sum + Number(i.amount), 0)

    return {
      outstanding,
      outstandingCount: active.length,
      overdueAmount,
      overdueCount: overdueInvoices.length,
      dueSoonAmount,
      dueSoonCount: dueSoonInvoices.length,
      paidAmount,
      paidCount: paidThisMonth.length,
    }
  }, [invoices, receivedByInvoice])

  const recentInvoices = useMemo(
    () =>
      [...invoices]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, RECENT_LIMIT),
    [invoices]
  )

  const currency = invoices[0]?.currency ?? 'INR'
  const firstName = user?.user_metadata?.first_name || user?.email?.split('@')[0] || 'there'

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <SkeletonCards />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={load} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {greetingForHour(now.getHours())}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Here's what's happening with your invoices.</p>
        </div>
        <ButtonLink to="/invoices/new">
          <Plus className="h-4 w-4" />
          New invoice
        </ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          icon={Wallet}
          label="Outstanding"
          value={formatCurrency(metrics.outstanding, currency)}
          hint={`${metrics.outstandingCount} active invoice${metrics.outstandingCount === 1 ? '' : 's'}`}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Overdue"
          value={formatCurrency(metrics.overdueAmount, currency)}
          hint={
            metrics.overdueCount > 0
              ? `${metrics.overdueCount} invoice${metrics.overdueCount === 1 ? '' : 's'} need attention`
              : 'Nothing overdue'
          }
          tone={metrics.overdueCount > 0 ? 'warning' : 'default'}
        />
        <MetricCard
          icon={Clock}
          label="Due soon"
          value={formatCurrency(metrics.dueSoonAmount, currency)}
          hint={`${metrics.dueSoonCount} due this week`}
        />
        <MetricCard
          icon={CircleDollarSign}
          label="Paid this month"
          value={formatCurrency(metrics.paidAmount, currency)}
          hint={`${metrics.paidCount} invoice${metrics.paidCount === 1 ? '' : 's'} paid`}
          tone="success"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent invoices</h2>
            <Link
              to="/invoices"
              className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {invoices.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No invoices yet"
                description="Add your first invoice and let PayNudge handle the follow-ups."
                action={<ButtonLink to="/invoices/new">Add invoice</ButtonLink>}
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentInvoices.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    to={`/invoices/${invoice.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {invoice.client ? getClientFullName(invoice.client) : 'Unknown client'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {invoice.invoice_number} · Due {formatShortDate(invoice.due_date)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium text-slate-900">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </span>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Recent clients</h2>
            <Link
              to="/clients"
              className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recentClients.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No clients yet"
                description="Add a client to start sending invoices."
                action={<ButtonLink to="/clients">Add client</ButtonLink>}
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentClients.map((client) => (
                <li key={client.id}>
                  <Link
                    to="/clients"
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {getClientFullName(client)}
                      </p>
                      <p className="truncate text-xs text-slate-500">{client.email}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatShortDate(client.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: typeof Wallet
  label: string
  value: string
  hint: string
  tone?: 'default' | 'warning' | 'success'
}) {
  const toneClasses =
    tone === 'warning'
      ? 'bg-warning-50 text-warning-600'
      : tone === 'success'
        ? 'bg-success-50 text-success-600'
        : 'bg-brand-50 text-brand-600'

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${toneClasses}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </Card>
  )
}
