import { useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { Check, ChevronsUpDown, Plus, Search } from 'lucide-react'
import { Dialog } from './ui/Dialog'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Field } from './ui/Field'
import { supabase } from '../lib/supabaseClient'
import { getClientFullName } from '../lib/format'
import type { Client } from '../types'

interface Props {
  clients: Client[]
  value: string
  onChange: (clientId: string) => void
  onClientCreated: (client: Client) => void
}

export function ClientPicker({ clients, value, onChange, onClientCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = useMemo(() => clients.find((c) => c.id === value), [clients, value])

  const handleAddClient = async () => {
    if (!firstName.trim() || !email.trim()) return
    setSaving(true)
    setError(null)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data, error: insertError } = await supabase
      .from('clients')
      .insert({
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        email,
        user_id: user?.id,
      })
      .select()
      .single()
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    onClientCreated(data as Client)
    onChange((data as Client).id)
    setAddOpen(false)
    setFirstName('')
    setLastName('')
    setEmail('')
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
      >
        {selected ? (
          <span className="text-left">
            <span className="font-medium text-slate-900">{getClientFullName(selected)}</span>
            <span className="ml-2 text-slate-400">{selected.email}</span>
          </span>
        ) : (
          <span className="text-slate-400">Select a client…</span>
        )}
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-popover">
            <Command className="flex flex-col" shouldFilter>
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <Command.Input
                  autoFocus
                  placeholder="Search clients..."
                  className="w-full text-sm outline-none placeholder:text-slate-400"
                />
              </div>
              <Command.List className="max-h-56 overflow-y-auto p-1">
                <Command.Empty className="px-3 py-4 text-center text-sm text-slate-500">
                  No clients found.
                </Command.Empty>
                {clients.map((client) => {
                  const fullName = getClientFullName(client)
                  return (
                    <Command.Item
                      key={client.id}
                      value={`${fullName} ${client.email}`}
                      onSelect={() => {
                        onChange(client.id)
                        setOpen(false)
                      }}
                      className="flex cursor-pointer items-center justify-between rounded-md px-3 py-2 text-sm data-[selected=true]:bg-slate-100"
                    >
                      <span>
                        <span className="font-medium text-slate-900">{fullName}</span>
                        <span className="ml-2 text-slate-400">{client.email}</span>
                      </span>
                      {client.id === value && <Check className="h-3.5 w-3.5 text-brand-600" />}
                    </Command.Item>
                  )
                })}
              </Command.List>
              <div className="border-t border-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    setAddOpen(true)
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add new client
                </button>
              </div>
            </Command>
          </div>
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add new client">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" htmlFor="new-client-first-name">
              <Input id="new-client-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last name" htmlFor="new-client-last-name">
              <Input id="new-client-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
          </div>
          <Field label="Email" htmlFor="new-client-email">
            <Input
              id="new-client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddClient} loading={saving}>
              Save client
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
