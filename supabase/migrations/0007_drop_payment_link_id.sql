-- stripe_payment_link_id is no longer used to match webhook events to an
-- invoice: two invoices can legitimately share the same Payment Link (same
-- product, different clients/invoices), and matching on the link id alone
-- would mark every invoice sharing that link as paid when only one actually
-- was. Instead the webhook now matches on client_reference_id, a per-invoice
-- value appended to the link's URL, so this column is dead weight.
alter table invoices drop column if exists stripe_payment_link_id;
