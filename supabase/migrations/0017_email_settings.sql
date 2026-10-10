-- Per-user SMTP configuration, so reminder emails send from each user's own
-- mailbox instead of the platform's shared sender. A user who hasn't
-- configured this yet falls back to the platform default in send-reminders.

create table email_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  smtp_host text,
  smtp_port integer not null default 587,
  smtp_secure boolean not null default false,
  smtp_user text,
  smtp_password text,
  from_email text,
  from_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table email_settings enable row level security;

create policy "email_settings_owner" on email_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- set_updated_at() already exists (created in 0004_payment_settings.sql).
create trigger email_settings_set_updated_at
  before update on email_settings
  for each row execute function set_updated_at();
