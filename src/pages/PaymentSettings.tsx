import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { PasswordInput } from '../components/ui/PasswordInput'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
  PaymentMethodPicker,
  UpiField,
  BankField,
  QrField,
  isBankDetailsValid,
} from '../components/PaymentMethodFields'
import type { PaymentMethod, PaymentSettings as PaymentSettingsType } from '../types'

export function PaymentSettings() {
  const { user } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [enabledMethods, setEnabledMethods] = useState<PaymentMethod[]>([])
  const [webhookSecret, setWebhookSecret] = useState('')
  const [upiId, setUpiId] = useState('')
  const [bankDetails, setBankDetails] = useState('')
  const [qrPath, setQrPath] = useState<string | null>(null)
  const [uploadingQr, setUploadingQr] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('payment_settings')
        .select('*')
        .maybeSingle()
      if (fetchError) throw fetchError
      const settings = data as PaymentSettingsType | null
      if (settings) {
        setEnabledMethods(settings.enabled_methods ?? [])
        setWebhookSecret(settings.stripe_webhook_secret ?? '')
        setUpiId(settings.upi_id ?? '')
        setBankDetails(settings.bank_details ?? '')
        setQrPath(settings.qr_code_path)
      }
    } catch {
      setError('Something went wrong while loading your payment settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const webhookUrl = user ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-webhook?uid=${user.id}` : ''

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl)
      toast.success('Webhook URL copied.')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  const handleQrUpload = async (file: File) => {
    if (!user) return
    setUploadingQr(true)
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/qr-code.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('payment-qr-codes')
      .upload(path, file, { upsert: true })
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

  const handleSave = async () => {
    if (!user) return
    if (enabledMethods.length === 0) {
      toast.error('Select at least one payment method.')
      return
    }
    if (enabledMethods.includes('bank') && !isBankDetailsValid(bankDetails)) {
      toast.error('Fill in account holder name, bank name, account number, and IFSC/SWIFT code.')
      return
    }
    setSaving(true)
    const payload = {
      user_id: user.id,
      method: enabledMethods[0] ?? null,
      enabled_methods: enabledMethods,
      stripe_webhook_secret: webhookSecret.trim() || null,
      upi_id: upiId.trim() || null,
      bank_details: bankDetails.trim() || null,
      qr_code_path: qrPath,
    }
    const { error: saveError } = await supabase
      .from('payment_settings')
      .upsert(payload, { onConflict: 'user_id' })
    setSaving(false)
    if (saveError) {
      toast.error(saveError.message)
      return
    }
    toast.success('Payment settings saved.')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={load} />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Payment</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose your default ways to get paid. Every invoice starts with these unless you override
          them for that invoice specifically.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Default payment methods"
          description="Pick as many as you like — every enabled method shows up in reminder emails."
        />
        <CardContent className="space-y-6">
          <PaymentMethodPicker value={enabledMethods} onChange={setEnabledMethods} />

          {enabledMethods.includes('stripe') && (
            <div className="space-y-5 border-t border-slate-100 pt-5">
              <p className="text-sm font-semibold text-slate-900">Stripe</p>
              <p className="text-sm text-slate-500">
                Use your own Stripe account so client payments land directly with you — PayNudge never
                touches the money and never needs any Stripe API key from you.
              </p>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Step 1 · Create a payment link
                </p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-slate-600">
                  <li>
                    Go to{' '}
                    <a
                      href="https://dashboard.stripe.com/payment-links"
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-brand-600 hover:underline"
                    >
                      Stripe Dashboard → Payment Links
                    </a>{' '}
                    and create a link for the invoice amount.
                  </li>
                  <li>
                    Copy the link's URL and paste it into the invoice when you create it in PayNudge
                    (or add it later from the invoice page).
                  </li>
                  <li>
                    Reusing the same link across several invoices (e.g. one product, many clients) is
                    fine — PayNudge tags each invoice's copy of the link so payment status still
                    tracks back to the right invoice, not every invoice sharing that link.
                  </li>
                </ol>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  Step 2 · Connect the webhook (one-time setup)
                </p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-slate-600">
                  <li>
                    Go to Stripe Dashboard → Developers → Webhooks →{' '}
                    <a
                      href="https://dashboard.stripe.com/webhooks"
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-brand-600 hover:underline"
                    >
                      Add endpoint
                    </a>
                    .
                  </li>
                  <li>Paste this as the endpoint URL:</li>
                </ol>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
                    {webhookUrl}
                  </code>
                  <Button variant="secondary" size="sm" onClick={copyWebhookUrl}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <ol start={3} className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-slate-600">
                  <li>
                    Under "Select events", choose{' '}
                    <code className="rounded bg-slate-100 px-1 py-0.5">checkout.session.completed</code>.
                  </li>
                  <li>
                    Click "Add endpoint". Stripe will show a <strong>Signing secret</strong> (starts
                    with <code>whsec_</code>) — copy it and paste it below.
                  </li>
                </ol>
                <Field
                  label="Webhook signing secret"
                  htmlFor="webhook-secret"
                  hint="Starts with whsec_..."
                  className="mt-3"
                >
                  <PasswordInput
                    id="webhook-secret"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="whsec_..."
                  />
                </Field>
              </div>

              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-medium text-slate-700">Why both steps matter</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4">
                  <li>Step 1 is what your client actually clicks to pay — without it, the reminder email has no way to pay.</li>
                  <li>Step 2 is how PayNudge finds out the moment a client pays. Skip it and you'll need to mark every invoice paid by hand.</li>
                  <li>The signing secret proves the "payment succeeded" notification really came from Stripe, not someone else pretending it did.</li>
                </ul>
              </div>
            </div>
          )}

          {enabledMethods.includes('upi') && (
            <div className="border-t border-slate-100 pt-5">
              <p className="mb-3 text-sm font-semibold text-slate-900">UPI</p>
              <UpiField value={upiId} onChange={setUpiId} />
            </div>
          )}

          {enabledMethods.includes('bank') && (
            <div className="border-t border-slate-100 pt-5">
              <p className="mb-3 text-sm font-semibold text-slate-900">Bank transfer</p>
              <BankField value={bankDetails} onChange={setBankDetails} />
            </div>
          )}

          {enabledMethods.includes('qr') && (
            <div className="border-t border-slate-100 pt-5">
              <QrField
                path={qrPath}
                uploading={uploadingQr}
                onUpload={handleQrUpload}
                onRemove={handleQrRemove}
              />
            </div>
          )}

          <div className="border-t border-slate-100 pt-5">
            <Button onClick={handleSave} loading={saving}>
              Save payment settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
