# PayNudge

Track invoices you've already sent and automatically email escalating, polite
payment reminders — via Stripe, UPI, bank transfer, or a QR code — until
they're paid. Not a full invoicing/accounting app: you invoice however you
already do; PayNudge just tracks due dates, payment status, and chases follow-up.

## Features

- **Invoices** — amount, currency, due date, description; statuses `draft` →
  `sent`/`overdue`/`partially_paid` → `paid`/`void`. Drafts never get reminders.
- **Clients** — simple name/email list shared across invoices.
- **Automated reminders** — one optional pre-due "heads up" + up to 3 post-due
  escalating steps (polite/firm/final), each with its own day offset and
  editable subject/body. Template variables: `client_name`, `invoice_number`,
  `amount`, `amount_due` (reflects partial payments), `due_date`,
  `payment_link`, `days_overdue`, `upi_id`, `bank_details` — live preview
  while editing. Pause/resume or send-now per invoice; both auto-hide once
  every step's already been sent.
- **Multiple payment methods at once** — Stripe, UPI, bank transfer, and/or a
  QR code can all be enabled together, as an account default or per-invoice
  override. Every configured method gets its own block in the reminder email;
  nothing is shown for a method with no data.
- **Partial payments** — record one or more payments per invoice; status and
  reminder emails always reflect the remaining balance, not the original total.
- **Stripe, no key required from users** — each user pastes their own Payment
  Link and gets their own webhook URL (`/stripe-webhook?uid=<id>`) + signing
  secret, so payments land directly in their account and auto-confirm without
  PayNudge ever holding a Stripe key on their behalf.
- **Delete with history preserved** — deleting an invoice removes it (and its
  reminder log/payments) permanently; "Void" is the non-destructive
  alternative. Deleting a client cascades to its unresolved invoices
  (`draft`/`sent`/`overdue`/`partially_paid`) but keeps `paid`/`void` invoices
  as history, just unlinked from the client.
- **Dashboard** — outstanding/overdue/due-soon/paid-this-month totals, recent
  invoices, time-of-day greeting.
- **Billing** — Free/Pro/Agency plan display + Stripe Customer Portal link.
  Beta: everyone's on Free, paid checkout isn't wired up yet.
- **Auth** — Supabase email/password, duplicate-email detection on signup,
  forgot/reset password, already-signed-in users skip straight to dashboard.

## Stack

React + TypeScript + Tailwind + Vite · Supabase (Postgres, Auth, Edge
Functions, Storage) · Nodemailer (any SMTP) · Stripe (client Payment Links +
PayNudge's own Billing Portal)

## Setup

```bash
npm install
cp .env.example .env   # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

Provision a real Supabase project before the frontend does much:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push   # tables, RLS, default reminder sequence + free plan trigger
```

Then set secrets and deploy the edge functions:

```bash
npx supabase secrets set --env-file supabase/.env   # your own copy, git-ignored
npx supabase functions deploy send-reminders
npx supabase functions deploy stripe-webhook
npx supabase functions deploy create-portal-session
```

**SMTP** (`SMTP_HOST/PORT/SECURE/USER/PASSWORD`, `REMINDER_FROM_EMAIL`) is used
only by `send-reminders`. Auth emails (confirm/reset) are sent by Supabase
itself — configure Custom SMTP and add `<domain>/dashboard` +
`<domain>/reset-password` to Redirect URLs in the Supabase dashboard, or
confirmation/reset links won't redirect right in production.

**Stripe**: `STRIPE_SECRET_KEY` is only for PayNudge's own subscription
billing portal — client payments need no key, since users bring their own
Payment Link + webhook secret (entered in Payment settings).

## Scheduling reminders

`send-reminders` needs a daily call with no body and an `x-cron-secret` header
matching `CRON_SECRET`. Either use Supabase's dashboard cron scheduler, or
pg_cron + pg_net:

```sql
select cron.schedule('send-reminders-daily', '0 9 * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET value>')
  );
$$);
```

The in-app "Send reminder now" button calls the same function with
`{ invoice_id }`, authenticated as the owner, bypassing the day-offset gate
(but not the paused check).

## Out of scope for v1

Full invoice/PDF generation, multi-currency, team accounts, SMS/WhatsApp
reminders, recurring invoices, paid-plan checkout.
