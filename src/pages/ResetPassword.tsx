import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Receipt } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { PasswordInput } from '../components/ui/PasswordInput'

export function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [checked, setChecked] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setReady(true)
        setChecked(true)
      }
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setReady(true)
        setChecked(true)
      }
    })

    const timeout = setTimeout(() => setChecked(true), 2500)

    return () => {
      listener.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setDone(true)
    setTimeout(() => navigate('/dashboard'), 1500)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
            <Receipt className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold text-slate-900">PayNudge</span>
        </div>

        <Card className="p-8">
          {!checked ? (
            <p className="text-center text-sm text-slate-500">Verifying your link…</p>
          ) : done ? (
            <div className="text-center">
              <h1 className="text-xl font-semibold text-slate-900">Password updated</h1>
              <p className="mt-2 text-sm text-slate-600">Redirecting you to your dashboard…</p>
            </div>
          ) : !ready ? (
            <div className="text-center">
              <h1 className="text-xl font-semibold text-slate-900">Link expired</h1>
              <p className="mt-2 text-sm text-slate-600">
                This password reset link is invalid or has expired. Request a new one to continue.
              </p>
              <Link
                to="/forgot-password"
                className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
              >
                Request a new link
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-slate-900">Set a new password</h1>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <Field label="New password" htmlFor="new-password" hint="At least 6 characters.">
                  <PasswordInput
                    id="new-password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
                <Field label="Confirm new password" htmlFor="confirm-password">
                  <PasswordInput
                    id="confirm-password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </Field>
                {error && <p className="text-sm text-danger-600">{error}</p>}
                <Button type="submit" loading={loading} className="w-full">
                  Update password
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
