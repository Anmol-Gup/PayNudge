-- Deleting a client used to cascade-delete every one of its invoices,
-- destroying paid/void transaction history along with it. Only draft,
-- sent, overdue, and partially_paid invoices actually need to disappear
-- with the client (they're the only statuses the reminder sweep still
-- processes, so they're the only ones that could ever try emailing a
-- client that no longer exists). Paid and void invoices are terminal —
-- the sweep already ignores them — so they're preserved, just unlinked
-- from the deleted client.

alter table invoices alter column client_id drop not null;

alter table invoices drop constraint invoices_client_id_fkey;
alter table invoices add constraint invoices_client_id_fkey
  foreign key (client_id) references clients (id) on delete set null;

create or replace function delete_non_terminal_invoices_for_client()
returns trigger as $$
begin
  delete from invoices
  where client_id = old.id
    and status in ('draft', 'sent', 'overdue', 'partially_paid');
  return old;
end;
$$ language plpgsql;

create trigger clients_before_delete_cleanup
  before delete on clients
  for each row
  execute function delete_non_terminal_invoices_for_client();
