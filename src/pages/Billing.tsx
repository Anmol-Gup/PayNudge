import { useEffect, useState } from 'react'
import { Check, Sparkles, Mail } from 'lucide-react'
import { Card, CardContent, CardHeader } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Skeleton } from '../components/ui/Skeleton'
import { supabase } from '../lib/supabaseClient'
import type { Plan, Subscription } from '../types'

const PLAN_LABELS: Record<Plan, string> = {
  free: 'Free',
  pro: 'Pro',
  agency: 'Agency',
}

const PLANS: {
  id: Plan
  price: string
  invoiceLimit: string
  features: string[]
  highlighted?: boolean
}[] = [
  {
    id: 'free',
    price: '$0',
    invoiceLimit: '3 active invoices',
    features: ['3 active invoices', 'Default reminder sequence', 'Manual reminders'],
  },
  {
    id: 'pro',
    price: '$9/month',
    invoiceLimit: '50 active invoices',
    features: ['50 active invoices', 'Custom reminder sequences', 'Unlimited clients', 'Manual reminders'],
    highlighted: true,
  },
  {
    id: 'agency',
    price: '$29/month',
    invoiceLimit: '250 active invoices',
    features: ['250 active invoices', 'Custom reminder sequences', 'Unlimited clients', 'Priority support'],
  },
]

export function Billing() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle()
      setSubscription(sub as Subscription | null)
    } catch {
      setLoadError('Something went wrong while loading your billing details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const plan = subscription?.plan ?? 'free'

  const openCustomerPortal = async () => {
    setPortalLoading(true)
    setError(null)
    const { data, error: fnError } = await supabase.functions.invoke('create-portal-session')
    setPortalLoading(false)
    if (fnError) {
      setError(fnError.message)
      return
    }
    if (data?.url) window.location.href = data.url
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Billing</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
            <Sparkles className="h-3 w-3" />
            Beta
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          PayNudge is free for everyone during the beta — paid plans aren't available yet.
        </p>
      </div>

      {loadError && <ErrorBanner message={loadError} onRetry={load} />}

      <Card>
        <CardHeader title="Current plan" />
        <CardContent>
          <p className="text-xl font-semibold text-slate-900">{PLAN_LABELS[plan]}</p>

          {error && (
            <div className="mt-4">
              <ErrorBanner message={error} />
            </div>
          )}

          {plan === 'free' ? (
            <Button variant="secondary" disabled className="mt-5">
              Paid plans coming soon
            </Button>
          ) : (
            <Button onClick={openCustomerPortal} loading={portalLoading} className="mt-5">
              Manage subscription
            </Button>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Plans</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card
              key={p.id}
              className={`p-5 ${p.highlighted ? 'border-brand-300 ring-1 ring-brand-200' : ''}`}
            >
              {p.highlighted && (
                <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                  Recommended
                </span>
              )}
              <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {PLAN_LABELS[p.id]}
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{p.price}</p>
              <ul className="mt-4 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" disabled className="mt-5 w-full">
                {plan === p.id ? 'Current plan' : 'Coming soon'}
              </Button>
            </Card>
          ))}
        </div>
      </div>

      <Card className="bg-slate-50/60 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Questions about billing?</p>
            <p className="mt-1 text-sm text-slate-500">
              Need help with your plan or have a question about PayNudge?{' '}
              <a
                href="mailto:contact.agbusinesssolutions@gmail.com"
                className="font-medium text-brand-600 hover:underline"
              >
                contact.agbusinesssolutions@gmail.com
              </a>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
