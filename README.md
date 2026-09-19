# PayNudge

Track invoices you've already sent to clients and automatically send escalating,
polite payment reminder emails — with whatever payment method you actually
accept — until they're paid.

This is **not** a full invoicing/accounting app. You invoice clients however you
already do (Stripe, UPI, a bank transfer, a PDF); PayNudge only tracks due
dates, payment status, and automates the follow-up chasing.

## Features

- **Invoices** — create invoices against a client with an amount, currency,
  due date, and description. Statuses: `draft`, `sent`, `overdue`,
  `partially_paid`, `paid`, `void`. Draft invoices never get reminders until
  marked as sent.
- **Clients** — a simple client list (name + email) shared across invoices.
- **Automated reminders** — a default reminder sequence per account with one
  optional *pre-due* "heads up" email and up to three *post-due* escalating
  steps (tones: polite, firm, final), each with its own configurable day
  offset, subject, and body. Templates support variables like
  `{{client_name}}`, `{{invoice_number}}`, `{{amount}}`, `{{amount_due}}`
  (reflects any partial payments already received), `{{due_date}}`,
  `{{payment_link}}`, `{{days_overdue}}`, `{{upi_id}}`, and `{{bank_details}}`,
  with a live preview while editing.
- **Reminder controls per invoice** — pause/resume reminders, or send the
  next one immediately ("Send reminder now") ahead of schedule. Both are
  automatically hidden once every step in the sequence has already been sent.
- **Multiple payment methods, shown together** — Stripe, UPI, bank transfer,
  and/or an uploaded QR code can all be enabled at once, either as an
  account-wide default (Payment settings) or overridden per invoice. Every
  enabled method that has data renders its own block in the reminder email
  (Stripe gets a "Pay this invoice" button; UPI/bank/QR show the info needed
  to pay manually). No method is ever assumed by default — an invoice with
  nothing configured just sends a reminder with no payment block.
- **Partial payments** — record one or more payments against an invoice
  (amount, method, note); the invoice status derives from the running total
  (`partially_paid` vs `paid`), and reminder emails always quote the
  remaining balance, not the original total.
- **Stripe payments without giving PayNudge a key** — each user pastes in
  their *own* Stripe Payment Link (created directly in their Stripe
  dashboard) rather than PayNudge creating one on their behalf, so client
  money always lands directly in their own account.
- **Per-user Stripe webhook** — each account gets its own webhook URL
  (`.../stripe-webhook?uid=<user id>`) and signing secret, so payment
  confirmation works independently of whose Stripe account a link belongs to.
- **Dashboard** — outstanding/overdue/due-soon/paid-this-month totals and a
  recent-invoices list, with a time-of-day greeting.
- **Billing** — plan display (Free/Pro/Agency) and a Stripe Customer Portal
  link for managing an existing subscription. Currently in beta: everyone is
  on the free plan and paid checkout isn't wired up yet (portal management
  works for any subscription created out of band).
- **Auth** — email/password signup and login via Supabase Auth, with
  duplicate-email detection on signup, forgot/reset password flows, and
  already-signed-in users redirected straight to the dashboard instead of
  seeing the login/signup forms again.

## Stack

- Frontend: React + TypeScript + Tailwind + Vite
- Backend/DB/Auth: Supabase (Postgres, Auth, Edge Functions, Storage)
- Email: Nodemailer (any SMTP provider)
- Payments: client-provided Stripe Payment Links / UPI / bank transfer / QR
  code for invoices, Stripe Billing Portal for PayNudge's own subscription
  plans

## Local setup

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

The frontend alone won't do much until it's pointed at a real Supabase project — see below.

## Provisioning a Supabase project (manual, one-time)

1. Create a project at supabase.com and grab its URL, anon key, and service role key.
2. Install the Supabase CLI and link this repo to the project:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
3. Push the schema:
   ```bash
   npx supabase db push
   ```
   This creates all tables, enables RLS, and installs the trigger that seeds
   a default reminder sequence + free subscription for every new user.
4. Create the `payment-qr-codes` storage bucket (public read) if it isn't
   created automatically by the migrations — used for uploaded payment QR
   codes.

## Payment methods

Each account configures its own payment methods in **Payment settings**
(account-wide defaults) and can override them per invoice:

- **Stripe** — paste a Payment Link created in your own Stripe dashboard.
  PayNudge tags each invoice's copy of the link with
  `?client_reference_id=<invoice id>` so payment status tracks back to the
  right invoice even if the same link is reused across several invoices.
