import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = 'neutral',
}: {
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  tone?: 'neutral' | 'positive'
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center ${
        tone === 'positive' ? 'border-success-100 bg-success-50/40' : 'border-slate-200 bg-slate-50/60'
      }`}
    >
      {Icon && (
        <div
          className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full ${
            tone === 'positive' ? 'bg-success-100 text-success-600' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <Icon className="h-5 w-5" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
