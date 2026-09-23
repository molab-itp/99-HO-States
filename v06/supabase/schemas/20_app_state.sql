-- Schemaless per-user app state: the "no migration" half of the architecture.
--
-- Each app stores its state as a JSON document, keyed by (user, app, key). Adding, renaming or
-- dropping a field is a client-only change (Codable in Swift, a plain object in JS), so it never
-- needs a migration. v2's `AppState.json` and v05's localStorage state are already JSON of this
-- shape, so both can sync through one row with `app = 'ho-states'`, which also syncs state
-- between iOS and web.
--
-- Move a field out into its own typed table (via a migration) only once you need to query,
-- aggregate or join it across users, e.g. "most-hearted president across all users".

create table public.app_state (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  app text not null,
  key text not null default 'default',
  data jsonb not null default '{}'::jsonb,
  -- Bump from the client when the JSON shape changes incompatibly, and upgrade old documents in
  -- client code on read, so no migration is needed.
  schema_version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, app, key)
);

alter table public.app_state enable row level security;

create policy "Users can read their own app state"
  on public.app_state for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own app state"
  on public.app_state for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own app state"
  on public.app_state for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own app state"
  on public.app_state for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create trigger app_state_set_updated_at
  before update on public.app_state
  for each row execute function public.set_updated_at();
