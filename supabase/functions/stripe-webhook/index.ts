// Supabase Edge Function: stripe-webhook
// Each user sets up their own Stripe webhook pointing at this same function,
// with their user id in the URL (?uid=...) — since every user can now use
// their own Stripe account, verifying a signature requires knowing whose
// secret to check against *before* trusting the payload, and the uid query
// param is how we know which payment_settings row to look up. It isn't a
// secret itself — the actual security is still the per-user HMAC signature
// check below, same strength as a single shared secret, just scoped per user.
// Payment links are pasted in by the user (not created via the Stripe API),
// so no live Stripe key is needed here at all — only the webhook secret.
//
// Two invoices can legitimately share the same Payment Link (same product,
// different clients), so matching purely on the link would mark every
// invoice sharing it as paid whenever any one of them was. Instead, the
// link the client actually receives has ?client_reference_id=<invoice id>
// appended (see withInvoiceReference on the frontend), and Stripe echoes
// that back on the checkout session — so we match on that instead.

import Stripe from 'npm:stripe@16'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const uid = url.searchParams.get('uid')
  if (!uid) {
    return new Response('Missing uid', { status: 400 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  const { data: settings } = await supabaseAdmin
    .from('payment_settings')
    .select('stripe_webhook_secret')
    .eq('user_id', uid)
    .maybeSingle()

  if (!settings?.stripe_webhook_secret) {
    return new Response('No webhook configured for this account', { status: 400 })
  }

  const stripe = new Stripe('sk_unused', { apiVersion: '2024-06-20' })

  const body = await req.text()
  let event: Stripe.Event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, settings.stripe_webhook_secret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const invoiceId = session.client_reference_id

      if (invoiceId) {
        // amount_total is in the smallest currency unit (e.g. cents/paise).
        // A stale or reused Payment Link can be priced for less than the
        // invoice, so this is logged as a payment and the invoice's status
        // is derived from the running total rather than always jumping
        // straight to "paid" — a short payment becomes "partially paid"
        // with a real remaining balance instead of being trusted blindly.
        const paidAmount =
          typeof session.amount_total === 'number' ? session.amount_total / 100 : null

        if (paidAmount != null) {
          const { data: invoiceRow } = await supabaseAdmin
            .from('invoices')
            .select('id, amount')
            .eq('id', invoiceId)
            .eq('user_id', uid)
            .maybeSingle()

          if (invoiceRow) {
            await supabaseAdmin.from('invoice_payments').insert({
              invoice_id: invoiceId,
              user_id: uid,
              amount: paidAmount,
              currency: session.currency ?? 'usd',
              method: 'stripe',
            })

            const { data: payments } = await supabaseAdmin
              .from('invoice_payments')
              .select('amount')
              .eq('invoice_id', invoiceId)

            const totalReceived = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
            const fullyPaid = totalReceived >= Number(invoiceRow.amount) - 0.01

            const { error } = await supabaseAdmin
              .from('invoices')
              .update({
                status: fullyPaid ? 'paid' : 'partially_paid',
                paid_at: fullyPaid ? new Date().toISOString() : null,
              })
              .eq('id', invoiceId)
              .eq('user_id', uid)

            if (error) {
              console.error('Failed to update invoice after payment:', error)
              return new Response('Database error', { status: 500 })
            }
          }
        }
      } else {
        console.error('checkout.session.completed had no client_reference_id — was the raw Stripe link shared instead of the one PayNudge generated?')
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response((err as Error).message, { status: 500 })
  }
})
