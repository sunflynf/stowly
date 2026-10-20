#!/usr/bin/env bash
# Copies docs/wiki/*.md into the GitHub wiki and pushes it.
# The wiki must exist first: open the repo's Wiki tab and save any first page.
set -euo pipefail

repo_url="$(git remote get-url origin)"
wiki_url="${repo_url%.git}.wiki.git"
src="$(cd "$(dirname "$0")/../docs/wiki" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git clone --depth 1 "$wiki_url" "$tmp/wiki"
cp "$src"/*.md "$tmp/wiki/"
cd "$tmp/wiki"
git add -A
if git diff --cached --quiet; then
  echo "Wiki already up to date."
  exit 0
fi
git commit -m "Update wiki from docs/wiki"
git push
echo "Wiki published."
