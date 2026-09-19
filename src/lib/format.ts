export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Whole calendar days between `dueDate` and today. Positive = overdue, negative = upcoming. */
export function daysPastDue(dueDate: string | Date): number {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : new Date(dueDate)
  const now = new Date()
  const diffMs = now.setHours(0, 0, 0, 0) - new Date(due).setHours(0, 0, 0, 0)
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/** "5 days overdue" / "Due tomorrow" / "Due in 3 days" / "Paid Sep 12" style summaries. */
export function formatRelativeDue(dueDate: string, status: string, paidAt: string | null): string {
  if (status === 'paid') {
    return paidAt ? `Paid ${formatShortDate(paidAt)}` : 'Paid'
  }
  if (status === 'void') return 'Void'

  const diff = daysPastDue(dueDate)
  if (diff > 1) return `${diff} days overdue`
  if (diff === 1) return '1 day overdue'
  if (diff === 0) return 'Due today'
  if (diff === -1) return 'Due tomorrow'
  return `Due in ${Math.abs(diff)} days`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function getClientFullName(client: { first_name: string; last_name: string | null }): string {
  return client.last_name ? `${client.first_name} ${client.last_name}` : client.first_name
}
