// Supabase Edge Function: send-reminders
// Scheduled to run once daily (Supabase Cron) with no body, sweeping every
// overdue invoice. Can also be invoked manually with { invoice_id } from the
// "Send reminder now" button, which sends the next step immediately
// regardless of its day offset.

import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const FROM_EMAIL = Deno.env.get('REMINDER_FROM_EMAIL') ?? 'reminders@example.com'
const CRON_SECRET = Deno.env.get('CRON_SECRET')

// Browsers enforce CORS on fetch/invoke calls from the app (the manual
// "Send reminder now" button); the scheduled cron sweep hits this function
// server-to-server and never triggers a preflight, so this only matters for
// the manual path but must be present on every response either way.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const transporter = nodemailer.createTransport({
  host: Deno.env.get('SMTP_HOST')!,
  port: Number(Deno.env.get('SMTP_PORT') ?? '587'),
  secure: Deno.env.get('SMTP_SECURE') === 'true',
  auth: {
    user: Deno.env.get('SMTP_USER')!,
    pass: Deno.env.get('SMTP_PASSWORD')!,
  },
})

// Two invoices can legitimately share the same Payment Link (same product,
// different clients), so the link a client actually receives is tagged with
// this invoice's own id — stripe-webhook matches on it instead of the link
// itself, so paying one invoice never marks a sibling invoice paid too.
function withInvoiceReference(url: string, invoiceId: string): string {
  try {
    const parsed = new URL(url)
    parsed.searchParams.set('client_reference_id', invoiceId)
    return parsed.toString()
  } catch {
    return url
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

interface TemplateVars {
  client_name: string
  invoice_number: string
  amount: string
  amount_due: string
  due_date: string
  payment_link: string
  days_overdue: string
  upi_id: string
  bank_details: string
}

function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) =>
    key in vars ? vars[key as keyof TemplateVars] : match
  )
}

function templateUsesVariable(template: string, name: string): boolean {
  return new RegExp(`{{\\s*${name}\\s*}}`).test(template)
}

function daysOverdue(dueDate: string): number {
  const due = new Date(dueDate)
  const now = new Date()
  const diffMs = now.setHours(0, 0, 0, 0) - due.setHours(0, 0, 0, 0)
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Turns the user's plain-text reminder body (editable in Reminder Settings)
// into paragraphs, with any bare URL (e.g. the {{payment_link}} it already
// contains) turned into a clickable link. `highlights` are exact substituted
// values (e.g. the amount due, the due date) to render bold, since those are
// the numbers a client is most likely to scan for.
function textToHtmlParagraphs(text: string, highlights: string[] = []): string {
  return text
    .split(/\n+/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const escaped = escapeHtml(line)
      let linked = escaped.replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" style="color:#3b52c4;">$1</a>'
      )
      for (const value of highlights) {
        if (!value) continue
        const escapedValue = escapeHtml(value)
        linked = linked.replace(new RegExp(escapeRegExp(escapedValue), 'g'), `<strong>${escapedValue}</strong>`)
      }
      return `<p style="margin:0 0 14px 0;font-size:14px;line-height:22px;color:#334155;">${linked}</p>`
    })
    .join('')
}

interface PaymentSettingsForEmail {
  enabled_methods: string[]
  upi_id: string | null
  bank_details: string | null
  qr_code_path: string | null
}

const METHOD_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  upi: 'UPI',
  bank: 'Bank transfer',
  qr: 'QR code',
}

interface BankDetailsFields {
  accountName: string
  bankName: string
  accountNumber: string
  ifscSwift: string
  notes: string
}

// bank_details is stored as JSON (see parseBankDetails/BankField on the
// frontend); anything saved before that change is legacy freeform text,
// which is rendered as-is for backward compatibility.
function parseBankFields(raw: string): BankDetailsFields | null {
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && 'accountName' in parsed) return parsed
  } catch {
    // Not JSON — legacy freeform text.
  }
  return null
}

