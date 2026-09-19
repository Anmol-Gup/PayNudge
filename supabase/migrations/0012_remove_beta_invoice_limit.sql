-- PayNudge is free for everyone during the beta (no paid plans are on sale
-- yet), but this trigger still hard-blocked invoice creation past 3 active
-- invoices on the free plan — contradicting that. Drop the enforcement; it
-- can be reintroduced deliberately once paid plans actually exist.
drop trigger if exists enforce_invoice_limit_trigger on invoices;
drop function if exists enforce_invoice_limit();
