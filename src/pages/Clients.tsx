import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Users, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { SkeletonTable } from '../components/ui/Skeleton'
import { Pagination } from '../components/ui/Pagination'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabaseClient'
import { formatCurrency, formatShortDate, getClientFullName } from '../lib/format'
import type { Client, Invoice } from '../types'

const PAGE_SIZE = 10

export function Clients() {
  const toast = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)
  // Draft/sent/overdue/partially_paid invoices are deleted along with the
  // client (they're the only statuses the reminder sweep still processes,
  // so they're the only ones that could try emailing a client that no
  // longer exists). Paid/void invoices are terminal and kept as history,
  // just unlinked from the deleted client — mirrors the DB trigger in
  // migration 0016.
  const { deleteCount, keepCount } = useMemo(() => {
    if (!deleteTarget) return { deleteCount: 0, keepCount: 0 }
    const clientInvoices = invoices.filter((i) => i.client_id === deleteTarget.id)
    const deleteCount = clientInvoices.filter((i) =>
      ['draft', 'sent', 'overdue', 'partially_paid'].includes(i.status)
    ).length
    return { deleteCount, keepCount: clientInvoices.length - deleteCount }
  }, [deleteTarget, invoices])
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [emailLocked, setEmailLocked] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [{ data: clientData, error: clientError }, { data: invoiceData }] = await Promise.all([
        supabase.from('clients').select('*').order('first_name'),
        supabase.from('invoices').select('*'),
      ])
      if (clientError) {
        setError('Something went wrong while loading your clients.')
        return
      }
      setClients((clientData as Client[]) ?? [])
      setInvoices((invoiceData as Invoice[]) ?? [])
    } catch {
      setError('Something went wrong while loading your clients.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const stats = useMemo(() => {
    const map = new Map<string, { active: number; outstanding: number; lastActivity: string | null }>()
    for (const invoice of invoices) {
      if (!invoice.client_id) continue
      const entry = map.get(invoice.client_id) ?? { active: 0, outstanding: 0, lastActivity: null }
      if (invoice.status === 'sent' || invoice.status === 'overdue') {
        entry.active += 1
        entry.outstanding += Number(invoice.amount)
      }
      if (!entry.lastActivity || invoice.created_at > entry.lastActivity) {
        entry.lastActivity = invoice.created_at
      }
      map.set(invoice.client_id, entry)
    }
    return map
  }, [invoices])

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients
    const q = search.trim().toLowerCase()
    return clients.filter(
      (c) => getClientFullName(c).toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    )
  }, [clients, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  const pageCount = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE))
  const paginatedClients = useMemo(
    () => filteredClients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredClients, page]
  )

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [pageCount, page])

  const openAddDialog = () => {
    setEditing(null)
    setFirstName('')
    setLastName('')
    setEmail('')
    setFormError(null)
    setEmailLocked(false)
    setDialogOpen(true)
  }

  const openEditDialog = async (client: Client) => {
    setEditing(client)
    setFirstName(client.first_name)
    setLastName(client.last_name ?? '')
    setEmail(client.email)
    setFormError(null)
    setEmailLocked(false)
    setDialogOpen(true)

    const clientInvoiceIds = invoices.filter((i) => i.client_id === client.id).map((i) => i.id)
    if (clientInvoiceIds.length === 0) return

    const { count } = await supabase
      .from('reminder_log')
      .select('id', { count: 'exact', head: true })
      .in('invoice_id', clientInvoiceIds)
    setEmailLocked((count ?? 0) > 0)
  }

  const handleSubmit = async () => {
    if (!firstName.trim() || !email.trim()) return
    setSaving(true)
    setFormError(null)

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim() || null,
      email: editing && emailLocked ? editing.email : email,
    }

    if (editing) {
      const { error: updateError } = await supabase.from('clients').update(payload).eq('id', editing.id)
      setSaving(false)
      if (updateError) {
        setFormError(updateError.message)
        return
      }
      toast.success('Client updated successfully.')
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const { error: insertError } = await supabase
        .from('clients')
        .insert({ ...payload, user_id: user?.id })
      setSaving(false)
      if (insertError) {
        setFormError(insertError.message)
        return
      }
      toast.success('Client created successfully.')
    }

    setDialogOpen(false)
    load()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error: deleteError } = await supabase.from('clients').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    toast.success('Client deleted.')
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">Manage the people and businesses you invoice.</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4" />
          Add client
        </Button>
      </div>

      {error && <ErrorBanner message={error} onRetry={load} />}

      {loading ? (
        <SkeletonTable />
      ) : clients.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={Users}
              title="Add your first client"
              description="Keep your clients organized so adding invoices takes seconds."
              action={<Button onClick={openAddDialog}>Add client</Button>}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Clients</h2>
            <div className="relative min-w-[180px] flex-1 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search clients..."
                className="w-full rounded-md border border-slate-300 py-1.5 pl-8 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          {filteredClients.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No matching clients" description="Try a different search." />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-5 py-2.5">Client</th>
                      <th className="px-5 py-2.5">Email</th>
                      <th className="px-5 py-2.5">Active invoices</th>
                      <th className="px-5 py-2.5">Outstanding</th>
                      <th className="px-5 py-2.5">Last activity</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedClients.map((client) => {
                      const s = stats.get(client.id)
                      const fullName = getClientFullName(client)
                      return (
                        <tr key={client.id}>
                          <td className="px-5 py-3.5 font-medium text-slate-900">{fullName}</td>
                          <td className="px-5 py-3.5 text-slate-500">{client.email}</td>
                          <td className="px-5 py-3.5 text-slate-500">{s?.active ?? 0}</td>
                          <td className="px-5 py-3.5 text-slate-500">
                            {formatCurrency(s?.outstanding ?? 0, 'INR')}
                          </td>
                          <td className="px-5 py-3.5 text-slate-500">
                            {s?.lastActivity ? formatShortDate(s.lastActivity) : '—'}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => openEditDialog(client)}
                                aria-label={`Edit ${fullName}`}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(client)}
                                aria-label={`Delete ${fullName}`}
                                className="rounded-md p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageCount={pageCount}
                totalItems={filteredClients.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={editing ? 'Edit client' : 'Add client'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="client-first-name" required>
              <Input id="client-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last name" htmlFor="client-last-name">
              <Input id="client-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </div>
          <Field
            label="Email"
            htmlFor="client-email"
            required
            hint={
              emailLocked
                ? "A reminder has already been sent to this address. It can't be changed, so past and future reminders for this client stay consistent."
                : undefined
            }
          >
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={emailLocked}
            />
          </Field>
          {formError && <p className="text-sm text-danger-600">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? 'Save changes' : 'Add client'}
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget ? getClientFullName(deleteTarget) : ''}?`}
        description={
          [
            "This can't be undone.",
            deleteCount > 0
              ? `${deleteCount} unresolved invoice${deleteCount === 1 ? '' : 's'} for this client — and their reminder history — will be permanently deleted too.`
              : null,
            keepCount > 0
              ? `${keepCount} paid/void invoice${keepCount === 1 ? '' : 's'} will be kept for your records, no longer linked to a client.`
              : null,
          ]
            .filter(Boolean)
            .join(' ')
        }
        confirmLabel="Delete client"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
