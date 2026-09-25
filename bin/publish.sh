#!/usr/bin/env bash
# Merge the current branch into main, using the last vNN.NN entry
# in _prompts.txt as the merge commit message, then switch back.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

PROMPTS=_prompts.txt
MAIN=main

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" = "$MAIN" ]; then
  echo "Already on $MAIN; switch to the branch to publish." >&2
  exit 1
fi

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Working tree has uncommitted changes; commit them first." >&2
  git status --short --untracked-files=no >&2
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

git switch "$MAIN"
trap 'git switch "$branch"' EXIT

git merge --no-ff "$branch" -F <(printf "%s\n\n(merge %s)\n" "$msg" "$branch")

echo "Merged $branch into $MAIN."