function bankDetailsRows(raw: string): [string, string][] {
  const fields = parseBankFields(raw)
  if (!fields) return [['Details', raw]]
  return [
    ['Account name', fields.accountName],
    ['Bank', fields.bankName],
    ['Account number', fields.accountNumber],
    ['IFSC / SWIFT', fields.ifscSwift],
    ['Notes', fields.notes],
  ].filter(([, value]) => value) as [string, string][]
}

function bankDetailsHtml(raw: string): string {
  const fields = parseBankFields(raw)
  if (!fields) return textToHtmlParagraphs(raw)

  return bankDetailsRows(raw)
    .map(
      ([label, value]) =>
        `<p style="margin:0 0 6px 0;font-size:14px;line-height:20px;color:#334155;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`
    )
    .join('')
}

// Plain-text version for the {{bank_details}} template variable, so it
// reads correctly both in the plain-text email and once the HTML version
// turns each line into its own paragraph.
function bankDetailsPlainText(raw: string): string {
  return bankDetailsRows(raw)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n')
}

// Renders a block for a single method. Stripe gets a "Pay this invoice"
// button; the others have no automatic status sync, so they just show the
// info the client needs to pay manually. Returns '' if that method has no
// usable data (e.g. UPI enabled but no UPI ID set anywhere).
function buildSingleMethodHtml(method: string, settings: PaymentSettingsForEmail, paymentLink: string): string {
  if (method === 'stripe' && paymentLink) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">
         <tr>
           <td style="background-color:#3b52c4;border-radius:8px;">
             <a href="${paymentLink}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
               Pay this invoice
             </a>
           </td>
         </tr>
       </table>`
  }

  if (method === 'upi' && settings.upi_id) {
    return `<div style="margin-top:8px;padding:14px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <p style="margin:0 0 4px 0;font-size:12px;color:#64748b;">Pay via UPI</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:#0f172a;font-family:ui-monospace,monospace;">${escapeHtml(settings.upi_id)}</p>
    </div>`
  }

  if (method === 'bank' && settings.bank_details) {
    return `<div style="margin-top:8px;padding:14px 16px;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;">Bank transfer details</p>
      ${bankDetailsHtml(settings.bank_details)}
    </div>`
  }

  if (method === 'qr' && settings.qr_code_path) {
    const qrUrl = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/payment-qr-codes/${settings.qr_code_path}`
    return `<div style="margin-top:8px;text-align:center;">
      <img src="${qrUrl}" alt="Payment QR code" width="160" height="160" style="border-radius:8px;border:1px solid #e2e8f0;" />
      <p style="margin:8px 0 0 0;font-size:12px;color:#64748b;">Scan to pay</p>
    </div>`
  }

  return ''
}

// Renders every enabled method that actually has usable data, stacked, each
// labeled when more than one shows up in the same email.
function buildPaymentBlockHtml(settings: PaymentSettingsForEmail | null, paymentLink: string): string {
  const methods = settings?.enabled_methods ?? []
  const blocks = methods
    .map((method) => {
      const html = buildSingleMethodHtml(method, settings!, paymentLink)
      if (!html) return ''
      const label = methods.length > 1 ? METHOD_LABELS[method] ?? method : null
      return label
        ? `<div style="margin-top:12px;"><p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#94a3b8;">${escapeHtml(label)}</p>${html}</div>`
        : html
    })
    .filter(Boolean)

  return blocks.join('')
}

