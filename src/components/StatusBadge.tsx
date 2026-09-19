import { Badge, type BadgeTone } from './ui/Badge'
import type { InvoiceStatus } from '../types'

const TONES: Record<InvoiceStatus, BadgeTone> = {
  draft: 'gray',
  sent: 'blue',
  overdue: 'amber',
  partially_paid: 'purple',
  paid: 'green',
  void: 'gray',
}

const LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  overdue: 'Overdue',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  void: 'Void',
}

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge tone={TONES[status]} muted={status === 'void'}>
      {LABELS[status]}
    </Badge>
  )
}
