import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Field } from '../components/ui/Field'
import { Input, Select, Textarea } from '../components/ui/Input'
import { Switch } from '../components/ui/Switch'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorBanner } from '../components/ui/ErrorBanner'
import { Skeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabaseClient'
import { renderTemplate, type TemplateVars } from '../lib/templates'
import { REMINDER_TONE_LABELS, describeStepTiming } from '../lib/reminders'
import type { ReminderStep, ReminderTone } from '../types'

const TONES: ReminderTone[] = ['polite', 'firm', 'final']
const MAX_POST_DUE_STEPS = 3

const VARIABLES = [
  'client_name',
  'invoice_number',
  'amount',
  'amount_due',
  'due_date',
  'payment_link',
  'days_overdue',
  'upi_id',
  'bank_details',
]

const PREVIEW_VARS: TemplateVars = {
  client_name: 'Acme Corporation',
  invoice_number: 'INV-1042',
  amount: '$500.00',
  amount_due: '$250.00',
  due_date: 'Sep 10, 2026',
  payment_link: 'https://pay.stripe.com/abc123',
  days_overdue: '5',
  upi_id: 'yourname@okhdfcbank',
  bank_details: 'Account name: Acme Co\nBank: Example Bank\nAccount number: 1234567890\nIFSC / SWIFT: EXBK0001234',
}

const DEFAULT_PRE_DUE_SUBJECT = 'Heads up: invoice #{{invoice_number}} is due soon'
const DEFAULT_PRE_DUE_BODY =
  "Hi {{client_name}}, just a friendly heads up that invoice #{{invoice_number}} for {{amount}} is due on {{due_date}}. You can pay here: {{payment_link}}"
const DEFAULT_POST_DUE_SUBJECT = 'Reminder: invoice #{{invoice_number}} is now due'
const DEFAULT_POST_DUE_BODY =
  'Hi {{client_name}}, just a friendly reminder that invoice #{{invoice_number}} for {{amount}} was due on {{due_date}}. You can pay here: {{payment_link}}'

type EditMode = 'pre-due' | 'post-due'

export function ReminderSettings() {
  const toast = useToast()
  const [steps, setSteps] = useState<ReminderStep[]>([])
  const [sequenceId, setSequenceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingStep, setEditingStep] = useState<ReminderStep | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [editMode, setEditMode] = useState<EditMode>('post-due')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [daysValue, setDaysValue] = useState(1)
  const [tone, setTone] = useState<ReminderTone>('polite')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [lastFocused, setLastFocused] = useState<'subject' | 'body'>('body')

  const [deleteTarget, setDeleteTarget] = useState<ReminderStep | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [togglingPreDue, setTogglingPreDue] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: seq, error: seqError } = await supabase
        .from('reminder_sequences')
        .select('*')
        .eq('is_default', true)
        .maybeSingle()

      if (seqError) {
        setError('Something went wrong while loading your reminder sequence.')
        return
      }

      setSequenceId(seq?.id ?? null)

      if (seq) {
        const { data: stepData } = await supabase
          .from('reminder_steps')
          .select('*')
          .eq('sequence_id', seq.id)
          .order('days_after_due')
          .order('step_order')
        setSteps((stepData as ReminderStep[]) ?? [])
      }
    } catch {
      setError('Something went wrong while loading your reminder sequence.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const preDueStep = useMemo(() => steps.find((s) => s.days_after_due < 0) ?? null, [steps])
  const postDueSteps = useMemo(
    () => steps.filter((s) => s.days_after_due >= 0 && s.enabled),
    [steps]
  )

  const openEdit = (step: ReminderStep) => {
    const isPreDue = step.days_after_due < 0
    setEditingStep(step)
    setCreatingNew(false)
    setEditMode(isPreDue ? 'pre-due' : 'post-due')
    setDaysValue(Math.abs(step.days_after_due))
    setTone(step.tone)
    setSubject(step.subject_template)
    setBody(step.body_template)
    setFormError(null)
    setDialogOpen(true)
  }

  const openCreatePreDue = () => {
    setEditingStep(null)
    setCreatingNew(true)
    setEditMode('pre-due')
    setDaysValue(1)
    setTone('polite')
    setSubject(DEFAULT_PRE_DUE_SUBJECT)
    setBody(DEFAULT_PRE_DUE_BODY)
    setFormError(null)
    setDialogOpen(true)
  }

  const openCreatePostDue = () => {
    if (postDueSteps.length >= MAX_POST_DUE_STEPS) return
    setEditingStep(null)
    setCreatingNew(true)
    setEditMode('post-due')
    const maxDays = postDueSteps.length > 0 ? Math.max(...postDueSteps.map((s) => s.days_after_due)) : 0
    setDaysValue(maxDays + 7)
    setTone('polite')
    setSubject(DEFAULT_POST_DUE_SUBJECT)
    setBody(DEFAULT_POST_DUE_BODY)
    setFormError(null)
    setDialogOpen(true)
  }

  const insertVariable = (variable: string) => {
    const token = `{{${variable}}}`
    if (lastFocused === 'subject' && subjectRef.current) {
      const el = subjectRef.current
      const pos = el.selectionStart ?? subject.length
      const next = subject.slice(0, pos) + token + subject.slice(pos)
      setSubject(next)
      requestAnimationFrame(() => el.setSelectionRange(pos + token.length, pos + token.length))
    } else if (bodyRef.current) {
      const el = bodyRef.current
      const pos = el.selectionStart ?? body.length
      const next = body.slice(0, pos) + token + body.slice(pos)
      setBody(next)
      requestAnimationFrame(() => el.setSelectionRange(pos + token.length, pos + token.length))
    }
  }

  const handleSave = async () => {
    if (!subject.trim() || !body.trim() || daysValue < (editMode === 'pre-due' ? 1 : 0)) return
    setSaving(true)
    setFormError(null)

    const days_after_due = editMode === 'pre-due' ? -Math.abs(daysValue) : Math.abs(daysValue)

    if (creatingNew) {
      if (!sequenceId) {
        setSaving(false)
        setFormError('Could not find your reminder sequence.')
        return
      }
      const { error: insertError } = await supabase.from('reminder_steps').insert({
        sequence_id: sequenceId,
        days_after_due,
        tone,
        subject_template: subject,
        body_template: body,
        step_order: editMode === 'pre-due' ? 0 : postDueSteps.length + 1,
        enabled: true,
      })
      setSaving(false)
      if (insertError) {
        setFormError(insertError.message)
        return
      }
      toast.success(editMode === 'pre-due' ? 'Pre-due reminder added.' : 'Reminder step added.')
    } else {
      if (!editingStep) return
      const { error: updateError } = await supabase
        .from('reminder_steps')
        .update({
          days_after_due,
          tone,
          subject_template: subject,
          body_template: body,
        })
        .eq('id', editingStep.id)
      setSaving(false)
      if (updateError) {
        setFormError(updateError.message)
        return
      }
      toast.success('Reminder step saved.')
    }

    setDialogOpen(false)
    load()
  }

  const togglePreDue = async () => {
    if (!preDueStep) return
    setTogglingPreDue(true)
    const { error: toggleError } = await supabase
      .from('reminder_steps')
      .update({ enabled: !preDueStep.enabled })
      .eq('id', preDueStep.id)
    setTogglingPreDue(false)
    if (toggleError) {
      toast.error(toggleError.message)
      return
    }
    load()
  }

  const confirmDeletePostDue = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const { error: deleteError } = await supabase.from('reminder_steps').delete().eq('id', deleteTarget.id)

    if (deleteError?.code === '23503') {
      // This step has already been used to send at least one reminder, so
      // reminder_log's foreign key blocks a hard delete — deleting it would
      // erase that history. Disable it instead; it disappears from this
      // list either way, but past invoices still show what was actually sent.
      const { error: disableError } = await supabase
        .from('reminder_steps')
        .update({ enabled: false })
        .eq('id', deleteTarget.id)
      setDeleting(false)
      if (disableError) {
        toast.error(disableError.message)
        setDeleteTarget(null)
        return
      }
      toast.success('Reminder step removed.')
      setDeleteTarget(null)
      load()
      return
    }

    setDeleting(false)
    if (deleteError) {
      toast.error(deleteError.message)
      setDeleteTarget(null)
      return
    }
    toast.success('Reminder step removed.')
    setDeleteTarget(null)
    load()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    )
  }

  if (error) {
    return <ErrorBanner message={error} onRetry={load} />
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reminder sequence</h1>
        <p className="mt-1 text-sm text-slate-500">
          Automatically follow up with clients before and after invoices become overdue.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Before the due date</h2>
        {preDueStep ? (
          <Card className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-4">
              <Switch checked={preDueStep.enabled} onChange={togglePreDue} label="Enable pre-due reminder" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {REMINDER_TONE_LABELS[preDueStep.tone]} reminder
                  {!preDueStep.enabled && <span className="ml-2 text-xs font-normal text-slate-400">Disabled</span>}
                </p>
                <p className="text-sm text-slate-500">{describeStepTiming(preDueStep)}</p>
              </div>
            </div>
            <button
              onClick={() => openEdit(preDueStep)}
              disabled={togglingPreDue}
              aria-label="Edit pre-due reminder"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <Pencil className="h-4 w-4" />
            </button>
          </Card>
        ) : (
          <Card className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm text-slate-500">
              No pre-due reminder set up — clients get no heads up before an invoice is due.
            </p>
            <Button variant="secondary" size="sm" onClick={openCreatePreDue}>
              <Plus className="h-3.5 w-3.5" />
              Add pre-due reminder
            </Button>
          </Card>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">After the due date</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={openCreatePostDue}
            disabled={postDueSteps.length >= MAX_POST_DUE_STEPS}
          >
            <Plus className="h-3.5 w-3.5" />
            Add reminder
          </Button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          You can add up to {MAX_POST_DUE_STEPS} post-due reminders ({postDueSteps.length}/
          {MAX_POST_DUE_STEPS} used).
        </p>

        {postDueSteps.length === 0 ? (
          <EmptyState
            title="No post-due reminders"
            description="Add at least one to follow up on overdue invoices."
          />
        ) : (
          <ol className="space-y-3">
            {postDueSteps.map((step, index) => (
              <li key={step.id}>
                <Card className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {REMINDER_TONE_LABELS[step.tone]} reminder
                      </p>
                      <p className="text-sm text-slate-500">{describeStepTiming(step)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(step)}
                      aria-label={`Edit step ${index + 1}`}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {postDueSteps.length > 1 && (
                      <button
                        onClick={() => setDeleteTarget(step)}
                        aria-label={`Delete step ${index + 1}`}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-danger-50 hover:text-danger-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </Card>
                {index < postDueSteps.length - 1 && (
                  <div className="ml-8 h-3 w-px border-l-2 border-dashed border-slate-200" />
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={creatingNew ? (editMode === 'pre-due' ? 'Add pre-due reminder' : 'Add reminder step') : 'Edit reminder step'}
        className="max-w-3xl"
      >
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={editMode === 'pre-due' ? 'Days before due date' : 'Days after due'} htmlFor="days-value">
                <Input
                  id="days-value"
                  type="number"
                  min={editMode === 'pre-due' ? 1 : 0}
                  value={daysValue}
                  onChange={(e) => setDaysValue(Number(e.target.value))}
                />
              </Field>
              <Field label="Tone" htmlFor="tone">
                <Select id="tone" value={tone} onChange={(e) => setTone(e.target.value as ReminderTone)}>
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {REMINDER_TONE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Subject" htmlFor="subject">
              <Input
                id="subject"
                ref={subjectRef}
                value={subject}
                onFocus={() => setLastFocused('subject')}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Field>

            <Field label="Body" htmlFor="body">
              <Textarea
                id="body"
                ref={bodyRef}
                rows={6}
                value={body}
                onFocus={() => setLastFocused('body')}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                Insert variable
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-xs text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                <code className="font-mono">{'{{upi_id}}'}</code> and{' '}
                <code className="font-mono">{'{{bank_details}}'}</code> only fill in if you've set up
                that payment method — otherwise they render blank.
              </p>
            </div>

            {formError && <p className="text-sm text-danger-600">{formError}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={saving}>
                {creatingNew ? 'Add step' : 'Save step'}
              </Button>
            </div>
          </div>

          <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Preview</p>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="break-words border-b border-slate-100 pb-2 text-sm font-semibold text-slate-900">
                {renderTemplate(subject, PREVIEW_VARS) || 'Subject preview'}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-600">
                {renderTemplate(body, PREVIEW_VARS) || 'Body preview'}
              </p>
            </div>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove this reminder step?"
        description="Clients won't receive this reminder anymore. This can't be undone."
        confirmLabel="Remove step"
        tone="danger"
        loading={deleting}
        onConfirm={confirmDeletePostDue}
      />
    </div>
  )
}
