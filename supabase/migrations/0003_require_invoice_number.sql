-- Make invoice_number mandatory. Backfill any existing null values first
-- (defensive — none exist as of this migration, but keeps this safe to
-- re-run against any environment).
update invoices
set invoice_number = 'INV-' || substr(id::text, 1, 8)
where invoice_number is null;

alter table invoices alter column invoice_number set not null;
