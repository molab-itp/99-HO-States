#!/usr/bin/env bash
# Deletes users from Supabase Auth: by default guest users (anonymous sign-ins) and unknown users
# (no email, no phone); with --email, only the users with those email addresses. Their `profiles`
# and `app_state` rows go with them (`on delete cascade`); their profile photos in the `avatars`
# bucket are deleted first, since Storage files don't cascade.
#
# Uses the Auth Admin API, so it needs a secret key (never commit it):
#   hosted:  Dashboard → Project Settings → API Keys → Secret keys (sb_secret_…)
#
# Usage (from anywhere):
#   SUPABASE_SECRET_KEY=sb_secret_… v06/tools/clear-users.sh          # list guest/unknown users (dry run)
#   SUPABASE_SECRET_KEY=sb_secret_… v06/tools/clear-users.sh --delete # actually delete them
#   … v06/tools/clear-users.sh --email a@b.com [--delete]             # that user instead; repeat
#                                                                     # --email for several
#   v06/tools/clear-users.sh --local [--email …] [--delete]           # local stack; key read
#                                                                     # from `supabase status`
# The hosted URL comes from SUPABASE_URL, else from the app's Supabase.plist.
set -euo pipefail

cd "$(dirname "$0")/.."   # v06/

command -v jq >/dev/null || { echo "Needs jq: brew install jq" >&2; exit 1; }

delete=false
local_stack=false
emails='[]'   # JSON array of lowercased addresses; empty means guest/unknown users
while (( $# > 0 )); do
  case "$1" in
    --delete) delete=true ;;
    --local) local_stack=true ;;
    --email|--email=*)
      if [[ "$1" == --email=* ]]; then email=${1#--email=}; else shift; email=${1:-}; fi
      [[ "$email" == ?*@?* ]] || { echo "--email needs an email address" >&2; exit 1; }
      emails=$(jq -c --arg e "$email" '. + [$e | ascii_downcase] | unique' <<<"$emails")
      ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

if $local_stack; then
  status_env=$(npx supabase status -o env 2>/dev/null) || { echo "Local stack isn't running: npx supabase start" >&2; exit 1; }
  url=$(sed -n 's/^API_URL="\(.*\)"$/\1/p' <<<"$status_env")
  key=$(sed -n -e 's/^SECRET_KEY="\(.*\)"$/\1/p' <<<"$status_env")
  [[ -n "$key" ]] || key=$(sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p' <<<"$status_env")
else
  # PlistBuddy reports a missing file or key on stdout, so only keep its output when it succeeds.
  plist=HO-States-Users/HOStatesUsers/Supabase.plist
  url=${SUPABASE_URL:-}
  if [[ -z "$url" && -f "$plist" ]]; then
    url=$(/usr/libexec/PlistBuddy -c "Print :SUPABASE_URL" "$plist" 2>/dev/null) || url=
  fi
  key=${SUPABASE_SECRET_KEY:-}
fi
url=$(tr -d '[:space:]' <<<"$url")
url=${url%/}
[[ -n "$url" ]] || { echo "No project URL: set SUPABASE_URL (https://<project-ref>.supabase.co), or create v06/HO-States-Users/HOStatesUsers/Supabase.plist" >&2; exit 1; }
[[ "$url" =~ ^https?://[^/]+$ && "$url" != *YOUR-PROJECT-REF* ]] || { echo "Not a valid project URL: $url" >&2; exit 1; }
[[ -n "$key" ]] || { echo "No secret key: set SUPABASE_SECRET_KEY (sb_secret_…)" >&2; exit 1; }

# New sb_secret_ keys go in `apikey` only; legacy service_role JWTs also need Authorization.
headers=(-H "apikey: $key")
[[ "$key" == sb_* ]] || headers+=(-H "Authorization: Bearer $key")

api() { curl -sS --fail-with-body "${headers[@]}" "$@"; }

# Deletes everything in a user's `avatars/<id>/` folder (see supabase/schemas/30_profile_photos.sql).
delete_photos() {
  local names
  names=$(api -X POST "$url/storage/v1/object/list/avatars" -H 'Content-Type: application/json' \
    -d "{\"prefix\":\"$1/\",\"limit\":1000}" | jq -c --arg id "$1" '[.[] | "\($id)/\(.name)"]')
  [[ "$names" == "[]" ]] && return 0
  api -X DELETE "$url/storage/v1/object/avatars" -H 'Content-Type: application/json' \
    -d "{\"prefixes\":$names}" >/dev/null
}

# Collect every user, page by page.
per_page=1000
page=1
all='[]'
while :; do
  batch=$(api "$url/auth/v1/admin/users?page=$page&per_page=$per_page" | jq '.users')
  all=$(jq -s 'add' <(echo "$all") <(echo "$batch"))
  (( $(jq length <<<"$batch") < per_page )) && break
  page=$((page + 1))
done

if [[ "$emails" == "[]" ]]; then
  what="guest/unknown"
  targets=$(jq '[.[] | select(
      .is_anonymous == true
      or (((.email // "") == "") and ((.phone // "") == ""))
    ) | {id, kind: (if .is_anonymous then "guest" else "unknown" end), created_at, last_sign_in_at}]' <<<"$all")
else
  what="matching --email"
  targets=$(jq --argjson emails "$emails" '[.[] | (.email // "" | ascii_downcase) as $e
    | select($emails | index($e))
    | {id, kind: $e, created_at, last_sign_in_at}]' <<<"$all")
  jq -r --argjson emails "$emails" '$emails - [.[].kind] | .[] | "No user with email \(.)"' <<<"$targets" >&2
fi

count=$(jq length <<<"$targets")
echo "$url: $(jq length <<<"$all") users, $count $what"
jq -r '.[] | "  \(.kind)\t\(.id)\tcreated \(.created_at[0:16])\tlast sign-in \((.last_sign_in_at // "never")[0:16])"' <<<"$targets"

(( count > 0 )) || exit 0
if ! $delete; then
  echo "Dry run. Re-run with --delete to remove them."
  exit 0
fi

read -r -p "Delete these $count users? [y/N] " answer
[[ "$answer" == [yY]* ]] || { echo "Cancelled."; exit 0; }

failed=0
for id in $(jq -r '.[].id' <<<"$targets"); do
  if delete_photos "$id" && api -X DELETE "$url/auth/v1/admin/users/$id" >/dev/null; then
    echo "  deleted $id"
  else
    echo "  FAILED  $id" >&2
    failed=$((failed + 1))
  fi
done
echo "Deleted $((count - failed)) of $count."
(( failed == 0 ))
