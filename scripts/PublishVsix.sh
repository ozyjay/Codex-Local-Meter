#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: ./scripts/PublishVsix.sh [none|patch|minor|major]

Builds a release VSIX using the existing packaging flow, publishes the newest
generated package to the VS Code Marketplace, then verifies the Marketplace item.

Authentication is handled by vsce. Run `npx vsce login CrunchyCodes` first, or
set VSCE_PAT in your shell before invoking this script.
USAGE
}

BUMP="${1:-none}"

case "$BUMP" in
  none|patch|minor|major)
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

PUBLISHER="$(node -p "require('./package.json').publisher")"
PACKAGE_NAME="$(node -p "require('./package.json').name")"
ITEM_NAME="$PUBLISHER.$PACKAGE_NAME"

echo "Codex Local Meter Marketplace publish"
echo "Repository: $REPO_ROOT"
echo "Marketplace item: $ITEM_NAME"
echo "Version bump: $BUMP"
echo

if [[ "$BUMP" == "none" ]]; then
  npm run package:vsix
else
  npm run package:"$BUMP"
fi

PACKAGE_PATH="$(find "$REPO_ROOT" -maxdepth 1 -name '*.vsix' -type f -print0 |
  xargs -0 ls -t |
  head -n 1)"

if [[ -z "$PACKAGE_PATH" ]]; then
  echo "Packaging completed but no .vsix file was found." >&2
  exit 1
fi

echo
echo "Publishing: $PACKAGE_PATH"
npx vsce publish --packagePath "$PACKAGE_PATH"

echo
echo "Verifying published extension..."
npx vsce show "$ITEM_NAME"

echo
echo "Published: $ITEM_NAME"
