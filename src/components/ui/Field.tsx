import type { ReactNode } from 'react'

export function Field({
  label,
  labelAction,
  htmlFor,
  hint,
  error,
  required,
  children,
  className = '',
}: {
  label: ReactNode
  labelAction?: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-danger-600">*</span>}
        </label>
        {labelAction}
      </div>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  )
}
