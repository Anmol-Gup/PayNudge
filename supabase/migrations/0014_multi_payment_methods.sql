-- Reminder emails could only ever show one payment method at a time. Adds
-- enabled_methods (an array) alongside the existing single "method" column
-- so several methods (e.g. a Stripe link AND a UPI ID AND bank details) can
-- be shown together, per account default and per invoice. The old "method"
-- / "payment_method" columns are kept in sync (as the first enabled method)
-- for anything that still reads them, but enabled_methods is now the source
-- of truth for what actually renders in emails and on the invoice page.
alter table payment_settings add column enabled_methods text[] not null default '{}';
update payment_settings set enabled_methods = array[method] where enabled_methods = '{}';
alter table payment_settings add constraint payment_settings_enabled_methods_check
  check (enabled_methods <@ array['stripe', 'upi', 'bank', 'qr']::text[]);

-- "method" (singular) is no longer a meaningful default — enabled_methods
-- (which can legitimately be empty, if a user hasn't chosen anything yet)
-- is the only source of truth from here on. Drop its forced default/
-- not-null so nothing is silently pre-selected on a fresh account.
alter table payment_settings alter column method drop not null;
alter table payment_settings alter column method drop default;

alter table invoices add column enabled_methods text[];
update invoices set enabled_methods = array[payment_method] where payment_method is not null;
alter table invoices add constraint invoices_enabled_methods_check
  check (enabled_methods is null or enabled_methods <@ array['stripe', 'upi', 'bank', 'qr']::text[]);
