export type InvoiceStatus = 'draft' | 'sent' | 'overdue' | 'partially_paid' | 'paid' | 'void'
export type ReminderTone = 'polite' | 'firm' | 'final'
export type Plan = 'free' | 'pro' | 'agency'
export type PaymentMethod = 'stripe' | 'upi' | 'bank' | 'qr'

export interface Client {
  id: string
  user_id: string
  first_name: string
  last_name: string | null
  email: string
  created_at: string
}

export interface Invoice {
  id: string
  user_id: string
  client_id: string | null
  invoice_number: string
  description: string | null
  amount: number
  currency: string
  due_date: string
  status: InvoiceStatus
  stripe_payment_link_url: string | null
  payment_method: PaymentMethod | null
  enabled_methods: PaymentMethod[] | null
  upi_id: string | null
  bank_details: string | null
  qr_code_path: string | null
  reminders_paused: boolean
  created_at: string
  paid_at: string | null
  client?: Client
}

export interface InvoicePayment {
  id: string
  invoice_id: string
  user_id: string
  amount: number
  currency: string
  method: PaymentMethod
  note: string | null
  paid_at: string
  created_at: string
}

export interface ReminderSequence {
  id: string
  user_id: string
  name: string
  is_default: boolean
}

export interface ReminderStep {
  id: string
  sequence_id: string
  days_after_due: number
  tone: ReminderTone
  subject_template: string
  body_template: string
  step_order: number
  enabled: boolean
}

export interface ReminderLog {
  id: string
  invoice_id: string
  reminder_step_id: string
  sent_at: string
  rendered_subject: string | null
  rendered_body: string | null
  reminder_step?: ReminderStep
}

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: Plan
  status: string
  created_at: string
}

export interface PaymentSettings {
  id: string
  user_id: string
  method: PaymentMethod | null
  enabled_methods: PaymentMethod[]
  stripe_webhook_secret: string | null
  upi_id: string | null
  bank_details: string | null
  qr_code_path: string | null
  created_at: string
  updated_at: string
}
