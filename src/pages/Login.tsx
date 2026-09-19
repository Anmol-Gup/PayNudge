import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Receipt } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'
import { PasswordInput } from '../components/ui/PasswordInput'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && session) {
      navigate('/dashboard', { replace: true })
    }
  }, [authLoading, session, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setUnconfirmed(false)
    setResent(false)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signInError) {
      if (signInError.message.toLowerCase().includes('email not confirmed')) {
        setUnconfirmed(true)
      } else {
        setError(signInError.message)
      }
      return
    }
    navigate('/dashboard')
  }

  const handleResendConfirmation = async () => {
    setResending(true)
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    if (resendError) {
      setError(resendError.message)
      return
    }
    setResent(true)
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
          <h1 className="text-xl font-semibold text-slate-900">Log in to PayNudge</h1>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Email" htmlFor="login-email">
              <Input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field
              label="Password"
              htmlFor="login-password"
              labelAction={
                <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:underline">
                  Forgot password?
                </Link>
              }
            >
              <PasswordInput
                id="login-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <p className="text-sm text-danger-600">{error}</p>}
            {unconfirmed && (
              <div className="rounded-md border border-warning-100 bg-warning-50 p-3 text-sm text-warning-700">
                <p>Please confirm your email before logging in.</p>
                {resent ? (
                  <p className="mt-1 font-medium">Confirmation email resent — check your inbox.</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={resending}
                    className="mt-1 font-medium underline disabled:opacity-50"
                  >
                    {resending ? 'Resending…' : 'Resend confirmation email'}
                  </button>
                )}
              </div>
            )}
            <Button type="submit" loading={loading} className="w-full">
              Log in
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            No account?{' '}
            <Link to="/signup" className="font-medium text-brand-600 hover:underline">
              Sign up
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