function buildReminderEmailHtml(subject: string, body: string, paymentBlock: string, highlights: string[] = []): string {
  const paragraphs = textToHtmlParagraphs(body, highlights)

  return `<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#3b52c4;width:28px;height:28px;border-radius:8px;text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:14px;font-weight:700;line-height:28px;">P</span>
                  </td>
                  <td style="padding-left:8px;font-size:16px;font-weight:700;color:#0f172a;">PayNudge</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <h1 style="margin:0;font-size:18px;line-height:26px;font-weight:700;color:#0f172a;">
                ${escapeHtml(subject)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 8px 32px;">
              ${paragraphs}
              ${paymentBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 32px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:20px 0 0 0;font-size:12px;line-height:18px;color:#94a3b8;">
                This is an automated payment reminder sent on behalf of the person or business you were
                invoiced by.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0 0;font-size:12px;color:#94a3b8;">
          Sent via PayNudge
        </p>
      </td>
    </tr>
  </table>
</body>`
}

async function sendEmail(to: string, subject: string, body: string, paymentBlock: string, highlights: string[] = []) {
  await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject,
    text: body,
    html: buildReminderEmailHtml(subject, body, paymentBlock, highlights),
  })
}

async function processInvoice(invoice: any, force: boolean) {
  // A manual "send reminder now" call can target a paused invoice directly
  // (it isn't filtered out of the query the way the scheduled sweep is), so
  // this must be checked explicitly rather than relying on the query alone.
  if (invoice.reminders_paused) return { skipped: 'reminders_paused' }

  const client = invoice.client
  const overdue = daysOverdue(invoice.due_date)

  const { data: sequence } = await supabaseAdmin
    .from('reminder_sequences')
    .select('id')
    .eq('user_id', invoice.user_id)
    .eq('is_default', true)
    .maybeSingle()

  if (!sequence) return { skipped: 'no_sequence' }

  const { data: steps } = await supabaseAdmin
    .from('reminder_steps')
    .select('*')
    .eq('sequence_id', sequence.id)
    .eq('enabled', true)
    .order('days_after_due', { ascending: true })
    .order('step_order', { ascending: true })

  if (!steps || steps.length === 0) return { skipped: 'no_steps' }

  const { data: sentLogs } = await supabaseAdmin
    .from('reminder_log')
    .select('reminder_step_id')
    .eq('invoice_id', invoice.id)

  const sentStepIds = new Set((sentLogs ?? []).map((l) => l.reminder_step_id))
  const nextStep = steps.find((s) => !sentStepIds.has(s.id))

  if (!nextStep) return { skipped: 'sequence_complete' }
  if (!force && overdue < nextStep.days_after_due) return { skipped: 'not_due_yet' }

  const { data: payments } = await supabaseAdmin
    .from('invoice_payments')
    .select('amount')
    .eq('invoice_id', invoice.id)

  const totalReceived = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
  const amountDue = Math.max(Number(invoice.amount) - totalReceived, 0)
  const currencyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: invoice.currency,
  })

  const { data: accountSettings } = await supabaseAdmin
    .from('payment_settings')
    .select('enabled_methods, upi_id, bank_details, qr_code_path')
    .eq('user_id', invoice.user_id)
    .maybeSingle()

  // The invoice's own payment fields (set per-invoice in the app) take
  // priority; anything left unset falls back to the account-wide default.
  // No method is ever assumed — an invoice with nothing configured simply
  // gets no payment block in its reminder.
  const effectiveSettings: PaymentSettingsForEmail = {
    enabled_methods: invoice.enabled_methods ?? accountSettings?.enabled_methods ?? [],
    upi_id: invoice.upi_id ?? accountSettings?.upi_id ?? null,
    bank_details: invoice.bank_details ?? accountSettings?.bank_details ?? null,
    qr_code_path: invoice.qr_code_path ?? accountSettings?.qr_code_path ?? null,
  }

  const vars: TemplateVars = {
    client_name: client.last_name ? `${client.first_name} ${client.last_name}` : client.first_name,
    invoice_number: invoice.invoice_number,
    amount: currencyFormatter.format(invoice.amount),
    amount_due: currencyFormatter.format(amountDue),
    due_date: new Date(invoice.due_date).toLocaleDateString(),
    payment_link: invoice.stripe_payment_link_url
      ? withInvoiceReference(invoice.stripe_payment_link_url, invoice.id)
      : '',
    days_overdue: String(Math.max(overdue, 0)),
    // Only fill in when that method is actually enabled for this invoice —
    // an account-wide UPI ID/bank detail must never leak into a reminder
    // whose invoice didn't select that method.
    upi_id: effectiveSettings.enabled_methods.includes('upi') ? effectiveSettings.upi_id ?? '' : '',
    bank_details:
      effectiveSettings.enabled_methods.includes('bank') && effectiveSettings.bank_details
        ? bankDetailsPlainText(effectiveSettings.bank_details)
        : '',
  }

  const subject = renderTemplate(nextStep.subject_template, vars)
  const body = renderTemplate(nextStep.body_template, vars)

  // If the template already places {{upi_id}}/{{bank_details}} inline, don't
  // also auto-append that method's block below — otherwise the same UPI ID
  // or bank details would show up twice in the same email.
  const rawTemplate = `${nextStep.subject_template}\n${nextStep.body_template}`
  const autoBlockSettings: PaymentSettingsForEmail = {
    ...effectiveSettings,
    enabled_methods: effectiveSettings.enabled_methods.filter((method) => {
      if (method === 'upi' && templateUsesVariable(rawTemplate, 'upi_id')) return false
      if (method === 'bank' && templateUsesVariable(rawTemplate, 'bank_details')) return false
      return true
    }),
  }
  const paymentBlock = buildPaymentBlockHtml(autoBlockSettings, vars.payment_link)
  await sendEmail(client.email, subject, body, paymentBlock, [vars.amount_due, vars.amount, vars.due_date])

  await supabaseAdmin.from('reminder_log').insert({
    invoice_id: invoice.id,
    reminder_step_id: nextStep.id,
    rendered_subject: subject,
    rendered_body: body,
  })

  // Only "sent" auto-advances to "overdue" — a partially paid invoice stays
  // partially paid even past its due date, so its remaining-balance status
  // isn't lost.
  if (invoice.status === 'sent' && overdue > 0) {
    await supabaseAdmin.from('invoices').update({ status: 'overdue' }).eq('id', invoice.id)
  }

  return { sent: nextStep.id }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    let invoiceId: string | undefined
    try {
      const body = await req.json()
      invoiceId = body?.invoice_id
    } catch {
      // No JSON body (e.g. a scheduled cron call) — process every eligible invoice.
    }

    if (invoiceId) {
      // Manual "send reminder now" call — verify the caller actually owns this invoice.
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })
      const {
        data: { user },
      } = await userClient.auth.getUser()
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: owned } = await userClient.from('invoices').select('id').eq('id', invoiceId).maybeSingle()
      if (!owned) {
        return new Response(JSON.stringify({ error: 'Invoice not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      // Scheduled sweep — require a shared secret so this can't be triggered by the public.
      const provided = req.headers.get('x-cron-secret')
      if (!CRON_SECRET || !provided || !timingSafeEqual(provided, CRON_SECRET)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    let query = supabaseAdmin
      .from('invoices')
      .select('*, client:clients(*)')
      .in('status', ['sent', 'overdue', 'partially_paid'])
      .is('paid_at', null)

    if (invoiceId) {
      // Manual send — fetch the invoice even if paused, so processInvoice
      // can report back *why* nothing was sent instead of silently
      // returning no results.
      query = query.eq('id', invoiceId)
    } else {
      // Scheduled sweep — paused invoices are skipped outright, no need to
      // fetch them just to report a skip reason nobody will read.
      query = query.eq('reminders_paused', false)
    }

    const { data: invoices, error } = await query
    if (error) throw error

    const results = []
    for (const invoice of invoices ?? []) {
      const result = await processInvoice(invoice, Boolean(invoiceId))
      results.push({ invoice_id: invoice.id, ...result })
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
