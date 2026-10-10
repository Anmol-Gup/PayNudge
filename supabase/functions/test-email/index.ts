// Supabase Edge Function: test-email
// Called from the Email Settings page's "Send test email" button. Takes the
// SMTP fields straight from the (possibly unsaved) form, so a user can
// confirm their credentials work before persisting them.

import { createClient } from 'npm:@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
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
    if (!user?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name } =
      await req.json()

    if (!smtp_host || !smtp_user || !smtp_password) {
      return new Response(JSON.stringify({ error: 'Host, username, and password are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const transporter = nodemailer.createTransport({
      host: smtp_host,
      port: Number(smtp_port) || 587,
      secure: Boolean(smtp_secure),
      auth: { user: smtp_user, pass: smtp_password },
    })

    const fromEmail = (from_email as string | undefined)?.trim() || smtp_user
    const fromName = (from_name as string | undefined)?.trim()

    await transporter.sendMail({
      from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
      to: user.email,
      subject: 'PayNudge test email',
      text: 'This is a test email from PayNudge — your SMTP settings are working. Reminder emails will now send from this address.',
      html: '<p style="font-family:sans-serif;font-size:14px;color:#334155;">This is a test email from <strong>PayNudge</strong> — your SMTP settings are working. Reminder emails will now send from this address.</p>',
    })

    return new Response(JSON.stringify({ ok: true, sentTo: user.email }), {
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
