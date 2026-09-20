import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  Send,
  CircleCheck,
  Ban,
  Pencil,
} from 'lucide-react'
import { StatusBadge } from '../components/StatusBadge'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Dialog } from '../components/ui/Dialog'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { EmptyState } from '../components/ui/EmptyState'
import { Field } from '../components/ui/Field'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabaseClient'
import { formatCurrency, formatDate, formatRelativeDue, getClientFullName } from '../lib/format'
import { reminderDate } from '../lib/reminders'
import {
  PaymentMethodPicker,
  PAYMENT_METHODS,
  StripeLinkFields,
  UpiField,
  BankField,
  QrField,
  bankDetailsRows,
  findUnconfiguredMethod,
  withInvoiceReference,
} from '../components/PaymentMethodFields'
import type {
  Invoice,
  InvoicePayment,
  PaymentMethod,
  PaymentSettings,
  ReminderLog,
  ReminderStep,
} from '../types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

// Mirrors the `skipped` reasons the send-reminders edge function can return
// for a manual send, so the toast explains why nothing went out instead of
// implying success.
const SKIP_REASON_MESSAGES: Record<string, string> = {
  reminders_paused: 'Reminders are paused for this invoice — resume them first.',
  no_sequence: 'No reminder sequence is set up yet.',
  no_steps: 'This reminder sequence has no active steps.',
  sequence_complete: 'Every reminder in the sequence has already been sent.',
  not_due_yet: 'This reminder is not due yet.',
}

function resolvePayment(invoice: Invoice, settings: PaymentSettings | null) {
  return {
    methods: invoice.enabled_methods ?? settings?.enabled_methods ?? [],
    upiId: invoice.upi_id ?? settings?.upi_id ?? null,
    bankDetails: invoice.bank_details ?? settings?.bank_details ?? null,
    qrPath: invoice.qr_code_path ?? settings?.qr_code_path ?? null,
  }
}

