# v06 — Supabase backend + email-code / Apple / guest sign-in (SwiftUI)

`HO-States-Users/` is a small SwiftUI app. You sign in either with a 6-digit code that Supabase
Auth emails you, with Sign in with Apple, or as a guest with no email at all. It
lists every user who has signed on and when they were last active. It uses Supabase Auth on the
Pro plan, plus a custom SMTP provider (Resend) for sending email. Apple sign-in is native (no web
OAuth redirect).
`supabase/` holds the database, which is set up so v2 (iOS) and v05 (web) can adopt it later.

```
v06/
  supabase/
    config.toml            local-stack config (anonymous sign-ins, redirect URLs, email templates)
    templates/otp.html     sign-in email: 6-digit code only (copy into the dashboard too)
    schemas/*.sql          ← SOURCE OF TRUTH for the database (edit these)
    migrations/*.sql       ← generated from schemas/ (don't hand-edit, except auth.* triggers)
    seed.sql
  HO-States-Users/
    HO-States-Users.xcodeproj   folder-synced: files added under HOStatesUsers/ join the app
    project.yml            old xcodegen spec, retired (running it undoes folder mode)
    HOStatesUsers/         app sources; Supabase.plist (gitignored) holds URL + key
      Assets.xcassets/AppIcon.appiconset   app icon: one 1024×1024 PNG, no transparency
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

### 2. Plan upgrade (Pro)
**Organization → Billing**: switch to **Pro**. The plan covers the whole organization. Free
projects created after June 3, 2026 can't edit email templates while they use Supabase's
built-in email sender, and the 6-digit code needs a template edit. Pro removes that lock.

### 3. Email code sign-in
In the Supabase Dashboard:
1. **Authentication → Emails → Templates**: paste
   [`supabase/templates/otp.html`](supabase/templates/otp.html) into **both** templates:
   - **Confirm signup**, which is sent to first-time users
   - **Magic Link**, which is sent to returning users

   Set the subject of each to "Your HO States sign-in code". `{{ .Token }}` is the 6-digit code.
   The template leaves out the sign-in link (`{{ .ConfirmationURL }}`) on purpose. The link and
   the code share one single-use token. Mail security scanners (e.g. Microsoft Safe Links on
   school or work mail) and link-tracking email services open every link in an email, which uses
   up the token. The code then fails with "Token has expired or is invalid", and the auth log
   shows a `GET /verify` from an address that isn't yours.
2. **Authentication → Sign In / Providers → Email**: set **Email OTP Length** to `6` and
   **Email OTP Expiration** to `3600` seconds.

Once this is done, you can test with your own address. Even on Pro, the built-in sender only
emails your Supabase organization's team members, about 2 emails an hour ("email rate exceeded").

### 4. Custom SMTP (needed before anyone else can sign in)
1. Sign up at https://resend.com (free tier: 3,000 emails a month, 100 a day). Verify a domain you
   own and create an API key.
2. **Authentication → Emails → SMTP Settings**: turn on custom SMTP and enter:
   - Host `smtp.resend.com`, port `465`
   - User `resend`, password: the API key
   - Sender: an address on your verified domain, with sender name "HO States"
3. **Authentication → Rate Limits**: raise the email limit to something like 30 an hour.

The sender must be on a domain whose DNS you control. A school or work address (e.g. `@nyu.edu`)
fails with `550 The nyu.edu domain is not verified`, which shows up in the app as "Error sending
magic link email". Without your own domain, use Brevo instead: it can verify a single sender
address by email. Its SMTP settings are host `smtp-relay.brevo.com`, port `587`, and the SMTP
login and key from Brevo → SMTP & API.

Any SMTP provider works (Postmark, Brevo, Amazon SES, …).

### 5. Redirect URLs and guest sign-in
1. **Authentication → URL Configuration → Redirect URLs**: add `hostates://auth-callback`. The
   sign-in link returns to the app here (v2 later too). Add `http://localhost:5173` for v05.
2. **Authentication → Sign In / Providers**: turn on **Allow anonymous sign-ins** for the
   "Continue as Guest" button. Email sign-in is already on by default.

