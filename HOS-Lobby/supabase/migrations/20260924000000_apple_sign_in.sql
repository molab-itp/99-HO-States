-- Sign in with Apple: the app saves Apple's name to `raw_user_meta_data.full_name` after the first
-- sign-in, so the `profiles` trigger now also fires on metadata changes to pick it up as
-- `display_name`. Hand-copied from schemas/10_profiles.sql, since db diff doesn't see triggers on
-- `auth.users`.

drop trigger if exists on_auth_user_signed_in on auth.users;

create trigger on_auth_user_signed_in
  after insert or update of email, is_anonymous, last_sign_in_at, raw_user_meta_data on auth.users
  for each row execute function public.sync_profile_from_auth_user();
