# v06 — Supabase backend + magic-link / guest sign-in (SwiftUI)

`HO-States-Users/` is a small SwiftUI app. You sign in either with a link that Supabase Auth
emails you, or as a guest with no email at all. It lists every user who has signed on and when
they were last active. It uses only Supabase services on the free plan: no Google/Apple OAuth
setup, and no email-template edits.
`supabase/` holds the database, which is set up so v2 (iOS) and v05 (web) can adopt it later.

```
v06/
  supabase/
    config.toml            local-stack config (anonymous sign-ins, redirect URLs, schema_paths)
    schemas/*.sql          ← SOURCE OF TRUTH for the database (edit these)
    migrations/*.sql       ← generated from schemas/ (don't hand-edit, except auth.* triggers)
    seed.sql
  HO-States-Users/
    project.yml            xcodegen spec → HO-States-Users.xcodeproj
    HOStatesUsers/         app sources; Supabase.plist (gitignored) holds URL + key
```

## Database architecture: rapid schema changes with few migrations

There are two layers.

1. **Declarative schema files** (`supabase/schemas/`). You edit the desired end state of a table
   in place, as a normal `create table …` file. You never write `alter table` by hand. The CLI
   diffs the schema files against the migration history and writes the migration for you:

   ```sh
   # edit supabase/schemas/10_profiles.sql, e.g. add a column
   npx supabase db diff -f add_profile_bio   # writes migrations/<ts>_add_profile_bio.sql
   npx supabase db push                      # applies it to the linked hosted project
   ```

   Migrations become build output that you review but don't author, so the usual problems don't
   come up: no hand-written ALTERs, no ordering mistakes, and no drift between "what the schema
   is" and "what the migrations add up to". `schemas/` is always the readable current schema.

2. **Schemaless app state** (`public.app_state`, a `jsonb` document per user + app + key). Per-app
   state that changes often, like v2's `AppState.json` (slideIndex, shuffle, reactions,
   imageZoomStates) and v05's localStorage blob, goes here as-is. Adding or renaming a field is a
   change to the Swift `Codable` / JS object only, and needs **no migration**. v2 and v05 both use
   `app = 'ho-states'`, so the same row keeps iOS and web in sync.
   [`AppStateStore.swift`](HO-States-Users/HOStatesUsers/Services/AppStateStore.swift) is the
   ready-to-copy Swift client for this table.

   Promote a field out of the JSON into a typed table only once you need to query it across users
   (e.g. "most-hearted president overall"). That's a normal declarative edit plus `db diff`.

Rules that keep this painless:
- Every table has RLS enabled in the same file that creates it (users read and write only their
  own `app_state`; any signed-in user can read `profiles`).
- `db diff` ignores Supabase-owned schemas. The `auth.users → profiles` trigger in
  `10_profiles.sql` is the one thing to hand-copy into a migration if you ever change it.
- `db diff` needs Docker (or OrbStack) for its throwaway shadow database. Neither is installed
  here yet: `brew install --cask orbstack`. That's why the first migration,
  `migrations/20260923000000_init.sql`, is a straight concatenation of `schemas/*.sql`.
- Typed clients for v05, when you get there: `npx supabase gen types typescript --linked > src/db.types.ts`.

## One-time setup

### 1. Supabase project
1. Create a project at https://supabase.com/dashboard.
2. Link and push the schema from `v06/`:
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

### 2. Auth settings (all free plan)
In the Supabase Dashboard:
1. **Authentication → URL Configuration → Redirect URLs**: add `hostates://auth-callback`. This
   is where the magic link returns to the app (v2 later too). Add `http://localhost:5173` for v05.
2. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins** for the
   "Continue as Guest" button. Email sign-in is already on by default.

The default email templates already contain the sign-in link, so they don't need editing (which
the free plan no longer allows with Supabase's built-in email sender).

**Email limitation:** Supabase's built-in email sender only delivers to the email addresses of
your Supabase organization's team members, a few per hour. That's enough to test magic links
yourself. Anyone else should use **Continue as Guest** until you add a custom SMTP provider (Resend,
Brevo, …) under **Authentication → Emails → SMTP Settings**, which removes the limit.

### 3. iOS app
```sh
cd v06/HO-States-Users
cp HOStatesUsers/Supabase.example.plist HOStatesUsers/Supabase.plist   # fill in URL + publishable key
xcodegen generate            # only needed after adding/removing Swift files
open HO-States-Users.xcodeproj
```
Without `Supabase.plist`, the app still builds and runs, and shows a "Supabase not configured"
screen.

### Local stack (optional, needs Docker/OrbStack)
Run `npx supabase start` and point `Supabase.plist` at `http://127.0.0.1:54321`. No real email is
sent: magic links show up in the local mail catcher at http://127.0.0.1:54324, with no sender
limits. Open that page in the simulator's Safari and tap the link.

## How the app works
- **Magic link:** `SignInView` calls `signInWithOTP(email:redirectTo:)`, which emails a link and
  creates the user on first use. Tapping the link in Mail goes through Supabase and reopens the app
  at `hostates://auth-callback?code=…`. The scheme is registered in `project.yml`, and `.onOpenURL`
  calls `AuthModel.handleAuthCallback`, which exchanges the code with `session(from:)`. The link
  uses PKCE, so it only works on the device and app install that asked for it. v05 (web) uses the
  same call with its own URL as `redirectTo`.
- **Guest:** `signInAnonymously()` creates a real user with its own id but no email. Guests can
  see the list and have their own `app_state` like anyone else, and they show up as
  "Guest XXXX" (`profiles.is_anonymous`).
- The Supabase SDK stores the session in the Keychain, so a returning user or guest skips
  sign-in. Signing out as a guest loses that guest account.
- On the first sign-in, a database trigger on `auth.users` creates the `profiles` row. Later
  sign-ins, or a guest adding an email, refresh it.
- `UsersListView` calls the `touch_last_seen()` RPC and then reads `profiles`. It does this on
  appear, on pull-to-refresh, and whenever the app returns to the foreground.

Possible next steps:
- **Guest upgrade:** let a guest add an email with `auth.updateUser(user: .init(email:))`. They
  keep the same id and `app_state`; the `profiles` trigger already handles this.
- **Display name:** a field that saves to `profiles.display_name`.
- **Live updates:** Supabase Realtime on `profiles`.
