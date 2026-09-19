import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import * as RadixDialog from '@radix-ui/react-dialog'
import {
  LayoutDashboard,
  FileText,
  Users,
  Bell,
  CreditCard,
  Landmark,
  LogOut,
  Menu,
  X,
  Receipt,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getClientFullName, initials } from '../lib/format'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/reminders', label: 'Reminders', icon: Bell },
]

const SECONDARY_LINKS = [
  { to: '/payment-settings', label: 'Payment', icon: Landmark },
  { to: '/billing', label: 'Billing', icon: CreditCard },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} className={linkClasses} onClick={onNavigate}>
          <link.icon className="h-4 w-4" aria-hidden="true" />
          {link.label}
        </NavLink>
      ))}
      <div className="my-2 border-t border-slate-100" />
      {SECONDARY_LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} className={linkClasses} onClick={onNavigate}>
          <link.icon className="h-4 w-4" aria-hidden="true" />
          {link.label}
        </NavLink>
      ))}
    </nav>
  )
}

function UserFooter() {
  const { user, signOut } = useAuth()
  const firstName = user?.user_metadata?.first_name as string | undefined
  const fullName = firstName
    ? getClientFullName({ first_name: firstName, last_name: user?.user_metadata?.last_name ?? null })
    : null
  const label = fullName ?? user?.email ?? 'Account'

  return (
    <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
        {initials(label)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{label}</p>
        {fullName && <p className="truncate text-xs text-slate-500">{user?.email}</p>}
      </div>
      <button
        onClick={() => signOut()}
        aria-label="Log out"
        title="Log out"
        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
            <Receipt className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold text-slate-900">PayNudge</span>
        </div>
        <NavItems />
        <UserFooter />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white">
            <Receipt className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold text-slate-900">PayNudge</span>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      <RadixDialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <RadixDialog.Portal>
          <RadixDialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" />
          <RadixDialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col bg-white shadow-popover focus:outline-none lg:hidden">
            <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
            <div className="flex items-center justify-between px-5 py-5">
              <span className="text-base font-semibold text-slate-900">PayNudge</span>
              <RadixDialog.Close
                aria-label="Close navigation menu"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </RadixDialog.Close>
            </div>
            <NavItems onNavigate={() => setMobileOpen(false)} />
            <UserFooter />
          </RadixDialog.Content>
        </RadixDialog.Portal>
      </RadixDialog.Root>

      <main className="lg:pl-60">
        <div className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  )
}
