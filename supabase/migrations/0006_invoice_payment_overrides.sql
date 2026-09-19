-- Payment method can now be overridden per invoice (e.g. a one-off QR code
-- for a specific amount, or a different UPI ID) instead of always inheriting
-- the account-wide default from payment_settings. Null means "use the
-- account default" — most invoices will leave these untouched.
alter table invoices
  add column payment_method text check (payment_method in ('stripe', 'upi', 'bank', 'qr')),
  add column upi_id text,
  add column bank_details text,
  add column qr_code_path text;
