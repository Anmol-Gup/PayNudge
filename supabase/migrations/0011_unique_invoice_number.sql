-- invoice_number was only ever required to be non-null, never unique, so
-- two invoices for the same account could end up with the same number.
-- Scoped per user (not globally) — different freelancers can each have
-- their own "INV-1001" without conflict.
alter table invoices add constraint invoices_user_invoice_number_key unique (user_id, invoice_number);
