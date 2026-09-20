-- Deleting a client removes its invoices too — an invoice for a client that
-- no longer exists has nobody to email reminders to, so keeping it around
-- (or blocking the client delete entirely) serves no purpose.
alter table invoices drop constraint invoices_client_id_fkey;
alter table invoices add constraint invoices_client_id_fkey
  foreign key (client_id) references clients (id) on delete cascade;

-- Deleting an invoice should take its reminder history with it — a log of
-- reminders sent for an invoice that no longer exists is meaningless, and
-- previously blocked invoice deletion outright via a plain FK violation.
alter table reminder_log drop constraint reminder_log_invoice_id_fkey;
alter table reminder_log add constraint reminder_log_invoice_id_fkey
  foreign key (invoice_id) references invoices (id) on delete cascade;
