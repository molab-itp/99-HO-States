#!/usr/bin/env bash
# Commit and push the current branch with the last vNN.NN entry in
# _prompts.txt as the message, fast-forward main to it, push main,
# then switch back.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

PROMPTS=_prompts.txt
MAIN=main

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" = "$MAIN" ]; then
  echo "Already on $MAIN; switch to the branch to publish." >&2
  exit 1
fi

# Last entry: from the last line starting with vNN.NN to end of file.
msg=$(awk '
  /^v[0-9]+\.[0-9]+/ { buf = ""; found = 1 }
  found { buf = buf $0 "\n" }
  END { printf "%s", buf }
' "$PROMPTS")

if [ -z "$msg" ]; then
  echo "No v?.? entry found in $PROMPTS" >&2
  exit 1
fi

echo "Publishing $branch -> $MAIN with message:"
echo "----"
echo "$msg"
echo "----"

# Commit any pending changes on the branch, then push it.
git add -A
if ! git diff --cached --quiet; then
  git commit -m "$msg"
fi
git push origin "$branch"

git switch "$MAIN"
trap 'git switch "$branch"' EXIT

git merge --ff-only "$branch"

git push origin "$MAIN"

echo "Fast-forwarded $MAIN to $branch and pushed."
