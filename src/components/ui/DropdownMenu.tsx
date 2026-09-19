import type { ReactNode } from 'react'
import * as RadixDropdown from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'

export const DropdownMenu = RadixDropdown.Root
export const DropdownMenuTrigger = RadixDropdown.Trigger

export function DropdownMenuContent({
  children,
  align = 'end',
}: {
  children: ReactNode
  align?: 'start' | 'end' | 'center'
}) {
  return (
    <RadixDropdown.Portal>
      <RadixDropdown.Content
        align={align}
        sideOffset={6}
        className="z-50 min-w-[10rem] rounded-lg border border-slate-200 bg-white p-1 shadow-popover focus:outline-none"
      >
        {children}
      </RadixDropdown.Content>
    </RadixDropdown.Portal>
  )
}

export function DropdownMenuItem({
  children,
  onSelect,
  selected,
}: {
  children: ReactNode
  onSelect?: () => void
  selected?: boolean
}) {
  return (
    <RadixDropdown.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-700 outline-none data-[highlighted]:bg-slate-100"
    >
      {children}
      {selected && <Check className="h-3.5 w-3.5 text-brand-600" />}
    </RadixDropdown.Item>
  )
}
