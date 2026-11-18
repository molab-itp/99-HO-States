-- Admins can clear anyone's shake stats (UsersListView ▸ Actions ▸ Clear Shake Stats).
drop policy "Users can delete their own shake sessions" on public.shake_sessions;

create policy "Users can delete their own shake sessions, admins anyone's"
  on public.shake_sessions for delete
  to authenticated
  using ((select auth.uid()) = user_id or (select public.is_admin()));
