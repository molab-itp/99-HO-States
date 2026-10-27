# v07 — HOS-Lobby (React)

A web port of the [v06](../v06) SwiftUI app (`HOS-Lobby.xcodeproj`), built with React + Vite and
hosted on GitHub Pages at https://molab-itp.github.io/99-HO-States/v07/.

It does what v06 does: sign in with a 6-digit code that Supabase Auth emails you, with Sign in
with Apple, or as a guest; see every user who has signed on and when they were last active, live;
set, crop and restore your profile photo; and, for admins, check users and delete them from an
Actions menu.

It uses v06's Supabase project as it is. Nothing under [`v06/supabase/`](../v06/supabase) changes,
and a user sees the same list, photos and live banners in both apps.

## Running

```sh
cd v07
npm install
cp .env.example .env.local   # fill in the URL + publishable key, as in v06's Supabase.plist
npm run dev                  # http://localhost:5173
```

Without `.env.local`, the app still builds and runs, and shows a "Supabase not configured"
screen.

`npm run smoke` drives the app in headless Chromium through sign-in, the list, live updates,
admin delete and the photo flows, and saves screenshots to `playwright/screenshots/`. It answers
every Supabase request from a stand-in inside the script, so it needs no project and creates no
users. It checks the app, not the database, its policies or the email.

## One-time setup

The app needs three things that v06 didn't. None of them is done yet.

### 1. Repository variables, for the Pages build

The Supabase URL and key are baked into the build. The
[Pages workflow](../.github/workflows/deploy-pages.yml) reads them from repository variables
(**Settings → Secrets and variables → Actions → Variables**):

```sh
gh variable set SUPABASE_URL --body "https://<your-project-ref>.supabase.co"
gh variable set SUPABASE_PUBLISHABLE_KEY --body "sb_publishable_…"
```

Until they're set, the published page shows "Supabase not configured". The publishable key is
meant to be public (it's in the page's JavaScript either way); RLS is what protects the data.

### 2. Redirect URL

**Authentication → URL Configuration → Redirect URLs**: add
`https://molab-itp.github.io/99-HO-States/v07/`, next to the `http://localhost:5173` that v06's
setup lists for local development. Sign in with Apple returns to this address, and so would a sign-in link if a
template ever adds one back. The email code and guest sign-in work without it.

### 3. Sign in with Apple, for the web

v06's native flow needs only the app's bundle id. A web page goes through Apple's own sign-in
page instead, which needs more:

1. At developer.apple.com → **Identifiers**, create a **Services ID** (e.g.
   `com.jht1900.HO-States-Users.web`) with Sign in with Apple turned on. Under its configuration,
   add the domain `<your-project-ref>.supabase.co` and the return URL
   `https://<your-project-ref>.supabase.co/auth/v1/callback`.
2. Under **Keys**, create a key with Sign in with Apple enabled and download the `.p8` file.
3. In the Supabase dashboard, **Authentication → Sign In / Providers → Apple**: add the Services
   ID to **Client IDs** (next to the bundle id, comma-separated) and fill in the secret key that
   Supabase generates from the `.p8` file, team id and key id. That secret expires after six
   months and has to be generated again.

Until this is done the button leads to an error page from Supabase. The other two ways of signing
in aren't affected.

## Structure

Each file is a port of the Swift file of the same name.

```
v07/
  .env.example             copy to .env.local (gitignored): URL + publishable key
  scripts/smoke.mjs        headless smoke test against a stand-in Supabase
  src/
    App.jsx                HOS_LobbyApp: creates the Supabase client, or shows what's missing
    supabaseConfig.js      SupabaseConfig
    models/
      profile.js           Profile: the display name, list order, "5 minutes ago"
      profilePhoto.js      ProfilePhoto: JPEG re-encoding, crop and thumbnail, on a canvas
      userEvent.js         UserEvent: the banner text
    services/
      AuthContext.jsx      AuthModel, as a context: useAuth()
      profilesService.js   ProfilesService: profiles, Realtime, RPCs, the delete-user function
      profilePhotoService.js  ProfilePhotoService: the avatars bucket
      appStateStore.js     AppStateStore: unused here, as in v06; the client for v05 to copy
    views/
      RootView.jsx, SignInView.jsx, UsersListView.jsx, ProfileRow.jsx, ProfileDetailView.jsx,
      PhotoCropView.jsx, SetupRequiredView.jsx, AppVersionLabel.jsx
      useSelectedUser.js   the navigation path, kept in the address
    components/            NavBar, Avatar, Spinner, Icon (Bootstrap Icons, as in v05)
```

## Differences from v06

- **Sign in with Apple** leaves the page for Apple's and comes back, instead of the system sheet
  (see setup above).
- **Session:** the Supabase SDK keeps it in the browser's local storage, not the Keychain. A
  returning user or guest still skips sign-in. It's per browser, so the web app and the iOS app
  sign in separately, and a guest is a different guest in each.
- **Refresh** is a button in the navigation bar, in place of pull-to-refresh. The list also
  reloads when the tab comes back to the front.
- **Actions menu** (admins): a popover under the button stands in for SwiftUI's `Menu`.
- **Page links:** a profile's address is `…/v07/#/user/<id>`, so the browser's Back button
  returns to the list and a profile can be bookmarked.
- **Choosing a photo** uses the browser's file picker; on a phone that offers the photo library
  and the camera. HEIC photos only work in Safari, which is the only browser that decodes them.
  iOS Safari usually hands the page a JPEG anyway.
- **Photo size:** a photo longer than 4096 pixels on a side is scaled down to that, because
  browsers limit how large a canvas can be. v06 keeps every pixel.
- **Version label** shows `version` from `package.json`. There's no build number.
- **No magic-link scheme:** `hostates://auth-callback` is the iOS app's. Here a sign-in link
  would return to the page's own address.
