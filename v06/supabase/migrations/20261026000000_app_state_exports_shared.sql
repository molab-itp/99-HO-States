-- Lets signed-in users read each other's app state exports (`key = 'history/<time>'`), so the v2
-- Account view can import another user's latest export. What `supabase db diff` would generate
-- from schemas/20_app_state.sql.

create policy "Signed-in users can read all app state exports"
  on public.app_state for select
  to authenticated
  using (key like 'history/%');
