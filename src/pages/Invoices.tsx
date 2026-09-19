import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, CheckCircle2, ChevronDown, AlertTriangle, PartyPopper } from 'lucide-react'
import { Button, ButtonLink } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { StatusBadge } from '../components/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { SkeletonTable } from '../components/ui/Skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/DropdownMenu'
import { Pagination } from '../components/ui/Pagination'
import { supabase } from '../lib/supabaseClient'
import { formatCurrency, formatRelativeDue, formatShortDate, getClientFullName } from '../lib/format'
import { describeNextReminder } from '../lib/reminders'
import type { Invoice, InvoiceStatus, ReminderStep } from '../types'

const STATUS_FILTERS: { label: string; value: InvoiceStatus | 'all' }[] = [
  { label: 'All statuses', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Partially paid', value: 'partially_paid' },
  { label: 'Paid', value: 'paid' },
  { label: 'Void', value: 'void' },
]

const PAGE_SIZE = 10

type SortKey = 'due_date' | 'amount' | 'status'
const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: 'Due date', value: 'due_date' },
  { label: 'Amount', value: 'amount' },
  { label: 'Status', value: 'status' },
]

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [reminderSteps, setReminderSteps] = useState<ReminderStep[]>([])
  const [sentByInvoice, setSentByInvoice] = useState<Map<string, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('due_date')
  const [page, setPage] = useState(1)

  const load = async () => {
    setLoading(true)
    setError(null)

    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, client:clients(*)')
      .order('due_date', { ascending: true })

    if (invoiceError) {
      setError('Something went wrong while loading your invoices.')
      setLoading(false)
      return
    }

    const invoicesList = (invoiceData as Invoice[]) ?? []
    setInvoices(invoicesList)

    // The next-reminder column is supplementary — if it fails to load, the
    // rest of the page (which already has its invoices) should not hang.
    try {
      const { data: sequence } = await supabase
        .from('reminder_sequences')
        .select('id')
        .eq('is_default', true)
        .maybeSingle()

      if (sequence) {
        const { data: stepData } = await supabase
          .from('reminder_steps')
          .select('*')
          .eq('sequence_id', sequence.id)
          .eq('enabled', true)
          .order('days_after_due')
          .order('step_order')
        setReminderSteps((stepData as ReminderStep[]) ?? [])
      }

      const invoiceIds = invoicesList.map((i) => i.id)
      if (invoiceIds.length > 0) {
        const { data: logData } = await supabase
          .from('reminder_log')
          .select('invoice_id, reminder_step_id')
          .in('invoice_id', invoiceIds)

        const map = new Map<string, Set<string>>()
        for (const row of logData ?? []) {
          const set = map.get(row.invoice_id) ?? new Set<string>()
          set.add(row.reminder_step_id)
          map.set(row.invoice_id, set)
        }
        setSentByInvoice(map)
      }
    } catch (err) {
      console.error('Failed to load reminder schedule:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const overdueCount = useMemo(
    () => invoices.filter((i) => i.status === 'overdue').length,
    [invoices]
  )

  const filtered = useMemo(() => {
    let list = invoices
    if (statusFilter !== 'all') list = list.filter((i) => i.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (i) =>
          (i.client ? getClientFullName(i.client).toLowerCase() : '').includes(q) ||
          i.invoice_number.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      if (sortKey === 'amount') return Number(b.amount) - Number(a.amount)
      if (sortKey === 'status') return a.status.localeCompare(b.status)
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })
  }, [invoices, statusFilter, search, sortKey])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, search, sortKey])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )

  const nextReminderLabel = (invoice: Invoice): string => {
    if (invoice.status === 'paid' || invoice.status === 'void') return '—'
    if (invoice.reminders_paused) return 'Paused'
    if (invoice.status === 'draft') return 'Not sent yet'
    const sent = sentByInvoice.get(invoice.id) ?? new Set<string>()
    return describeNextReminder(invoice.due_date, reminderSteps, sent)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonTable />
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
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Invoices</h1>
          <p className="mt-1 text-sm text-slate-500">Every invoice you've created, in one place.</p>
        </div>
        <ButtonLink to="/invoices/new">
          <Plus className="h-4 w-4" />
          New invoice
        </ButtonLink>
      </div>

      {overdueCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning-100 bg-warning-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">Needs attention</p>
              <p className="text-sm text-slate-600">
                {overdueCount} invoice{overdueCount === 1 ? ' is' : 's are'} overdue
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setStatusFilter('overdue')}>
            View overdue invoices
          </Button>
        </div>
      ) : invoices.length > 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-success-100 bg-success-50/60 px-5 py-4">
          <PartyPopper className="h-5 w-5 shrink-0 text-success-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900">You're all caught up</p>
            <p className="text-sm text-slate-600">No overdue invoices right now.</p>
          </div>
        </div>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex flex-1 flex-wrap items-center gap-2 sm:flex-none sm:justify-end">
            <div className="relative min-w-[180px] flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoices..."
                className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                  {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {STATUS_FILTERS.map((f) => (
                  <DropdownMenuItem
                    key={f.value}
                    selected={statusFilter === f.value}
                    onSelect={() => setStatusFilter(f.value)}
                  >
                    {f.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                  Sort: {SORT_OPTIONS.find((s) => s.value === sortKey)?.label}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {SORT_OPTIONS.map((s) => (
                  <DropdownMenuItem key={s.value} selected={sortKey === s.value} onSelect={() => setSortKey(s.value)}>
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={CheckCircle2}
              title="No invoices yet"
              description="Add your first invoice and let PayNudge handle the follow-ups."
              action={<ButtonLink to="/invoices/new">Add invoice</ButtonLink>}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No matching invoices" description="Try a different search or filter." />
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-5 py-2.5">Client</th>
                    <th className="px-5 py-2.5">Invoice</th>
                    <th className="px-5 py-2.5">Amount</th>
                    <th className="px-5 py-2.5">Due date</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5">Reminder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((invoice) => (
                    <tr key={invoice.id} className="group">
                      <td className="p-0">
                        <Link
                          to={`/invoices/${invoice.id}`}
                          className="block px-5 py-3.5 font-medium text-slate-900 group-hover:text-brand-700"
                        >
                          {invoice.client ? getClientFullName(invoice.client) : 'Unknown client'}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {invoice.invoice_number}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {formatShortDate(invoice.due_date)}
                        <span
                          className={`ml-2 text-xs ${
                            invoice.status === 'overdue' ? 'text-warning-600' : 'text-slate-400'
                          }`}
                        >
                          {formatRelativeDue(invoice.due_date, invoice.status, invoice.paid_at)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">{nextReminderLabel(invoice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {paginated.map((invoice) => (
                <Link
                  key={invoice.id}
                  to={`/invoices/${invoice.id}`}
                  className="block px-4 py-4 active:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">
                      {invoice.client ? getClientFullName(invoice.client) : 'Unknown client'}
                    </span>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-slate-500">
                    <span>{formatCurrency(invoice.amount, invoice.currency)}</span>
                    <span>{formatRelativeDue(invoice.due_date, invoice.status, invoice.paid_at)}</span>
                  </div>
                </Link>
              ))}
            </div>

            <Pagination
              page={page}
              pageCount={pageCount}
              totalItems={filtered.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  )
}
