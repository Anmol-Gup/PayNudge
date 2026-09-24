import { Link } from 'react-router-dom'
import {
  Receipt,
  Mail,
  MessageSquareWarning,
  MegaphoneOff,
  CircleDollarSign,
  ArrowRight,
  RefreshCcw,
  CalendarClock,
  Wallet,
  ListChecks,
  Sparkles,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { ButtonLink } from '../components/ui/Button'

const FEATURES = [
  {
    icon: RefreshCcw,
    title: 'Automatic follow-ups',
    description: 'Set it once — PayNudge nudges clients for you until they pay.',
  },
  {
    icon: CalendarClock,
    title: 'Before and after the due date',
    description: 'A friendly heads-up before it’s due, then escalating reminders if it’s late.',
  },
  {
    icon: Wallet,
    title: 'Pay any way',
    description: 'Stripe, UPI, bank transfer, or a QR code — whatever your clients already use.',
  },
  {
    icon: ListChecks,
    title: 'Partial payments tracked',
    description: 'Client pays half? PayNudge keeps chasing just what’s left.',
  },
]

const STEPS = [
  { number: '01', text: 'Add an invoice and pick how you get paid.' },
  { number: '02', text: 'Set reminders — before and after the due date.' },
  { number: '03', text: 'PayNudge follows up automatically.' },
  { number: '04', text: 'Client pays (fully or partly) — PayNudge tracks it.' },
]

const FLOW = [
  { icon: Mail, label: 'Heads-up reminder' },
  { icon: MessageSquareWarning, label: 'Due date passes' },
  { icon: Mail, label: 'Friendly reminder' },
  { icon: Mail, label: 'Firm reminder' },
  { icon: Mail, label: 'Final reminder' },
  { icon: CircleDollarSign, label: 'Client pays' },
  { icon: MegaphoneOff, label: 'Reminders stop' },
]

const PREVIEW_INVOICES = [
  { client: 'Acme Corporation', amount: '₹50,000', status: 'overdue' as const, meta: '5 days overdue' },
  { client: 'XYZ Studio', amount: '₹1,200', status: 'sent' as const, meta: 'Due in 3 days' },
  { client: 'Northwind Co.', amount: '₹820', status: 'paid' as const, meta: 'Paid Sep 12' },
  { client: 'Delta Labs', amount: '₹9,500', status: 'partially_paid' as const, meta: '₹4,500 remaining' },
]

const STATUS_TONE = {
  overdue: 'amber',
  sent: 'blue',
  paid: 'green',
  draft: 'gray',
  partially_paid: 'purple',
} as const

export function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
              <Receipt className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold text-slate-900">PayNudge</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
            <a href="#features" className="transition-colors hover:text-slate-900">
              Product
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-slate-900">
              How it works
            </a>
            <a href="#beta" className="transition-colors hover:text-slate-900">
              Beta
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
              Log in
            </Link>
            <ButtonLink to="/signup" size="sm">
              Join the beta
            </ButtonLink>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Get paid without chasing clients.
            </h1>
            <p className="mt-5 text-lg text-slate-600">
              PayNudge follows up before an invoice is even due, then escalates automatically if it's
              late — so you can stop sending awkward reminders yourself, however your clients pay.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <ButtonLink to="/signup" size="md" className="h-11 px-6 text-base">
                Join the beta
              </ButtonLink>
              <a
                href="#how-it-works"
                className="group inline-flex h-11 items-center gap-1.5 px-4 text-base font-medium text-slate-600 transition-colors hover:text-slate-900"
              >
                See how it works
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
            <div className="mx-auto mt-6 flex max-w-full flex-wrap items-center justify-center gap-4">
              <a
                href="https://www.producthunt.com/products/paynudge-5?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-paynudge-29df7cfb-c8b3-4220-b1f0-b60a7714b472"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-[190px] max-w-full"
              >
                <img
                  alt="PayNudge - Automated invoice reminders for freelancers and agencies. | Product Hunt"
                  width="250"
                  height="54"
                  src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1257521&theme=light&t=1790020235577"
                  className="h-auto w-full"
                />
              </a>
              <a
                href="https://saashunt.best/projects/paynudge?utm_source=badge"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src="https://saashunt.best/images/badges/featured-on-light.svg"
                  alt="Featured on SaasHunt"
                  className="h-11 w-auto max-w-full"
                />
              </a>
            </div>
            <p className="mt-3 text-sm text-slate-500">Free during beta</p>
          </div>

          {/* Dashboard preview mockup */}
          <div className="mx-auto mt-14 max-w-4xl">
            <Card className="overflow-hidden p-0 transition-shadow duration-200 hover:shadow-popover">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                </div>
                <span className="mx-auto rounded-md bg-white px-3 py-1 text-xs text-slate-400 ring-1 ring-slate-100">
                  app.paynudge.com/dashboard
                </span>
              </div>
              <div className="p-7 sm:p-8">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                  <div className="rounded-lg border border-slate-100 p-4">
                    <p className="text-xs font-medium text-slate-400">Outstanding</p>
                    <p className="mt-1.5 text-xl font-semibold text-slate-900 sm:text-2xl">₹2,52,000</p>
                  </div>
                  <div className="rounded-lg border border-slate-100 p-4">
                    <p className="text-xs font-medium text-slate-400">Overdue</p>
                    <p className="mt-1.5 text-xl font-semibold text-warning-600 sm:text-2xl">₹50,000</p>
                  </div>
                  <div className="rounded-lg border border-slate-100 p-4">
                    <p className="text-xs font-medium text-slate-400">Due soon</p>
                    <p className="mt-1.5 text-xl font-semibold text-slate-900 sm:text-2xl">₹9,500</p>
                  </div>
                  <div className="rounded-lg border border-slate-100 p-4">
                    <p className="text-xs font-medium text-slate-400">Paid this month</p>
                    <p className="mt-1.5 text-xl font-semibold text-success-600 sm:text-2xl">₹82,000</p>
                  </div>
                </div>
                <div className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {PREVIEW_INVOICES.map((inv) => (
                    <div
                      key={inv.client}
                      className="grid grid-cols-2 items-center gap-3 px-4 py-3.5 text-sm sm:grid-cols-4 sm:gap-4"
                    >
                      <span className="truncate font-medium text-slate-900">{inv.client}</span>
                      <span className="text-slate-500">{inv.amount}</span>
                      <span className="hidden sm:block">
                        <Badge tone={STATUS_TONE[inv.status]}>{inv.status.replace('_', ' ')}</Badge>
                      </span>
                      <span className="hidden truncate text-slate-400 sm:block">{inv.meta}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Flow / outcome section */}
        <section className="border-y border-slate-100 bg-slate-50 py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Before it's due, after it's late, until it's paid — PayNudge handles the follow-up.
            </h2>

            {/* Desktop / tablet: horizontal flow */}
            <div className="mt-12 hidden items-start justify-center sm:flex">
              {FLOW.map((step, i) => {
                const resolved = i >= FLOW.length - 2
                return (
                  <div key={step.label} className="flex items-start">
                    <div className="flex w-24 flex-col items-center gap-2.5 text-center">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-full border ${
                          resolved
                            ? 'border-success-200 bg-success-50 text-success-600'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <step.icon className="h-5 w-5" />
                      </div>
                      <span
                        className={`text-xs font-medium ${resolved ? 'text-success-700' : 'text-slate-600'}`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {i < FLOW.length - 1 && (
                      <div className="mt-6 h-px w-6 shrink-0 bg-slate-300 lg:w-10" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Mobile: vertical timeline */}
            <ol className="mx-auto mt-10 max-w-xs space-y-5 sm:hidden">
              {FLOW.map((step, i) => {
                const resolved = i >= FLOW.length - 2
                return (
                  <li key={step.label} className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                        resolved
                          ? 'border-success-200 bg-success-50 text-success-600'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span
                      className={`text-sm font-medium ${resolved ? 'text-success-700' : 'text-slate-700'}`}
                    >
                      {step.label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            How it works
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-4 lg:divide-x lg:divide-slate-100">
            {STEPS.map((step) => (
              <div key={step.number} className="lg:px-6 lg:first:pl-0">
                <span className="text-3xl font-bold text-brand-300">{step.number}</span>
                <p className="mt-2 text-base font-medium text-slate-900">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-slate-100 bg-slate-50 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Everything you need to get paid
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <Card
                  key={feature.title}
                  className="group p-5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-popover"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100">
                    <feature.icon className="h-4 w-4" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{feature.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Early beta */}
        <section id="beta" className="border-t border-slate-100 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <Card className="mx-auto max-w-2xl bg-slate-50/60 p-8 text-center sm:p-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold tracking-wide text-brand-700">
                <Sparkles className="h-3.5 w-3.5" />
                EARLY ACCESS
              </span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Be an early PayNudge user
              </h2>
              <p className="mt-3 text-slate-600">
                We're inviting freelancers and small agencies to try PayNudge and help shape the
                product.
              </p>
              <p className="mt-4 text-sm font-semibold text-brand-700">Free during the beta.</p>
              <div className="mt-6">
                <ButtonLink to="/signup" size="md" className="h-11 px-6 text-base">
                  Join the beta
                </ButtonLink>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                No commitment. Just help us build a better way to chase payments.
              </p>
            </Card>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-slate-100 bg-brand-600 py-20">
          <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Stop chasing. Start getting paid.
            </h2>
            <p className="mt-3 text-brand-100">
              Let PayNudge handle the follow-ups while you focus on your work.
            </p>
            <ButtonLink to="/signup" variant="secondary" className="mt-8 h-11 px-6 text-base">
              Join the beta
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center text-sm text-slate-400 sm:px-6">
          <span>© {new Date().getFullYear()} PayNudge</span>
          <span>
            For enquiries, contact us:{' '}
            <a href="mailto:contact.agbusinesssolutions@gmail.com" className="text-slate-500 hover:text-slate-700">
              contact.agbusinesssolutions@gmail.com
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}
