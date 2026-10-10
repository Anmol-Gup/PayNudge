import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'
import { Switch } from '../components/ui/Switch'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/Toast'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import type { EmailSettings as EmailSettingsType } from '../types'

const PRESETS = [
  { label: 'Custom', host: '', port: 587, secure: false },
  { label: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: false },
  { label: 'Outlook / Office 365', host: 'smtp.office365.com', port: 587, secure: false },
  { label: 'Zoho Mail', host: 'smtp.zoho.com', port: 465, secure: true },
] as const

export function EmailSettings() {
  const { user } = useAuth()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [host, setHost] = useState('')
  const [port, setPort] = useState(587)
  const [secure, setSecure] = useState(false)
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: fetchError } = await supabase
        .from('email_settings')
        .select('*')
        .maybeSingle()
      if (fetchError) throw fetchError
      const settings = data as EmailSettingsType | null
      if (settings) {
        setHost(settings.smtp_host ?? '')
        setPort(settings.smtp_port ?? 587)
        setSecure(settings.smtp_secure)
        setSmtpUser(settings.smtp_user ?? '')
        setSmtpPassword(settings.smtp_password ?? '')
        setFromEmail(settings.from_email ?? '')
        setFromName(settings.from_name ?? '')
      }
    } catch {
      setError('Something went wrong while loading your email settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    if (!preset.host) return
    setHost(preset.host)
    setPort(preset.port)
    setSecure(preset.secure)
  }

  const currentPayload = () => ({
    smtp_host: host.trim(),
    smtp_port: port,
    smtp_secure: secure,
    smtp_user: smtpUser.trim(),
    smtp_password: smtpPassword,
    from_email: fromEmail.trim() || null,
    from_name: fromName.trim() || null,
  })

  const isComplete = host.trim() && smtpUser.trim() && smtpPassword

  const handleTest = async () => {
    if (!isComplete) {
      toast.error('Fill in host, username, and password first.')
      return
    }
    setTesting(true)
    const { data, error: fnError } = await supabase.functions.invoke('test-email', {
      body: currentPayload(),
    })
    setTesting(false)
    if (fnError || data?.error) {
      toast.error(data?.error ?? fnError?.message ?? 'Could not send a test email.')
      return
    }
    toast.success(`Test email sent to ${data.sentTo}.`)
  }

  const handleSave = async () => {
    if (!user) return
    if (!isComplete) {
      toast.error('Fill in host, username, and password.')
      return
    }
    setSaving(true)
    const { error: saveError } = await supabase
      .from('email_settings')
      .upsert({ user_id: user.id, ...currentPayload() }, { onConflict: 'user_id' })
    setSaving(false)
    if (saveError) {
      toast.error(saveError.message)
      return
    }
    toast.success('Email settings saved.')
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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Email</h1>
        <p className="mt-1 text-sm text-slate-500">
          Reminders currently send from PayNudge's shared mailbox. Connect your own so clients see
          reminders coming from you.
        </p>
      </div>

      <Card>
        <CardHeader
          title="How to connect your email"
          description="Most providers need an app-specific password rather than your normal login password."
        />
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Gmail</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-slate-600">
              <li>
                Turn on{' '}
                <a
                  href="https://myaccount.google.com/signinoptions/two-step-verification"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-600 hover:underline"
                >
                  2-Step Verification
                </a>{' '}
                on your Google account (required for app passwords).
              </li>
              <li>
                Go to{' '}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-600 hover:underline"
                >
                  Google Account → App passwords
                </a>
                , create one named "PayNudge", and copy the 16-character password it shows.
              </li>
              <li>
                Below, pick the <strong>Gmail</strong> preset, enter your Gmail address as the
                username, and paste the app password as the password.
              </li>
            </ol>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Outlook, Zoho, or a custom domain inbox</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-slate-600">
              <li>Pick the matching preset below, or choose Custom and enter your provider's SMTP host and port (check your provider's mail settings page or ask your host).</li>
              <li>Use your full email address as the username.</li>
              <li>
                Use an app-specific password if your provider offers one; otherwise your normal
                mailbox password.
              </li>
            </ol>
          </div>

          <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-700">Why this matters</p>
            <p className="mt-1">
              Reminders sent from your own address are less likely to be flagged as spam, and
              clients can reply directly to you. Until you connect your own, PayNudge keeps
              sending from its shared default address so reminders don't stop.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="SMTP settings" description="Saved only to your account, never shared." />
        <CardContent className="space-y-5">
          <Field label="Provider preset">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
            <Field label="SMTP host" htmlFor="smtp-host" required>
              <Input
                id="smtp-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="smtp.gmail.com"
              />
            </Field>
            <Field label="Port" htmlFor="smtp-port" required>
              <Input
                id="smtp-port"
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || 587)}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Use SSL (port 465)</p>
              <p className="text-xs text-slate-500">
                Leave off for STARTTLS on port 587 — the most common setup.
              </p>
            </div>
            <Switch checked={secure} onChange={setSecure} label="Use SSL" />
          </div>

          <Field label="Username" htmlFor="smtp-user" required hint="Usually your full email address.">
            <Input
              id="smtp-user"
              value={smtpUser}
              onChange={(e) => setSmtpUser(e.target.value)}
              placeholder="you@yourdomain.com"
            />
          </Field>

          <Field label="Password" htmlFor="smtp-password" required hint="An app-specific password, if your provider offers one.">
            <PasswordInput
              id="smtp-password"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="From email"
              htmlFor="from-email"
              hint="Defaults to the username above if left blank."
            >
              <Input
                id="from-email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="you@yourdomain.com"
              />
            </Field>
            <Field label="From name" htmlFor="from-name" hint="Shown to clients as the sender name.">
              <Input
                id="from-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your Name or Business"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
            <Button onClick={handleSave} loading={saving}>
              Save email settings
            </Button>
            <Button variant="secondary" onClick={handleTest} loading={testing}>
              Send test email
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
