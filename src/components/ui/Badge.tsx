import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BadgeTone = 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'purple'

const TONE_CLASSES: Record<BadgeTone, string> = {
  gray: 'bg-slate-100 text-slate-600',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-warning-50 text-warning-700',
  green: 'bg-success-50 text-success-700',
  red: 'bg-danger-50 text-danger-700',
  purple: 'bg-purple-50 text-purple-700',
}

export function Badge({
  tone = 'gray',
  children,
  className = '',
  muted = false,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
  muted?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        muted && 'line-through opacity-70',
        className
      )}
    >
      {children}
    </span>
  )
}
