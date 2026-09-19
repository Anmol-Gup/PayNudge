import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-300',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 active:bg-slate-100 disabled:text-slate-400',
  danger:
    'bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700 disabled:bg-danger-100 disabled:text-danger-300',
  ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200 disabled:text-slate-300',
}

export const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-4 text-sm',
}

export const BUTTON_BASE_CLASSES =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:active:scale-100'

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') {
  return cn(BUTTON_BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className = '', children, ...rest },
  ref
) {
  return (
    <button ref={ref} disabled={disabled || loading} className={buttonClasses(variant, size, className)} {...rest}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
})

interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { variant = 'primary', size = 'md', className = '', children, ...rest },
  ref
) {
  return (
    <Link ref={ref} className={buttonClasses(variant, size, className)} {...rest}>
      {children}
    </Link>
  )
})
