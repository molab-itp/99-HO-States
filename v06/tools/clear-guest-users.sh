#!/usr/bin/env bash
# Deletes guest users (anonymous sign-ins) and unknown users (no email, no phone) from Supabase
# Auth. Their `profiles` and `app_state` rows go with them (`on delete cascade`).
#
# Uses the Auth Admin API, so it needs a secret key (never commit it):
#   hosted:  Dashboard → Project Settings → API Keys → Secret keys (sb_secret_…)
#
# Usage (from anywhere):
#   SUPABASE_SECRET_KEY=sb_secret_… v06/tools/clear-guest-users.sh          # list only (dry run)
#   SUPABASE_SECRET_KEY=sb_secret_… v06/tools/clear-guest-users.sh --delete # actually delete
#   v06/tools/clear-guest-users.sh --local [--delete]                      # local stack; key read
#                                                                           # from `supabase status`
# The hosted URL comes from SUPABASE_URL, else from the app's Supabase.plist.
set -euo pipefail

cd "$(dirname "$0")/.."   # v06/

delete=false
local_stack=false
for arg in "$@"; do
  case "$arg" in
    --delete) delete=true ;;
    --local) local_stack=true ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

command -v jq >/dev/null || { echo "Needs jq: brew install jq" >&2; exit 1; }

if $local_stack; then
  status_env=$(npx supabase status -o env 2>/dev/null) || { echo "Local stack isn't running: npx supabase start" >&2; exit 1; }
  url=$(sed -n 's/^API_URL="\(.*\)"$/\1/p' <<<"$status_env")
  key=$(sed -n -e 's/^SECRET_KEY="\(.*\)"$/\1/p' <<<"$status_env")
  [[ -n "$key" ]] || key=$(sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p' <<<"$status_env")
else
  url=${SUPABASE_URL:-$(/usr/libexec/PlistBuddy -c "Print :SUPABASE_URL" HO-States-Users/HOStatesUsers/Supabase.plist 2>/dev/null || true)}
  key=${SUPABASE_SECRET_KEY:-}
fi
[[ -n "$url" ]] || { echo "No project URL: set SUPABASE_URL" >&2; exit 1; }
[[ -n "$key" ]] || { echo "No secret key: set SUPABASE_SECRET_KEY (sb_secret_…)" >&2; exit 1; }

# New sb_secret_ keys go in `apikey` only; legacy service_role JWTs also need Authorization.
headers=(-H "apikey: $key")
[[ "$key" == sb_* ]] || headers+=(-H "Authorization: Bearer $key")

api() { curl -sS --fail-with-body "${headers[@]}" "$@"; }

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

targets=$(jq '[.[] | select(
    .is_anonymous == true
    or (((.email // "") == "") and ((.phone // "") == ""))
  ) | {id, kind: (if .is_anonymous then "guest" else "unknown" end), created_at, last_sign_in_at}]' <<<"$all")

count=$(jq length <<<"$targets")
echo "$url: $(jq length <<<"$all") users, $count guest/unknown"
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
  if api -X DELETE "$url/auth/v1/admin/users/$id" >/dev/null; then
    echo "  deleted $id"
  else
    echo "  FAILED  $id" >&2
    failed=$((failed + 1))
  fi
done
echo "Deleted $((count - failed)) of $count."
(( failed == 0 ))
