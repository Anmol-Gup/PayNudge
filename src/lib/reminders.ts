import type { ReminderStep, ReminderTone } from '../types'

export const REMINDER_TONE_LABELS: Record<ReminderTone, string> = {
  polite: 'Friendly',
  firm: 'Firm',
  final: 'Final',
}

export function nextUnsentStep(steps: ReminderStep[], sentStepIds: Set<string>): ReminderStep | undefined {
  return steps.find((s) => !sentStepIds.has(s.id))
}

export function reminderDate(dueDate: string, step: ReminderStep): Date {
  const d = new Date(dueDate)
  d.setDate(d.getDate() + step.days_after_due)
  return d
}

export function describeStepTiming(step: Pick<ReminderStep, 'days_after_due'>): string {
  const days = Math.abs(step.days_after_due)
  const unit = days === 1 ? 'day' : 'days'
  return step.days_after_due < 0 ? `${days} ${unit} before due date` : `${days} ${unit} overdue`
}

/**
 * Summarizes where an invoice stands in its reminder sequence, e.g.
 * "1/3 sent · Firm reminder tomorrow" — always shows progress through the
 * sequence alongside the timing, so "sending soon" alone never has to stand
 * in for both the 1st and 3rd reminder.
 */
export function describeNextReminder(
  dueDate: string,
  steps: ReminderStep[],
  sentStepIds: Set<string>
): string {
  const total = steps.length
  if (total === 0) return 'No sequence configured'

  const sentCount = steps.filter((s) => sentStepIds.has(s.id)).length
  const nextStep = nextUnsentStep(steps, sentStepIds)

  if (!nextStep) return `All ${total} reminders sent`

  const toneLabel = REMINDER_TONE_LABELS[nextStep.tone]
  const date = reminderDate(dueDate, nextStep)
  const now = new Date()
  const diffDays = Math.round(
    (date.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
  )

  let timing: string
  if (diffDays <= 0) timing = 'sending soon'
  else if (diffDays === 1) timing = 'tomorrow'
  else timing = `in ${diffDays} days`

  return `${sentCount}/${total} sent · ${toneLabel} ${timing}`
}
