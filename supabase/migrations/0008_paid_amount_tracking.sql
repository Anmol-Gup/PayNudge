-- Stripe Payment Links are pasted in manually (no API key to verify their
-- configured price), so the invoice amount and what a client actually pays
-- can drift apart — e.g. a stale link amount, or a link reused for a
-- different invoice at a different price. The checkout.session.completed
-- webhook already reports the real amount paid at no extra permission cost,
-- so record it to flag mismatches instead of blindly trusting "paid".
alter table invoices
  add column paid_amount numeric,
  add column paid_currency text;
