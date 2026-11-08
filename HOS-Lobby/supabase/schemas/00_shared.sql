-- Shared helpers used by the other schema files. Files in schemas/ are applied in filename order,
-- so anything another file depends on belongs in a lower-numbered file.

-- Generic `before update` trigger body: stamps `updated_at` so clients never have to send it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
