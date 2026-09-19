# PayNudge

Track invoices you've already sent to clients and automatically send escalating,
polite payment reminder emails — with a Stripe payment link — until they're paid.

This is **not** a full invoicing/accounting app. You invoice clients however you
already do (Stripe, PayPal, a PDF); PayNudge only tracks due dates, payment
status, and automates the follow-up chasing.

## Stack

- Frontend: React + TypeScript + Tailwind + Vite
- Backend/DB/Auth: Supabase (Postgres, Auth, Edge Functions)
- Email: Nodemailer (any SMTP provider)
- Payments: Stripe (Payment Links for client invoices, Billing Portal for PayNudge's own subscription plans)

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
   This creates all tables, enables RLS, and installs the triggers that seed a
   default reminder sequence + free subscription for every new user, plus the
   free-plan invoice-limit enforcement trigger.
4. Enable Google as an auth provider (Authentication → Providers) if you want
   the "Continue with Google" button to work.

## Stripe setup

1. Create a Stripe account (test mode is fine to start).
2. Copy your secret key into `STRIPE_SECRET_KEY`.
3. Create a webhook endpoint in the Stripe dashboard pointing at:
   `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
   Subscribe it to `checkout.session.completed`. Copy the signing secret into
   `STRIPE_WEBHOOK_SECRET`.
4. Set up your Pro/Agency products and prices, and enable the
   [Customer Portal](https://dashboard.stripe.com/settings/billing/portal) so
   `create-portal-session` can hand out portal links.

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
`/reset-password` pages, a "Resend confirmation email" link if someone logs
in before confirming, and password-visibility toggles on every password
field.

## Deploying edge functions + secrets

```bash
npx supabase secrets set --env-file supabase/.env
npx supabase functions deploy create-payment-link
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
belongs to them).

## What's intentionally out of scope for v1

- Full invoice/PDF generation and branding
- Multi-currency conversion
- Team/multi-user accounts (Agency tier — later)
- SMS/WhatsApp reminders
- Recurring/subscription invoices
