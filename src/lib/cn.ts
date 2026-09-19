import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind class strings, resolving conflicting utilities (e.g.
 * `max-w-md` + `max-w-3xl`) so the later one deterministically wins —
 * plain string concatenation leaves that outcome up to Tailwind's internal
 * generation order, which is not guaranteed to match source order.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return twMerge(classes.filter(Boolean).join(' '))
}
