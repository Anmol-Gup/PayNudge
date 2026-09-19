-- Split clients.name into first_name / last_name.

alter table clients add column first_name text;
alter table clients add column last_name text;

update clients
set
  first_name = split_part(name, ' ', 1),
  last_name = case
    when position(' ' in name) > 0
      then nullif(trim(substring(name from position(' ' in name) + 1)), '')
    else null
  end
where name is not null;

update clients set first_name = coalesce(first_name, '') where first_name is null;

alter table clients alter column first_name set not null;
alter table clients drop column name;
