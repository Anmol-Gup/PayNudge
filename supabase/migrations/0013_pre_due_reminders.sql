-- Adds support for an optional pre-due reminder alongside the existing
-- post-due sequence. A pre-due step is just a reminder_steps row with a
-- negative days_after_due (e.g. -1 means "1 day before the due date") —
-- the existing day-counting logic in send-reminders already handles
-- negative offsets correctly, so no new timing concept is needed, only a
-- way to enable/disable it without deleting the row (so customizations
-- aren't lost when toggled off).
alter table reminder_steps add column enabled boolean not null default true;

-- Reseed new signups with a pre-due reminder ahead of the existing
-- polite/firm/final post-due sequence. Existing accounts are untouched —
-- they've already customized their own sequence.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_sequence_id uuid;
begin
  insert into subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active');

  insert into reminder_sequences (user_id, name, is_default)
  values (new.id, 'Default sequence', true)
  returning id into new_sequence_id;

  insert into reminder_steps (sequence_id, days_after_due, tone, subject_template, body_template, step_order, enabled)
  values
    (
      new_sequence_id, -1, 'polite',
      'Heads up: invoice #{{invoice_number}} is due soon',
      'Hi {{client_name}}, just a friendly heads up that invoice #{{invoice_number}} for {{amount}} is due on {{due_date}}. You can pay here: {{payment_link}}',
      0, true
    ),
    (
      new_sequence_id, 1, 'polite',
      'Reminder: invoice #{{invoice_number}} is now due',
      'Hi {{client_name}}, just a friendly reminder that invoice #{{invoice_number}} for {{amount}} was due on {{due_date}}. You can pay here: {{payment_link}}',
      1, true
    ),
    (
      new_sequence_id, 7, 'firm',
      'Invoice #{{invoice_number}} is now a week overdue',
      'Hi {{client_name}}, this invoice is now a week overdue. Please arrange payment at your earliest convenience: {{payment_link}}',
      2, true
    ),
    (
      new_sequence_id, 14, 'final',
      'Final notice: invoice #{{invoice_number}}',
      'Hi {{client_name}}, this is a final notice for invoice #{{invoice_number}}, now two weeks overdue. Please pay immediately to avoid further action: {{payment_link}}',
      3, true
    );

  return new;
end;
$$;
