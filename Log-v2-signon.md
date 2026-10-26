# v2 sign-in: recommendations

2026-10-26. How to add the v06 sign-in to v2 (HOS-USnA), and what it means for v2 to use the same Supabase database as v06, v07 and v05.

## How to bring sign-in into v2

**1. Copy a small set of files and keep v06 as the source of truth.** v2 already uses a synchronized folder, so new files are picked up without editing the project. Put them in `v2/HOS-USnA/HOS-USnA/Account/`:

| From v06 | Notes |
|---|---|
| [SupabaseConfig.swift](v06/HOS-Lobby/HOS_Lobby/SupabaseConfig.swift) | Change `authRedirectURL` (see the URL scheme risk below) |
| [AuthModel.swift](v06/HOS-Lobby/HOS_Lobby/Services/AuthModel.swift) | Copy as is |
| [SignInView.swift](v06/HOS-Lobby/HOS_Lobby/Views/SignInView.swift), [SetupRequiredView.swift](v06/HOS-Lobby/HOS_Lobby/Views/SetupRequiredView.swift) | Copy as is |
| [AppStateStore.swift](v06/HOS-Lobby/HOS_Lobby/Services/AppStateStore.swift) | It was written for v2, so copy as is |
| `ProfilesService.markSignedOut` / `touchLastSeen` only | `AuthModel.signOut` calls `markSignedOut`. Copy just these two functions, or drop the call |

Add a one-line comment at the top of each copy pointing back to the v06 original. If a third app ever needs sign-in, turn these files into a local Swift package (for example `shared/HOSAuth`) and stop copying.

**2. Project setup, matching what v06 does:**
- Add the `supabase-swift` SPM package (2.55+). v2's deployment target of 18.0 is fine.
- Add a gitignored `Supabase.plist` and a `Supabase.example.plist`. Exclude both from the synchronized folder, and add the "Copy Supabase.plist if present" build script so a fresh clone still builds.
- Add `HOS-USnA.entitlements` with Sign in with Apple, and set `CODE_SIGN_ENTITLEMENTS`.

**3. Make sign-in optional.** v06 shows `SignInView` until you sign in, through `RootView`. v2 is a content app that works offline, so it should keep working signed out, using local `AppState.json` exactly as it does now. Add an Account row (in Landing or Credits) that opens `SignInView` in a sheet and shows the signed-in user. Create the `AuthModel` in `HOS_USnA_App` the same way v06 does. If the plist is missing, simply hide the Account feature instead of showing `SetupRequiredView` full screen.

**4. Turn on sync in stages:**
1. Sign-in only, with nothing synced. This lets you check that the profiles and lobby behave as expected.
2. Upload and download `app_state` in the existing `scenePhase == .background` hook, plus a load right after sign-in.

## What sharing the database means

**Auth and identity**
- **Email code:** the same email gives the same `auth.users` row in v2, v06 and v07. This works now.
- **Apple:** v2's bundle id `com.jht1900.HO-States-US` must be added to the Supabase Apple provider's **Client IDs**, comma-separated next to `com.jht1900.HO-States-Users`. Also add it to `v06/supabase/config.toml`. Both apps are on team `3RCW2SSL8G`, so a given Apple ID should produce the same `sub` and therefore the same Supabase user.
- **Guests:** each guest session is tied to one install. A guest in v2 is a different user from a guest in v06, so they show up as an extra "Guest XXXX" in the lobby.
- **Sessions are stored in each app's own Keychain.** Signing into v06 does not sign you into v2. You can get single sign-on later with a shared Keychain access group and a custom `AuthLocalStorage`. It's optional.
- **URL scheme risk:** don't register `hostates` again in v2. If two apps register the same scheme, iOS picks one of them unpredictably. Since sign-in uses the 6-digit code, v2 doesn't need a scheme at all. If you do want the magic link, use something like `hostates-usna://auth-callback` and add it to the Redirect URLs.

**Profiles and lobby**
- Every v2 sign-in fires the `auth.users` trigger. That means v2 users appear in the v06/v07 lobby, and their sign-ins and sign-outs show up there as banners. If you want that, have v2 call `touch_last_seen()` so it counts as activity. If you'd rather v2 users stay quiet, skip `mark_signed_out()`.
- The lobby can't currently tell which app someone used. If that matters, add a `last_app text` column through the normal declarative edit plus `db diff`.

**`app_state` (the main risk)**
- `upsert` replaces the whole document, so the last write wins. Two devices, or v2 plus the v05 web app (both use `app = 'ho-states'`), will overwrite each other. Choose a rule:
  - On first sign-in, upload local state if the remote row is empty. Otherwise ask, or let the remote win.
  - After that, compare `updated_at` before saving, or merge per field. Reactions can be unioned per HOS.
- Some of `PersistedState` only makes sense on one device:
  - `drawingFileNames` points at local PNGs. Synced to another device, it's a dangling reference.
  - `shuffledIndexes`/`slideIndex` depend on `hosList.count`, and `screen` is UI position.
  - Sync only the portable fields (reactions, zoom states, drawing display modes, `greatestShownAt`), or keep the device-local ones under a separate `key`.
- Syncing drawings would need a new `drawings` Storage bucket with policies, hand-copied into a migration the way `30_profile_photos.sql` is. `delete-user` and `clear-users.sh` would then also need to delete those files.

**Schema ownership**
- Keep a single `supabase/` folder in v06. v2 never gets its own. Any change for v2 is made in `v06/supabase/schemas` and pushed from v06.
- Each change also means re-checking v07 and v05, as happened with captions.
- When you change `app_state`'s JSON shape, bump `schema_version` and upgrade old documents in each client.

**Shared limits:** the email rate limit (about 30 an hour on Resend) and the anonymous sign-in limit (30 an hour per IP) now cover all apps together.

**App Store requirements**
- An app that lets people create accounts must also let them delete their own account in the app (guideline 5.1.1(v)). `delete-user` currently allows only admins and blocks deleting yourself. Add a self-delete path to the function, or write a new `delete-me` function, and offer it in v2 (and ideally v06).
- Update v2's privacy nutrition label (email and user ID are now collected).

## Suggested order

1. Step 1 with sign-in only.
2. The Apple Client ID and self-delete.
3. `app_state` sync with an explicit conflict rule, with drawings left out.