- **UPI** — a UPI ID shown to the client to pay you directly.
- **Bank transfer** — account name, bank name, account number (6–18 digits),
  and IFSC/SWIFT code (validated against real IFSC/BIC formats).
- **QR code** — an uploaded image the client scans to pay.

UPI, bank transfer, and QR have no automatic payment confirmation — mark the
invoice paid (or record a partial payment) yourself once you receive it. Only
Stripe payments are confirmed automatically, via the webhook below.

## Stripe setup

Stripe is used for two unrelated things:

1. **Client payments (per user, no key needed from them)** — each user
   creates their own Payment Link in their own Stripe dashboard and pastes
   the URL into PayNudge. No `STRIPE_SECRET_KEY` is needed for this — see
   `supabase/functions/stripe-webhook`.
2. **PayNudge's own subscription billing** — needs a real Stripe account for
   the app itself:
   - Copy your secret key into `STRIPE_SECRET_KEY` (only used by
     `create-portal-session`).
   - Enable the
     [Customer Portal](https://dashboard.stripe.com/settings/billing/portal)
     so `create-portal-session` can hand out portal links.

For each user's own client-payment webhook, they paste their Stripe webhook
signing secret into Payment settings; PayNudge stores it per account and
verifies signatures against the right one using the `uid` in their webhook
URL. There's no global `STRIPE_WEBHOOK_SECRET` for this path.

## SMTP setup (Nodemailer)

1. Get SMTP credentials from any provider (e.g. Gmail with an app password,
   SendGrid, Mailgun, Amazon SES, your own mail server).
2. Fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (`true` for port 465,
   `false` for 587/STARTTLS), `SMTP_USER`, `SMTP_PASSWORD`, and
   `REMINDER_FROM_EMAIL`.

This SMTP server is used by the `send-reminders` function for payment
reminder emails. It is **not** used for auth emails — see below.

## Auth emails (email verification, password reset)

Signup confirmation and "forgot password" emails are sent by Supabase Auth
itself, not by any of our Edge Functions — there's no code path for us to
plug a custom mailer into. Two things to configure in the Supabase
dashboard:

1. **Custom SMTP** (Authentication → Settings → SMTP Settings): Supabase's
   default sender is fine for local testing but rate-limited. For anything
   beyond a few test signups, point it at the same SMTP server/credentials
   you set up above (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASSWORD`).
2. **Redirect URLs** (Authentication → URL Configuration): set the Site URL
   to your deployed domain, and add `<your-domain>/dashboard` and
   `<your-domain>/reset-password` to the allowed redirect list — these
   match what's already set for local dev in `supabase/config.toml`. Without
   this, confirmation/reset links will fail to redirect correctly in
   production.

The app already handles the frontend side of this: `/forgot-password` and
`/reset-password` pages, and password-visibility toggles on every password
field.

## Deploying edge functions + secrets

```bash
npx supabase secrets set --env-file supabase/.env
npx supabase functions deploy send-reminders
npx supabase functions deploy stripe-webhook
npx supabase functions deploy create-portal-session
```

(`supabase/.env` is your own copy with real secrets, based on `.env.example` —
it's git-ignored, never commit it.)

## Scheduling the daily reminder sweep

`send-reminders` expects to be called once a day with no body, and requires an
`x-cron-secret` header matching the `CRON_SECRET` you set in
`supabase/.env` (this stops the public internet from triggering mass emails,
since the function itself doesn't require a Supabase user JWT for the sweep
path). Two ways to schedule it:

- **Supabase dashboard**: Edge Functions → your function → Cron, add a daily
  schedule, and set the custom header `x-cron-secret: <value>`.
- **pg_cron + pg_net** (SQL, if you prefer it in-database):
  ```sql
  select cron.schedule(
    'send-reminders-daily',
    '0 9 * * *',
    $$
    select net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
      headers := jsonb_build_object('x-cron-secret', '<CRON_SECRET value>')
    );
    $$
  );
  ```

The "Send reminder now" button on an invoice's detail page calls the same
function with `{ invoice_id }` in the body, authenticated as the signed-in
user (bypassing the day-offset gate, but still enforcing that the invoice
belongs to them, and still refusing to send if reminders are paused for that
invoice).

## What's intentionally out of scope for v1

- Full invoice/PDF generation and branding
- Multi-currency conversion
- Team/multi-user accounts (Agency tier — later)
- SMS/WhatsApp reminders
- Recurring/subscription invoices
- Paid-plan checkout (Billing currently only manages an existing subscription
  via the Stripe Customer Portal; upgrading from Free isn't wired up yet)
