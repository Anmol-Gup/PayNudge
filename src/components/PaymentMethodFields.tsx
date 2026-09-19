import { useRef, type MouseEvent, type ReactNode } from 'react'
import * as RadixDropdown from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, Info, Landmark, QrCode, Smartphone, X, CreditCard as CardIcon } from 'lucide-react'
import { Button } from './ui/Button'
import { Field } from './ui/Field'
import { Input, Textarea } from './ui/Input'
import { cn } from '../lib/cn'
import type { PaymentMethod } from '../types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: typeof CardIcon }[] = [
  { value: 'stripe', label: 'Stripe', icon: CardIcon },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'bank', label: 'Bank transfer', icon: Landmark },
  { value: 'qr', label: 'QR code', icon: QrCode },
]

// Multi-select dropdown: any number of methods can be enabled at once (e.g.
// show a Stripe button AND a UPI ID AND bank details in the same reminder
// email) instead of the invoice being locked to a single payment method.
// Selected methods show as removable chips in the closed trigger; opening
// it reveals a checkbox per method.
export function PaymentMethodPicker({
  value,
  onChange,
}: {
  value: PaymentMethod[]
  onChange: (methods: PaymentMethod[]) => void
}) {
  const toggle = (method: PaymentMethod) => {
    onChange(value.includes(method) ? value.filter((m) => m !== method) : [...value, method])
  }

  const remove = (method: PaymentMethod, e: MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter((m) => m !== method))
  }

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          className="flex min-h-[38px] w-full flex-wrap items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          {value.length === 0 ? (
            <span className="text-slate-400">Select payment methods…</span>
          ) : (
            value.map((method) => {
              const meta = PAYMENT_METHODS.find((m) => m.value === method)
              return (
                <span
                  key={method}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-brand-700"
                >
                  {meta?.label ?? method}
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => remove(method, e)}
                    aria-label={`Remove ${meta?.label ?? method}`}
                    className="rounded-full p-0.5 hover:bg-brand-100"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </span>
              )
            })
          )}
          <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[220px] rounded-lg border border-slate-200 bg-white p-1 shadow-popover focus:outline-none"
        >
          {PAYMENT_METHODS.map((m) => {
            const checked = value.includes(m.value)
            return (
              <RadixDropdown.CheckboxItem
                key={m.value}
                checked={checked}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={() => toggle(m.value)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    checked ? 'border-brand-600 bg-brand-600' : 'border-slate-300'
                  )}
                >
                  {checked && <Check className="h-3 w-3 text-white" />}
                </span>
                <m.icon className="h-3.5 w-3.5 text-slate-500" />
                {m.label}
              </RadixDropdown.CheckboxItem>
            )
          })}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  )
}

export function NoSyncNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{children}</p>
    </div>
  )
}

export function UpiField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <Field label="UPI ID" htmlFor="upi-id" hint="e.g. yourname@okhdfcbank">
        <Input id="upi-id" value={value} onChange={(e) => onChange(e.target.value)} />
      </Field>
      <NoSyncNote>
        UPI has no automatic status sync — you'll mark the invoice as paid yourself once you receive
        the payment.
      </NoSyncNote>
    </div>
  )
}

export interface BankDetailsFields {
  accountName: string
  bankName: string
  accountNumber: string
  ifscSwift: string
  notes: string
}

const EMPTY_BANK_DETAILS: BankDetailsFields = {
  accountName: '',
  bankName: '',
  accountNumber: '',
  ifscSwift: '',
  notes: '',
}

// Bank details are stored as JSON inside the existing bank_details text
// column (no migration needed). Anything saved before this change was a
// single freeform string — treated as "notes" here so it isn't lost.
export function parseBankDetails(raw: string | null): BankDetailsFields {
  if (!raw) return { ...EMPTY_BANK_DETAILS }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'accountName' in parsed) {
      return { ...EMPTY_BANK_DETAILS, ...parsed }
    }
  } catch {
    // Not JSON — legacy freeform text.
  }
  return { ...EMPTY_BANK_DETAILS, notes: raw }
}

export function serializeBankDetails(fields: BankDetailsFields): string | null {
  const hasAny = Object.values(fields).some((v) => v.trim())
  return hasAny ? JSON.stringify(fields) : null
}

// IFSC: 4-letter bank code + literal '0' + 6-character branch code (11
// chars total, e.g. HDFC0001234). SWIFT/BIC: 6 letters + 2 alphanumeric
// (+ optional 3 alphanumeric branch), 8 or 11 chars, e.g. HDFCINBB.
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/
const SWIFT_PATTERN = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/

export function isIfscOrSwift(value: string): boolean {
  return IFSC_PATTERN.test(value) || SWIFT_PATTERN.test(value)
}

// Every bank field is required except the freeform "Other instructions" —
// half-filled bank details (e.g. an account number with no bank name) are
// useless to a client trying to pay.
export function isBankDetailsValid(raw: string | null): boolean {
  const f = parseBankDetails(raw)
  return Boolean(
    f.accountName.trim() &&
      f.bankName.trim() &&
      f.accountNumber.trim().length >= 6 &&
      f.accountNumber.trim().length <= 18 &&
      f.ifscSwift.trim() &&
      isIfscOrSwift(f.ifscSwift.trim())
  )
}