### 6. Sign in with Apple
1. **Authentication → Sign In / Providers → Apple**: turn it on and add
   `com.jht1900.HO-States-Users` (the app's bundle id) to **Client IDs**. The native flow sends
   Apple's ID token straight to Supabase, so the Services ID, secret key and callback URL fields
   aren't needed; they're only for web sign-in (v05 later).
2. The app's `HOStatesUsers/HOStatesUsers.entitlements` has the
   Sign in with Apple capability. With automatic signing, Xcode turns it on for the App ID in
   team `3RCW2SSL8G`. Otherwise enable it at developer.apple.com → Identifiers.
3. Push the trigger change: `npx supabase db push` (`migrations/20260924000000_apple_sign_in.sql`).

The simulator needs to be signed in to an Apple Account (Settings) to test this.

### 7. iOS app
```sh
cd v06/HO-States-Users
cp HOStatesUsers/Supabase.example.plist HOStatesUsers/Supabase.plist   # fill in URL + publishable key
open HO-States-Users.xcodeproj
```
The project uses Xcode's synchronized folder, so adding or removing files under `HOStatesUsers/`
needs no project change. It copies everything there into the app except `Info.plist` and
`Supabase*.plist`, which are excluded in the target's folder exceptions. The "Copy Supabase.plist
if present" build script bundles `Supabase.plist` only when it exists.

To change the app icon, replace `Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png` with another
1024×1024 PNG that has no alpha channel (App Store requirement), keeping the name. Or drag an
image onto the AppIcon well in Xcode.
Without `Supabase.plist`, the app still builds and runs, and shows a "Supabase not configured"
screen.

### Local stack (optional, needs Docker/OrbStack)
Run `npx supabase start` and point `Supabase.plist` at `http://127.0.0.1:54321`. No real email is
sent: sign-in emails show up in the local mail catcher at http://127.0.0.1:54324, with no sender
limits. `config.toml` points both templates at `templates/otp.html`, so each email shows the
6-digit code; type it into the simulator. Restart the stack (`npx supabase stop && npx supabase
start`) after changing a template.

## Tools
- [`tools/clear-guest-users.sh`](tools/clear-guest-users.sh) deletes guest users and unknown users
  (no email or phone). Their `profiles` and `app_state` rows are deleted with them, and so are their
  profile photos. It only lists
  them unless you pass `--delete`, and it asks before deleting. The hosted project needs
  `SUPABASE_SECRET_KEY` (Project Settings → API Keys → Secret keys); `--local` targets the local
  stack instead.

## How the app works
- **Email code:** `SignInView` calls `AuthModel.sendSignInEmail`, which calls
  `signInWithOTP(email:redirectTo:)`. That emails a code and creates the user on first
  use. The user types the 6-digit code; `.textContentType(.oneTimeCode)` lets iOS suggest it from
  Mail. When the sixth digit is typed, `verifyCode` calls `verifyOTP(email:token:type: .email)`.
  The code works on any device, so the email can be read on a phone while signing in on the
  simulator.
- **Magic link (not in the current email):** the app still handles a sign-in link, in case a
  template adds `{{ .ConfirmationURL }}` back. Tapping it goes through Supabase and reopens the
  app at `hostates://auth-callback?code=…`. The scheme is registered in `Info.plist`, and `.onOpenURL`
  calls `AuthModel.handleAuthCallback`, which exchanges the code with `session(from:)`. The link
  uses PKCE, so it only works on the device and app install that asked for it. v05 (web) uses the
  same call with its own URL as `redirectTo`.
- **Sign in with Apple:** `SignInView` shows `SignInWithAppleButton`. It asks for name and email
  and puts the SHA-256 of a random nonce in the request. `AuthModel.signInWithApple` passes
  Apple's identity token and the raw nonce to `signInWithIdToken(credentials:)`, which creates the
  user on first use. Apple sends the user's name only the first time they authorize the app, and
  not inside the token, so the app saves it with `auth.update(user:)` as `full_name` in user
  metadata. The `profiles` trigger also fires on metadata changes and copies it to
  `display_name`. If the user picks "Hide My Email", `email` is a `@privaterelay.appleid.com`
  address. To see the name prompt again, remove the app under Settings → Apple Account → Sign in
  with Apple.
- **Guest:** `signInAnonymously()` creates a real user with its own id but no email. Guests can
  see the list and have their own `app_state` like anyone else, and they show up as
  "Guest XXXX" (`profiles.is_anonymous`).
- The Supabase SDK stores the session in the Keychain, so a returning user or guest skips
  sign-in. Signing out as a guest loses that guest account.
- On the first sign-in, a database trigger on `auth.users` creates the `profiles` row. Later
  sign-ins, or a guest adding an email, refresh it.
- `UsersListView` calls the `touch_last_seen()` RPC and then reads `profiles`. It does this on
  appear, on pull-to-refresh, and whenever the app returns to the foreground.
- **Profile photo:** tap a user to see their full-size photo. On your own profile, **Choose
  Photo** opens the system photo picker, which needs no photo-library permission. `ProfilePhoto`
  re-encodes the picked image, often HEIC, as two JPEGs:
  - the full-resolution image
  - a 256px center-cropped square thumbnail

  Re-encoding applies the EXIF orientation and strips metadata such as GPS location.
  `ProfilePhotoService` uploads both files to the public `avatars` bucket as
  `<user id>/<random>-full.jpg` and `…-thumb.jpg`. It then sets `profiles.photo_path` and
  `photo_thumb_path` and deletes the previous pair. The list loads only the thumbnails. Storage
  policies (`schemas/30_profile_photos.sql`) limit each user to writing their own folder. Anyone
  with a file's URL can view it, but the file names are random.

Possible next steps:
- **Guest upgrade:** let a guest add an email with `auth.updateUser(user: .init(email:))`. They
  keep the same id and `app_state`; the `profiles` trigger already handles this.
- **Display name:** a field that saves to `profiles.display_name`.
- **Live updates:** Supabase Realtime on `profiles`.
