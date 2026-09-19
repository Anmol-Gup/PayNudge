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

function Logo() {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
        <Receipt className="h-4 w-4" />
      </div>
      <span className="text-base font-semibold text-slate-900">PayNudge</span>
    </div>
  )
}

export function Signup() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [duplicateEmail, setDuplicateEmail] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [resent, setResent] = useState(false)
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
    setDuplicateEmail(false)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName.trim(), last_name: lastName.trim() || null },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })
    setLoading(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }
    // Supabase returns 200 with no error when the email already has a
    // confirmed account (anti-enumeration — it never says "already
    // registered"). The one reliable signal, verified against this
    // project's actual signup response, is an empty identities array; a
    // genuinely new signup always comes back with at least one identity.
    if (data.user && data.user.identities?.length === 0) {
      setDuplicateEmail(true)
      return
    }
    if (data.session) {
      navigate('/dashboard')
    } else {
      setDone(true)
    }
  }

  const handleResend = async () => {
    setResending(true)
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
    setResending(false)
    if (resendError) {
      setError(resendError.message)
      return
    }
    setResent(true)
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm">
          <Logo />
          <Card className="p-8 text-center">
            <h1 className="text-xl font-semibold text-slate-900">Check your inbox</h1>
            <p className="mt-2 text-sm text-slate-600">
              We've sent a confirmation link to <span className="font-medium">{email}</span>. Confirm
              your email to finish signing up.
            </p>
            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Already have a PayNudge account with this email? You won't get a new email in that case
              — just{' '}
              <Link to="/login" className="font-medium text-brand-600 hover:underline">
                log in
              </Link>{' '}
              instead.
            </p>
            {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
            {resent ? (
              <p className="mt-4 text-sm font-medium text-success-600">Confirmation email resent.</p>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="mt-4 text-sm font-medium text-brand-600 hover:underline disabled:opacity-50"
              >
                {resending ? 'Resending…' : "Didn't get it? Resend the email"}
              </button>
            )}
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <Logo />
        <Card className="p-8">
          <h1 className="text-xl font-semibold text-slate-900">Create your PayNudge account</h1>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" htmlFor="signup-first-name">
                <Input
                  id="signup-first-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </Field>
              <Field label="Last name" htmlFor="signup-last-name">
                <Input
                  id="signup-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Email" htmlFor="signup-email">
              <Input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {duplicateEmail && (
              <div className="rounded-md border border-warning-100 bg-warning-50 p-3 text-sm text-warning-700">
                <p>User already exists.</p>
              </div>
            )}
            <Field label="Password" htmlFor="signup-password" hint="At least 6 characters.">
              <PasswordInput
                id="signup-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && <p className="text-sm text-danger-600">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              Sign up
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:underline">
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