export function bankDetailsRows(raw: string | null): { label: string; value: string }[] {
  const f = parseBankDetails(raw)
  const rows: { label: string; value: string }[] = []
  if (f.accountName) rows.push({ label: 'Account name', value: f.accountName })
  if (f.bankName) rows.push({ label: 'Bank', value: f.bankName })
  if (f.accountNumber) rows.push({ label: 'Account number', value: f.accountNumber })
  if (f.ifscSwift) rows.push({ label: 'IFSC / SWIFT', value: f.ifscSwift })
  if (f.notes) rows.push({ label: 'Notes', value: f.notes })
  return rows
}

export function BankField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const fields = parseBankDetails(value)
  const update = (patch: Partial<BankDetailsFields>) => {
    onChange(serializeBankDetails({ ...fields, ...patch }) ?? '')
  }

  const accountNumberError =
    fields.accountNumber && (fields.accountNumber.length < 6 || fields.accountNumber.length > 18)
      ? 'Account number should be 6–18 digits.'
      : null

  const ifscSwiftError =
    fields.ifscSwift && !isIfscOrSwift(fields.ifscSwift)
      ? 'Enter a valid IFSC (e.g. HDFC0001234) or SWIFT/BIC code (e.g. HDFCINBB).'
      : null

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Account holder name" htmlFor="bank-account-name" required>
          <Input
            id="bank-account-name"
            required
            value={fields.accountName}
            onChange={(e) => update({ accountName: e.target.value })}
          />
        </Field>
        <Field label="Bank name" htmlFor="bank-name" required>
          <Input
            id="bank-name"
            required
            value={fields.bankName}
            onChange={(e) => update({ bankName: e.target.value })}
          />
        </Field>
        <Field label="Account number" htmlFor="bank-account-number" required error={accountNumberError}>
          <Input
            id="bank-account-number"
            required
            inputMode="numeric"
            value={fields.accountNumber}
            onChange={(e) => update({ accountNumber: e.target.value.replace(/\D/g, '').slice(0, 18) })}
          />
        </Field>
        <Field label="IFSC / SWIFT code" htmlFor="bank-ifsc-swift" required error={ifscSwiftError}>
          <Input
            id="bank-ifsc-swift"
            required
            value={fields.ifscSwift}
            onChange={(e) =>
              update({ ifscSwift: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11) })
            }
          />
        </Field>
      </div>
      <Field
        label="Other instructions"
        htmlFor="bank-notes"
        hint="Optional — branch, routing number, anything else your client needs."
        className="mt-4"
      >
        <Textarea id="bank-notes" rows={2} value={fields.notes} onChange={(e) => update({ notes: e.target.value })} />
      </Field>
      <NoSyncNote>
        Bank transfers have no automatic status sync — you'll mark the invoice as paid yourself.
      </NoSyncNote>
    </div>
  )
}

export function QrField({
  path,
  uploading,
  onUpload,
  onRemove,
}: {
  path: string | null
  uploading: boolean
  onUpload: (file: File) => void
  onRemove?: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <p className="text-sm font-medium text-slate-700">QR code</p>
      <p className="mt-0.5 text-sm text-slate-500">Upload a payment QR code (e.g. your UPI QR).</p>
      <div className="mt-3 flex items-center gap-4">
        {path && (
          <img
            src={`${SUPABASE_URL}/storage/v1/object/public/payment-qr-codes/${path}`}
            alt="Payment QR code"
            className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {path ? 'Replace image' : 'Upload image'}
        </Button>
        {path && onRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-danger-600">
            Remove
          </Button>
        )}
      </div>
      <NoSyncNote>No automatic status sync — you'll mark the invoice as paid yourself.</NoSyncNote>
    </div>
  )
}

export function StripeLinkFields({
  url,
  onUrlChange,
}: {
  url: string
  onUrlChange: (value: string) => void
}) {
  return (
    <div>
      <Field label="Payment link URL" htmlFor="payment-link-url" hint="e.g. https://buy.stripe.com/...">
        <Input
          id="payment-link-url"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://buy.stripe.com/..."
        />
      </Field>
      <NoSyncNote>
        Make sure this link is set to the exact amount above — PayNudge can't check that
        automatically. If Stripe reports a different amount actually paid, we'll flag it on the
        invoice once payment comes in.
      </NoSyncNote>
    </div>
  )
}

// Attaches a per-invoice client_reference_id to the raw Payment Link the
// user pasted in. Stripe echoes this back on the checkout.session.completed
// webhook, which is how a single reused Payment Link (same product, many
// invoices) still gets matched to the exact invoice that got paid — instead
// of every invoice sharing that link being marked paid at once.
export function withInvoiceReference(url: string, invoiceId: string): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('client_reference_id', invoiceId)
    return parsed.toString()
  } catch {
    return url
  }
}
