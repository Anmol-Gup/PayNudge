-- Per-user payment method configuration: each user brings their own
-- Stripe restricted key (so client payments land in their own Stripe
-- account, not the platform's), or a UPI ID / bank details / QR code
-- for methods with no automatic status sync.

create table payment_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  method text not null default 'stripe' check (method in ('stripe', 'upi', 'bank', 'qr')),
  stripe_restricted_key text,
  stripe_webhook_secret text,
  upi_id text,
  bank_details text,
  qr_code_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table payment_settings enable row level security;

create policy "payment_settings_owner" on payment_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Keep updated_at current on every change.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger payment_settings_set_updated_at
  before update on payment_settings
  for each row execute function set_updated_at();

-- Storage bucket for uploaded QR codes. Public read is intentional — a
-- payment QR code isn't sensitive, the same way a Stripe Payment Link URL
-- already isn't; it needs to be viewable by clients reading their email.
insert into storage.buckets (id, name, public)
values ('payment-qr-codes', 'payment-qr-codes', true)
on conflict (id) do nothing;

create policy "qr_codes_owner_write" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'payment-qr-codes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "qr_codes_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'payment-qr-codes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "qr_codes_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'payment-qr-codes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "qr_codes_public_read" on storage.objects
  for select to public
  using (bucket_id = 'payment-qr-codes');
