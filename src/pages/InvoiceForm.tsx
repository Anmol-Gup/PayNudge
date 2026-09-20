import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ClientPicker } from '../components/ClientPicker'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Input, Select, Textarea } from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Skeleton } from '../components/ui/Skeleton'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatDate, getClientFullName } from '../lib/format'
import { describeStepTiming } from '../lib/reminders'
import {
  PaymentMethodPicker,
  StripeLinkFields,
  UpiField,
  BankField,
  QrField,
  findUnconfiguredMethod,
  PAYMENT_METHODS,
} from '../components/PaymentMethodFields'
import type { Client, PaymentMethod, PaymentSettings, ReminderStep } from '../types'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP']

export function InvoiceForm() {
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [defaultSteps, setDefaultSteps] = useState<ReminderStep[]>([])

  const [enabledMethods, setEnabledMethods] = useState<PaymentMethod[]>([])
  const [paymentLinkUrl, setPaymentLinkUrl] = useState('')
  const [upiId, setUpiId] = useState('')
  const [bankDetails, setBankDetails] = useState('')
  const [qrPath, setQrPath] = useState<string | null>(null)
  const [uploadingQr, setUploadingQr] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .order('first_name')
      if (clientError) throw clientError
      setClients((clientData as Client[]) ?? [])

      const { data: settings } = await supabase.from('payment_settings').select('*').maybeSingle()
      const accountSettings = settings as PaymentSettings | null
      if (accountSettings) {
        setUpiId(accountSettings.upi_id ?? '')
        setBankDetails(accountSettings.bank_details ?? '')
        setQrPath(accountSettings.qr_code_path)
      }

      const { data: sequence } = await supabase
        .from('reminder_sequences')
        .select('id')
        .eq('is_default', true)
        .maybeSingle()
      if (sequence) {
        const { data: steps } = await supabase
          .from('reminder_steps')
          .select('*')
          .eq('sequence_id', sequence.id)
          .eq('enabled', true)
          .order('days_after_due')
          .order('step_order')
        setDefaultSteps((steps as ReminderStep[]) ?? [])
      }
    } catch {
      setLoadError('Something went wrong while loading this form.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleQrUpload = async (file: File) => {
    if (!user) return
    setUploadingQr(true)
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/invoice-${crypto.randomUUID()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('payment-qr-codes').upload(path, file)
    setUploadingQr(false)
    if (uploadError) {
      toast.error(uploadError.message)
      return
    }
    setQrPath(path)
    toast.success('QR code uploaded.')
  }

  const handleQrRemove = async () => {
    if (!qrPath) return
    const { error: removeError } = await supabase.storage.from('payment-qr-codes').remove([qrPath])
    if (removeError) {
      toast.error(removeError.message)
      return
    }
    setQrPath(null)
    toast.success('QR code removed.')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!clientId || !invoiceNumber.trim() || !amount || !dueDate) return
    const unconfigured = findUnconfiguredMethod(enabledMethods, {
      paymentLinkUrl,
      upiId,
      bankDetails,
      qrPath,
    })
    if (unconfigured) {
      const label = PAYMENT_METHODS.find((m) => m.value === unconfigured)?.label ?? unconfigured
      setError(
        unconfigured === 'bank'
          ? 'Fill in account holder name, bank name, account number, and IFSC/SWIFT code.'
          : `Add the details for ${label} before saving, or remove it as a payment method.`
      )
      return
    }
    setSaving(true)
    setError(null)

    const { data: invoice, error: insertError } = await supabase
      .from('invoices')
      .insert({
        user_id: user?.id,
        client_id: clientId,
        invoice_number: invoiceNumber.trim(),
        description,
        amount: Number(amount),
        currency,
        due_date: dueDate,
        status: 'draft',
        payment_method: enabledMethods[0] ?? null,
        enabled_methods: enabledMethods.length > 0 ? enabledMethods : null,
        stripe_payment_link_url: enabledMethods.includes('stripe') ? paymentLinkUrl.trim() || null : null,
        upi_id: enabledMethods.includes('upi') ? upiId.trim() || null : null,
        bank_details: enabledMethods.includes('bank') ? bankDetails.trim() || null : null,
        qr_code_path: enabledMethods.includes('qr') ? qrPath : null,
      })
      .select()
      .single()

    setSaving(false)
    if (insertError || !invoice) {
      if (insertError?.code === '23505') {
        setError(`You already have an invoice numbered "${invoiceNumber.trim()}". Use a different number.`)
      } else {
        setError(insertError?.message ?? 'Could not create invoice.')
      }
      return
    }

    toast.success('Invoice created successfully.')
    navigate(`/invoices/${invoice.id}`)
  }

  const selectedClient = clients.find((c) => c.id === clientId)

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to invoices
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">New invoice</h1>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : loadError ? (
        <ErrorBanner message={loadError} onRetry={load} />
      ) : (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="Invoice details" description="Basic information about this invoice." />
              <CardContent className="space-y-4">
                <Field label="Client" required>
                  <ClientPicker
                    clients={clients}
                    value={clientId}
                    onChange={setClientId}
                    onClientCreated={(c) => setClients((prev) => [...prev, c])}
                  />
                </Field>

                <Field
                  label="Invoice number"
                  htmlFor="invoice-number"
                  required
                  hint="Match the number on the invoice you already sent this client."
                >
                  <Input
                    id="invoice-number"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="INV-1042"
                  />
                </Field>

                <Field label="Description" htmlFor="description">
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Amount" htmlFor="amount" required>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </Field>
                  <Field label="Currency" htmlFor="currency">
                    <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field label="Due date" htmlFor="due-date" required>
                  <Input
                    id="due-date"
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </Field>
              </CardContent>
            </Card>

            <Card className="border-brand-200 ring-1 ring-brand-100">
              <CardHeader
                title="How will this invoice get paid?"
                description="Select as many methods as you want to show in reminder emails for this invoice."
              />
              <CardContent className="space-y-4">
                <PaymentMethodPicker value={enabledMethods} onChange={setEnabledMethods} />

                {enabledMethods.includes('stripe') && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-3 text-sm font-semibold text-slate-900">Stripe</p>
                    <StripeLinkFields url={paymentLinkUrl} onUrlChange={setPaymentLinkUrl} />
                  </div>
                )}
                {enabledMethods.includes('upi') && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-3 text-sm font-semibold text-slate-900">UPI</p>
                    <UpiField value={upiId} onChange={setUpiId} />
                  </div>
                )}
                {enabledMethods.includes('bank') && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-3 text-sm font-semibold text-slate-900">Bank transfer</p>
                    <BankField value={bankDetails} onChange={setBankDetails} />
                  </div>
                )}
                {enabledMethods.includes('qr') && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="mb-3 text-sm font-semibold text-slate-900">QR code</p>
                    <QrField
                      path={qrPath}
                      uploading={uploadingQr}
                      onUpload={handleQrUpload}
                      onRemove={handleQrRemove}
                    />
                  </div>
                )}

                <p className="text-xs text-slate-500">
                  {enabledMethods.includes('bank')
                    ? 'Bank details are required once that method is selected.'
                    : 'You can leave these blank and add them later from the invoice page.'}{' '}
                  <Link to="/payment-settings" className="font-medium text-brand-600 hover:underline">
                    Manage your account defaults
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>

            {error && <p className="text-sm text-danger-600">{error}</p>}

            <Button type="submit" disabled={saving || !clientId || !invoiceNumber.trim()} loading={saving}>
              Create invoice
            </Button>
          </div>

          <div className="lg:col-span-1">
            <Card className="lg:sticky lg:top-10">
              <CardHeader title="Invoice summary" description="A quick look before you create it." />
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Client</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-900">
                    {selectedClient ? getClientFullName(selectedClient) : 'No client selected'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Amount</p>
                  <p className="mt-0.5 text-lg font-semibold text-slate-900">
                    {amount ? formatCurrency(Number(amount), currency) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Due date</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-900">
                    {dueDate ? formatDate(dueDate) : '—'}
                  </p>
                </div>

                {defaultSteps.length > 0 && (
                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Reminder sequence
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {defaultSteps.map((step) => (
                        <li key={step.id} className="flex items-center gap-2 text-sm text-slate-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                          {describeStepTiming(step)} — <span className="capitalize">{step.tone}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </form>
      )}
    </div>
  )
}
