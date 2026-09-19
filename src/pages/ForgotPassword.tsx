import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Receipt } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Input } from '../components/ui/Input'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (resetError) {
      setError(resetError.message)
      return
    }
    setSent(true)
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

        {sent ? (
          <Card className="p-8 text-center">
            <h1 className="text-xl font-semibold text-slate-900">Check your inbox</h1>
            <p className="mt-2 text-sm text-slate-600">
              If an account exists for <span className="font-medium">{email}</span>, we've sent a
              link to reset your password.
            </p>
            <Link
              to="/login"
              className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline"
            >
              Back to log in
            </Link>
          </Card>
        ) : (
          <Card className="p-8">
            <h1 className="text-xl font-semibold text-slate-900">Reset your password</h1>
            <p className="mt-1 text-sm text-slate-500">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Field label="Email" htmlFor="forgot-email">
                <Input
                  id="forgot-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              {error && <p className="text-sm text-danger-600">{error}</p>}
              <Button type="submit" loading={loading} className="w-full">
                Send reset link
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">
              <Link to="/login" className="font-medium text-brand-600 hover:underline">
                Back to log in
              </Link>
            </p>
          </Card>
        )}
      </div>
    </div>
  )
}
