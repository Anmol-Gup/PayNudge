-- Stripe payment links are now pasted in by the user per invoice, rather than
-- generated via the Stripe API on their behalf, so the restricted key is no
-- longer used anywhere (webhook signature verification never needed a live
-- key). Drop it rather than keep an unused, sensitive column around.
alter table payment_settings drop column if exists stripe_restricted_key;
