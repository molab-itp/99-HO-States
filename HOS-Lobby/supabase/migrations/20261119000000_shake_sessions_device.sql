-- Per-burst device data (location, altitude, model, OS, …) as a JSON object, so new fields need no
-- migration. What `supabase db diff` would generate from schemas/50_shakes.sql.
alter table public.shake_sessions
  add column device jsonb not null default '{}'::jsonb
  constraint shake_sessions_device_check check (jsonb_typeof(device) = 'object');