type ConfirmAction = 'void' | 'send-reminder' | null

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const toast = useToast()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [logs, setLogs] = useState<ReminderLog[]>([])
  const [upcomingSteps, setUpcomingSteps] = useState<ReminderStep[]>([])
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null)
  const [payments, setPayments] = useState<InvoicePayment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [sendingNow, setSendingNow] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [editingPayment, setEditingPayment] = useState(false)
  const [draftMethods, setDraftMethods] = useState<PaymentMethod[]>([])
  const [draftLinkUrl, setDraftLinkUrl] = useState('')
  const [draftUpiId, setDraftUpiId] = useState('')
  const [draftBankDetails, setDraftBankDetails] = useState('')
  const [draftQrPath, setDraftQrPath] = useState<string | null>(null)
  const [uploadingQr, setUploadingQr] = useState(false)
  const [savingPayment, setSavingPayment] = useState(false)
  const [recordDialogOpen, setRecordDialogOpen] = useState(false)
  const [recordAmount, setRecordAmount] = useState('')
  const [recordMethod, setRecordMethod] = useState<PaymentMethod>('stripe')
  const [recordNote, setRecordNote] = useState('')
  const [recordLoading, setRecordLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError(null)

    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, client:clients(*)')
      .eq('id', id)
      .single()

    if (invoiceError || !invoiceData) {
      setLoadError('Something went wrong while loading this invoice.')
      setLoading(false)
      return
    }
    setInvoice(invoiceData as Invoice)

    const { data: settingsData } = await supabase.from('payment_settings').select('*').maybeSingle()
    setPaymentSettings(settingsData as PaymentSettings | null)

    const { data: paymentsData } = await supabase
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', id)
      .order('paid_at', { ascending: false })
    setPayments((paymentsData as InvoicePayment[]) ?? [])

    // The reminder timeline is supplementary — if it fails to load, the
    // invoice itself (already fetched) should still be shown.
    try {
      const { data: logData } = await supabase
        .from('reminder_log')
        .select('*, reminder_step:reminder_steps(*)')
        .eq('invoice_id', id)
        .order('sent_at', { ascending: false })
      const sentLogs = (logData as ReminderLog[]) ?? []
      setLogs(sentLogs)

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
        const sentStepIds = new Set(sentLogs.map((l) => l.reminder_step_id))
        setUpcomingSteps(((stepData as ReminderStep[]) ?? []).filter((s) => !sentStepIds.has(s.id)))
      }
    } catch (err) {
      console.error('Failed to load reminder timeline:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const openRecordDialog = () => {
    if (!invoice) return
    setRecordAmount(remaining.toFixed(2))
    setRecordMethod(effectivePayment.methods[0] ?? 'stripe')
    setRecordNote('')
    setRecordDialogOpen(true)
  }

  const submitRecordPayment = async () => {
    if (!invoice) return
    const amount = Number(recordAmount)
    if (!amount || amount <= 0) return
    setRecordLoading(true)

    const { error: insertError } = await supabase.from('invoice_payments').insert({
      invoice_id: invoice.id,
      user_id: invoice.user_id,
      amount,
      currency: invoice.currency,
      method: recordMethod,
      note: recordNote.trim() || null,
    })

    if (insertError) {
      setRecordLoading(false)
      toast.error(insertError.message)
      return
    }

    const newTotal = totalReceived + amount
    const fullyPaid = newTotal >= Number(invoice.amount) - 0.01

    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: fullyPaid ? 'paid' : 'partially_paid',
        paid_at: fullyPaid ? new Date().toISOString() : null,
      })
      .eq('id', invoice.id)

    setRecordLoading(false)
    if (updateError) {
      toast.error(updateError.message)
      return
    }
    setRecordDialogOpen(false)
    toast.success(fullyPaid ? 'Invoice marked as paid.' : 'Payment recorded.')
    load()
  }

  const voidInvoice = async () => {
    if (!invoice) return
    setActionLoading(true)
    setActionError(null)
    const { error } = await supabase.from('invoices').update({ status: 'void' }).eq('id', invoice.id)
    setActionLoading(false)
    setConfirmAction(null)
    if (error) {
      setActionError(error.message)
    } else {
      toast.success('Invoice voided.')
      load()
    }
  }

  const toggleReminders = async () => {
    if (!invoice) return
    setActionError(null)
    const { error } = await supabase
      .from('invoices')
      .update({ reminders_paused: !invoice.reminders_paused })
      .eq('id', invoice.id)
    if (error) {
      setActionError(error.message)
    } else {
      toast.success(invoice.reminders_paused ? 'Reminders resumed.' : 'Reminders paused.')
      load()
    }
  }

  const markAsSent = async () => {
    if (!invoice) return
    setActionError(null)
    const { error } = await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoice.id)
    if (error) {
      setActionError(error.message)
    } else {
      toast.success('Invoice marked as sent.')
      load()
    }
  }

  const sendReminderNow = async () => {
    if (!invoice) return
    setSendingNow(true)
    setActionLoading(true)
    setActionError(null)
    const { data, error } = await supabase.functions.invoke('send-reminders', {
      body: { invoice_id: invoice.id },
    })
    setSendingNow(false)
    setActionLoading(false)
    setConfirmAction(null)
    if (error) {
      setActionError(error.message)
      return
    }
    const result = data?.results?.[0]
    if (result?.sent) {
      toast.success('Reminder sent successfully.')
    } else {
      toast.error(SKIP_REASON_MESSAGES[result?.skipped as string] ?? 'No reminder was sent.')
    }
    load()
  }

  const openPaymentEditor = () => {
    if (!invoice) return
    const effective = resolvePayment(invoice, paymentSettings)
    setDraftMethods(effective.methods)
    setDraftLinkUrl(invoice.stripe_payment_link_url ?? '')
    setDraftUpiId(effective.upiId ?? '')
    setDraftBankDetails(effective.bankDetails ?? '')
    setDraftQrPath(effective.qrPath)
    setEditingPayment(true)
  }

  const handleQrUpload = async (file: File) => {
    if (!invoice) return
    setUploadingQr(true)
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${invoice.user_id}/invoice-${invoice.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('payment-qr-codes')
      .upload(path, file, { upsert: true })
    setUploadingQr(false)
    if (uploadError) {
      toast.error(uploadError.message)
      return
    }
    setDraftQrPath(path)
    toast.success('QR code uploaded.')
  }

  const handleQrRemove = async () => {
    if (!draftQrPath) return
    const { error: removeError } = await supabase.storage.from('payment-qr-codes').remove([draftQrPath])
    if (removeError) {
      toast.error(removeError.message)
      return
    }
    setDraftQrPath(null)
    toast.success('QR code removed.')
  }

  const savePayment = async () => {
    if (!invoice) return
    const unconfigured = findUnconfiguredMethod(draftMethods, {
      paymentLinkUrl: draftLinkUrl,
      upiId: draftUpiId,
      bankDetails: draftBankDetails,
      qrPath: draftQrPath,
    })
    if (unconfigured) {
      const label = PAYMENT_METHODS.find((m) => m.value === unconfigured)?.label ?? unconfigured
      toast.error(
        unconfigured === 'bank'
          ? 'Fill in account holder name, bank name, account number, and IFSC/SWIFT code.'
          : `Add the details for ${label} before saving, or remove it as a payment method.`
      )
      return
    }
    setSavingPayment(true)
    const { error } = await supabase
      .from('invoices')
      .update({
        payment_method: draftMethods[0] ?? null,
        enabled_methods: draftMethods.length > 0 ? draftMethods : null,
        stripe_payment_link_url: draftMethods.includes('stripe') ? draftLinkUrl.trim() || null : null,
        upi_id: draftMethods.includes('upi') ? draftUpiId.trim() || null : null,
        bank_details: draftMethods.includes('bank') ? draftBankDetails.trim() || null : null,
        qr_code_path: draftMethods.includes('qr') ? draftQrPath : null,
      })
      .eq('id', invoice.id)
    setSavingPayment(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setEditingPayment(false)
    toast.success('Payment method saved.')
    load()
  }

  const copyLink = async () => {
    if (!invoice?.stripe_payment_link_url) return
    try {
      await navigator.clipboard.writeText(withInvoiceReference(invoice.stripe_payment_link_url, invoice.id))
      toast.success('Payment link copied.')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    )
  }

  if (loadError || !invoice) {
    return <ErrorBanner message={loadError ?? 'Invoice not found.'} onRetry={load} />
  }

  const canRemind =
    invoice.status === 'sent' || invoice.status === 'overdue' || invoice.status === 'partially_paid'
  // Once every enabled step in the sequence has already been sent, pausing
  // or resuming has nothing left to affect — showing those controls would
  // imply a future reminder that doesn't exist.
  const sequenceComplete = logs.length > 0 && upcomingSteps.length === 0
  const effectivePayment = resolvePayment(invoice, paymentSettings)
  const totalReceived = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const remaining = Math.max(Number(invoice.amount) - totalReceived, 0)

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
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">
              Invoice {invoice.invoice_number}
            </p>
            <h1 className="mt-0.5 text-xl font-semibold text-slate-900">
              {invoice.client ? getClientFullName(invoice.client) : 'Unknown client'}
            </h1>
            <p className="text-sm text-slate-500">{invoice.client?.email}</p>
          </div>
          <StatusBadge status={invoice.status} />
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-2">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-slate-900">
              {formatCurrency(invoice.amount, invoice.currency)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Due {formatDate(invoice.due_date)} ·{' '}
              <span className={invoice.status === 'overdue' ? 'font-medium text-warning-600' : ''}>
                {formatRelativeDue(invoice.due_date, invoice.status, invoice.paid_at)}
              </span>
            </p>
          </div>
        </div>

        {invoice.status === 'partially_paid' && (
          <p className="mt-3 text-sm text-purple-700">
            {formatCurrency(totalReceived, invoice.currency)} received ·{' '}
            <span className="font-medium">{formatCurrency(remaining, invoice.currency)} remaining</span>
          </p>
        )}

        {invoice.description && <p className="mt-4 text-sm text-slate-600">{invoice.description}</p>}

        {invoice.status === 'draft' && (
          <p className="mt-4 text-sm text-slate-500">
            This invoice is still a draft. Reminders won't be sent until you mark it as sent — do this
            once your client actually has the invoice (however you deliver it).
          </p>
        )}

        {canRemind && sequenceComplete && (
          <p className="mt-4 text-sm text-slate-500">
            Every reminder in the sequence has already been sent for this invoice — there's nothing left
            to pause or send again.
          </p>
        )}

        {actionError && (
          <div className="mt-4">
            <ErrorBanner message={actionError} />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-5">
          {invoice.status === 'draft' && (
            <Button onClick={markAsSent}>
              <Send className="h-3.5 w-3.5" />
              Mark as Sent
            </Button>
          )}
          {invoice.status !== 'paid' && invoice.status !== 'void' && (
            <Button variant="secondary" onClick={openRecordDialog}>
              <CircleCheck className="h-3.5 w-3.5" />
              Record payment
            </Button>
          )}
          {canRemind && !sequenceComplete && (
            <>
              <Button variant="secondary" onClick={toggleReminders}>
                {invoice.reminders_paused ? (
                  <PlayCircle className="h-3.5 w-3.5" />
                ) : (
                  <PauseCircle className="h-3.5 w-3.5" />
                )}
                {invoice.reminders_paused ? 'Resume reminders' : 'Pause reminders'}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmAction('send-reminder')} loading={sendingNow}>
                <Send className="h-3.5 w-3.5" />
                Send reminder
              </Button>
            </>
          )}
          {invoice.status !== 'paid' && invoice.status !== 'void' && (
            <Button variant="ghost" onClick={() => setConfirmAction('void')} className="ml-auto text-danger-600">
              <Ban className="h-3.5 w-3.5" />
              Void
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Payment"
          description="This is what your client sees in reminder emails."
          action={
            !editingPayment && (
              <Button variant="ghost" size="sm" onClick={openPaymentEditor}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )
          }
        />
        <CardContent>
          {editingPayment ? (
            <div className="space-y-4">
              <PaymentMethodPicker value={draftMethods} onChange={setDraftMethods} />
              {draftMethods.includes('stripe') && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-900">Stripe</p>
                  <StripeLinkFields url={draftLinkUrl} onUrlChange={setDraftLinkUrl} />
                </div>
              )}
              {draftMethods.includes('upi') && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-900">UPI</p>
                  <UpiField value={draftUpiId} onChange={setDraftUpiId} />
                </div>
              )}
              {draftMethods.includes('bank') && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-900">Bank transfer</p>
                  <BankField value={draftBankDetails} onChange={setDraftBankDetails} />
                </div>
              )}
              {draftMethods.includes('qr') && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="mb-3 text-sm font-semibold text-slate-900">QR code</p>
                  <QrField
                    path={draftQrPath}
                    uploading={uploadingQr}
                    onUpload={handleQrUpload}
                    onRemove={handleQrRemove}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={savePayment} loading={savingPayment}>
                  Save
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setEditingPayment(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : effectivePayment.methods.length === 0 ? (
            <p className="text-sm text-slate-500">No payment method set for this invoice.</p>
          ) : (
            <div className="space-y-4">
              {effectivePayment.methods.map((method) => (
                <div
                  key={method}
                  className="first:mt-0 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-slate-100 [&:not(:first-child)]:pt-4"
                >
                  {effectivePayment.methods.length > 1 && (
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method}
                    </p>
                  )}

                  {method === 'stripe' &&
                    (invoice.stripe_payment_link_url ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="flex-1 truncate rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                          {withInvoiceReference(invoice.stripe_payment_link_url, invoice.id)}
                        </code>
                        <Button variant="secondary" size="sm" onClick={copyLink}>
                          <Copy className="h-3.5 w-3.5" />
                          Copy link
                        </Button>
                        <a
                          href={withInvoiceReference(invoice.stripe_payment_link_url, invoice.id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button variant="secondary" size="sm">
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open payment page
                          </Button>
                        </a>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No payment link added yet.</p>
                    ))}

                  {method === 'upi' &&
                    (effectivePayment.upiId ? (
                      <div className="flex items-center gap-2">
                        <code className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
                          {effectivePayment.upiId}
                        </code>
                        <span className="text-sm text-slate-500">Client pays you directly via UPI.</span>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">UPI is selected but no UPI ID is set yet.</p>
                    ))}

                  {method === 'bank' &&
                    (effectivePayment.bankDetails ? (
                      <dl className="space-y-1.5">
                        {bankDetailsRows(effectivePayment.bankDetails).map((row) => (
                          <div key={row.label} className="flex gap-2 text-sm">
                            <dt className="w-36 shrink-0 text-slate-500">{row.label}</dt>
                            <dd className="text-slate-900">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Bank transfer is selected but no details are set yet.
                      </p>
                    ))}

                  {method === 'qr' &&
                    (effectivePayment.qrPath ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={`${SUPABASE_URL}/storage/v1/object/public/payment-qr-codes/${effectivePayment.qrPath}`}
                          alt="Payment QR code"
                          className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                        />
                        <span className="text-sm text-slate-500">Client scans this code to pay.</span>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">QR code is selected but none is uploaded yet.</p>
                    ))}
                </div>
              ))}
            </div>
          )}

          {!editingPayment && effectivePayment.methods.some((m) => m !== 'stripe') && (
            <p className="mt-3 text-xs text-slate-400">
              UPI, bank transfer, and QR have no automatic status sync — mark the invoice as paid
              yourself once you receive it.
            </p>
          )}
        </CardContent>
      </Card>

      {payments.length > 0 && (
        <Card>
          <CardHeader title="Payment history" />
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {formatCurrency(payment.amount, payment.currency)}{' '}
                      <span className="font-normal capitalize text-slate-500">via {payment.method}</span>
                    </p>
                    {payment.note && <p className="mt-0.5 text-sm text-slate-500">{payment.note}</p>}
                  </div>
                  <p className="shrink-0 text-sm text-slate-400">{formatDate(payment.paid_at)}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader title="Reminder timeline" />
        <CardContent>
          {logs.length === 0 && upcomingSteps.length === 0 ? (
            <EmptyState title="No reminders have been sent yet." />
          ) : (
            <ol className="space-y-4">
              {logs.map((log) => (
                <li key={log.id} className="flex gap-3">
                  <span className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDate(log.sent_at)} — <span className="capitalize">{log.reminder_step?.tone}</span>{' '}
                      reminder sent
                    </p>
                    {(log.rendered_subject ?? log.reminder_step?.subject_template) && (
                      <p className="mt-0.5 text-sm text-slate-500">
                        "{log.rendered_subject ?? log.reminder_step?.subject_template}"
                      </p>
                    )}
                  </div>
                </li>
              ))}
              {invoice.status !== 'paid' &&
                invoice.status !== 'void' &&
                upcomingSteps.map((step) => (
                  <li key={step.id} className="flex gap-3">
                    <span className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full border-2 border-slate-300 bg-white" />
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        {formatDate(reminderDate(invoice.due_date, step))} —{' '}
                        <span className="capitalize">{step.tone}</span> reminder scheduled
                      </p>
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
        title="Record a payment"
        description={`Remaining balance: ${formatCurrency(remaining, invoice.currency)}`}
      >
        <div className="space-y-4">
          <Field label="Amount received" htmlFor="record-amount" required>
            <Input
              id="record-amount"
              type="number"
              step="0.01"
              min="0"
              value={recordAmount}
              onChange={(e) => setRecordAmount(e.target.value)}
            />
          </Field>
          <Field label="Received via" htmlFor="record-method">
            <Select
              id="record-method"
              value={recordMethod}
              onChange={(e) => setRecordMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note" htmlFor="record-note" hint="Optional — e.g. how it was received.">
            <Textarea
              id="record-note"
              rows={2}
              value={recordNote}
              onChange={(e) => setRecordNote(e.target.value)}
            />
          </Field>
          {Number(recordAmount) > 0 && Number(recordAmount) < remaining && (
            <p className="text-xs text-slate-500">
              This is less than the full remaining balance — the invoice will be marked "Partially
              paid" and reminders will keep going for the leftover amount.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRecordDialogOpen(false)} disabled={recordLoading}>
              Cancel
            </Button>
            <Button
              onClick={submitRecordPayment}
              loading={recordLoading}
              disabled={!recordAmount || Number(recordAmount) <= 0}
            >
              Record payment
            </Button>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirmAction === 'void'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Void this invoice?"
        description="Voided invoices stop receiving reminders and are excluded from your active invoice count."
        confirmLabel="Void invoice"
        tone="danger"
        loading={actionLoading}
        onConfirm={voidInvoice}
      />
      <ConfirmDialog
        open={confirmAction === 'send-reminder'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Send a reminder now?"
        description="This immediately emails the client the next reminder in the sequence, regardless of schedule."
        confirmLabel="Send reminder"
        loading={actionLoading}
        onConfirm={sendReminderNow}
      />
    </div>
  )
}
