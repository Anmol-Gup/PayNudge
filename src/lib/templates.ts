import type { Client, Invoice } from '../types'
import { getClientFullName } from './format'

export interface TemplateVars {
  client_name: string
  invoice_number: string
  amount: string
  amount_due: string
  due_date: string
  payment_link: string
  days_overdue: string
  upi_id: string
  bank_details: string
}

export function buildTemplateVars(
  invoice: Invoice,
  client: Client,
  daysOverdue: number,
  totalReceived = 0
): TemplateVars {
  const formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency })
  return {
    client_name: getClientFullName(client),
    invoice_number: invoice.invoice_number,
    amount: formatter.format(invoice.amount),
    amount_due: formatter.format(Math.max(invoice.amount - totalReceived, 0)),
    due_date: new Date(invoice.due_date).toLocaleDateString(),
    payment_link: invoice.stripe_payment_link_url ?? '',
    days_overdue: String(daysOverdue),
    upi_id: invoice.upi_id ?? '',
    bank_details: invoice.bank_details ?? '',
  }
}

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) => {
    return key in vars ? vars[key as keyof TemplateVars] : match
  })
}
