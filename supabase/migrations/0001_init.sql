-- PayNudge initial schema, RLS policies, and supporting triggers.

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  email text not null,
  created_at timestamptz default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  client_id uuid references clients not null,
  invoice_number text,
  description text,
  amount numeric not null,
  currency text default 'INR',
  due_date date not null,
  status text default 'draft' check (status in ('draft', 'sent', 'overdue', 'paid', 'void')),
  stripe_payment_link_url text,
  stripe_payment_link_id text,
  reminders_paused boolean default false,
  created_at timestamptz default now(),
  paid_at timestamptz
);

create table reminder_sequences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text default 'Default sequence',
  is_default boolean default true
);

create table reminder_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid references reminder_sequences not null,
  days_after_due integer not null,
  tone text default 'polite' check (tone in ('polite', 'firm', 'final')),
  subject_template text not null,
  body_template text not null,
  step_order integer not null
);

create table reminder_log (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices not null,
  reminder_step_id uuid references reminder_steps not null,
  sent_at timestamptz default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text default 'free' check (plan in ('free', 'pro', 'agency')),
  status text default 'active',
  created_at timestamptz default now()
);

create index invoices_user_id_idx on invoices (user_id);
create index invoices_status_idx on invoices (status);
create index clients_user_id_idx on clients (user_id);
create index reminder_steps_sequence_id_idx on reminder_steps (sequence_id);
create index reminder_log_invoice_id_idx on reminder_log (invoice_id);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

alter table clients enable row level security;
alter table invoices enable row level security;
alter table reminder_sequences enable row level security;
alter table reminder_steps enable row level security;
alter table reminder_log enable row level security;
alter table subscriptions enable row level security;

create policy "clients_owner" on clients
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "invoices_owner" on invoices
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "reminder_sequences_owner" on reminder_sequences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "reminder_steps_owner" on reminder_steps
  for all using (
    exists (
      select 1 from reminder_sequences s
      where s.id = reminder_steps.sequence_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from reminder_sequences s
      where s.id = reminder_steps.sequence_id and s.user_id = auth.uid()
    )
  );

create policy "reminder_log_owner" on reminder_log
  for all using (
    exists (
      select 1 from invoices i
      where i.id = reminder_log.invoice_id and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from invoices i
      where i.id = reminder_log.invoice_id and i.user_id = auth.uid()
    )
  );

create policy "subscriptions_owner" on subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Seed a default reminder sequence + free subscription for new users
-- ─────────────────────────────────────────────────────────────

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

  insert into reminder_steps (sequence_id, days_after_due, tone, subject_template, body_template, step_order)
  values
    (
      new_sequence_id, 1, 'polite',
      'Reminder: invoice #{{invoice_number}} is now due',
      'Hi {{client_name}}, just a friendly reminder that invoice #{{invoice_number}} for {{amount}} was due on {{due_date}}. You can pay here: {{payment_link}}',
      1
    ),
    (
      new_sequence_id, 7, 'firm',
      'Invoice #{{invoice_number}} is now a week overdue',
      'Hi {{client_name}}, this invoice is now a week overdue. Please arrange payment at your earliest convenience: {{payment_link}}',
      2
    ),
    (
      new_sequence_id, 14, 'final',
      'Final notice: invoice #{{invoice_number}}',
      'Hi {{client_name}}, this is a final notice for invoice #{{invoice_number}}, now two weeks overdue. Please pay immediately to avoid further action: {{payment_link}}',
      3
    );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Free plan enforcement (defense in depth alongside the frontend check)
-- ─────────────────────────────────────────────────────────────

create or replace function enforce_invoice_limit()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_plan text;
  active_invoice_count integer;
begin
  select plan into user_plan from subscriptions where user_id = new.user_id;

  if coalesce(user_plan, 'free') = 'free' then
    select count(*) into active_invoice_count
    from invoices
    where user_id = new.user_id and status not in ('void', 'paid');

    if active_invoice_count >= 3 then
      raise exception 'Free plan is limited to 3 active invoices. Upgrade to add more.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_invoice_limit_trigger
  before insert on invoices
  for each row execute function enforce_invoice_limit();
