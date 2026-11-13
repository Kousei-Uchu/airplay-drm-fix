#!/bin/bash
# Run from a clone of the repo. Records where this copy lives (so the popup can
# show it), copies the path to your clipboard, opens the folder, and opens
# Chrome's extensions page so you can load it. Safe to run again.
set -eu

DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$DIR/manifest.json" ]; then
  echo "Couldn't find manifest.json in $DIR. Run this from a clone of the repo." >&2
  exit 1
fi

# The popup reads this file to show the install location (it is git-ignored).
ESC="$(printf '%s' "$DIR" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
printf '{\n  "path": "%s",\n  "installedAt": "%s"\n}\n' "$ESC" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$DIR/local-install.json"

echo
echo "AirPlay Widevine Fix is at:"
echo "  $DIR"
echo

if [ "$(uname)" = "Darwin" ]; then
  if command -v pbcopy >/dev/null 2>&1; then
    printf '%s' "$DIR" | pbcopy
    echo "(That path is on your clipboard.)"
  fi
  open "$DIR" >/dev/null 2>&1 || true
  if ! open -a "Google Chrome" "chrome://extensions" >/dev/null 2>&1; then
    echo "Couldn't open Chrome automatically. Open chrome://extensions yourself."
  fi
else
  echo "Open chrome://extensions in your browser."
fi

cat <<'STEPS'

Chrome has no supported way to install an unpacked extension silently, so the
last few clicks are yours:

  1. On chrome://extensions, switch on "Developer mode" (top right).
  2. Click "Load unpacked".
  3. In the file picker press Cmd+Shift+G, paste the path (Cmd+V), press Return,
     then click "Select".
  4. Optional: pin it from the puzzle-piece menu in the toolbar.

Once loaded it stays installed across restarts, as long as this folder stays
where it is. Updating later: the extension's popup gives you the command, or run
  git -C "<this folder>" pull --ff-only
then press "Restart extension" in the popup.

To remove it: click Remove on chrome://extensions, then delete this folder.
STEPS
