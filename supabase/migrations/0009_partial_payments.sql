-- Payments were previously all-or-nothing (a single "mark as paid" click),
-- with no way to record that a client only paid part of an invoice. This
-- introduces a proper payment ledger: every payment (Stripe webhook or a
-- manually recorded UPI/bank/QR payment) is logged as its own row, the
-- invoice status derives from the running total against the invoice
-- amount, and reminders can state the true remaining balance.

-- paid_amount/paid_currency (added in 0008 to flag a Stripe amount
-- mismatch) are superseded by the ledger below, which handles that same
-- case more usefully (a short payment now becomes "partially paid" with a
-- real remaining balance, instead of a warning bolted onto "paid").
alter table invoices drop column if exists paid_amount;
alter table invoices drop column if exists paid_currency;

do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  where rel.relname = 'invoices' and con.contype = 'c' and pg_get_constraintdef(con.oid) ilike '%status%'
  limit 1;

  if existing_constraint is not null then
    execute format('alter table invoices drop constraint %I', existing_constraint);
  end if;
end $$;

alter table invoices add constraint invoices_status_check
  check (status in ('draft', 'sent', 'overdue', 'partially_paid', 'paid', 'void'));

create table invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices on delete cascade not null,
  user_id uuid references auth.users not null,
  amount numeric not null check (amount > 0),
  currency text not null,
  method text not null check (method in ('stripe', 'upi', 'bank', 'qr')),
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index invoice_payments_invoice_id_idx on invoice_payments (invoice_id);

alter table invoice_payments enable row level security;

create policy "invoice_payments_owner" on invoice_payments
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
