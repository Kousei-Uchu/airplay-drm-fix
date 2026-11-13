# AirPlay Widevine Fix

A small browser extension for a common annoyance: when you AirPlay from a non-Apple browser (Chrome, Edge and other Chromium-based browsers), Widevine-protected video can show up as a black screen on the AirPlay device.

## What it actually does

Honestly, not much. The whole fix is applying a small CSS style change to the page's `<video>` element:

```css
filter: sepia(0%);
opacity: 0.9999;
mix-blend-mode: normal;
```

That's it. It doesn't touch DRM, doesn't decrypt anything, doesn't change network requests, and doesn't read the page or your account. The code that does the work is one short file ([`content.js`](content.js)) and you're welcome to read it.

## Why this might help

I don't have a definitive explanation, so treat this as an educated guess. Hardware-accelerated video playback is a likely contributor to the black screen: protected video can be drawn on a hardware overlay that doesn't get passed along properly when mirroring or casting. Giving the video element a style that looks identical but nudges the browser to composite it differently seems to be enough to avoid that in many cases.

No guarantees. It's a workaround, not a proper fix, and it may not work on every browser version, OS, or site. If it doesn't help, it's harmless to remove.

## Install on a Mac

Paste this into Terminal. It needs nothing installed beyond `git`, which macOS offers to install the first time you use it:

```bash
D="$HOME/.local/share/airplay-drm-fix"; { git clone https://github.com/Kousei-Uchu/airplay-drm-fix.git "$D" || git -C "$D" pull --ff-only; } && bash "$D/scripts/install.sh"
```

What that does:

- Clones this repo into `~/.local/share/airplay-drm-fix`. It's deliberately tucked away so it stays tidy and doesn't get deleted by accident.
- Runs [`scripts/install.sh`](scripts/install.sh) (short, worth a read), which records where the folder is, copies the path to your clipboard, opens the folder, and opens `chrome://extensions`.
- Prints the last few steps. Chrome has no supported way to silently install an unpacked extension, so you switch on **Developer mode**, click **Load unpacked**, press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd>, paste the path, and select the folder.

Once loaded, it stays installed across restarts as long as the folder stays where it is. Running the command again is safe; it just updates the clone and re-prints the steps.

### Other browsers or systems

Any Chromium-based browser works the same way: open its extensions page (`edge://extensions`, `brave://extensions`, and so on), enable developer mode, and load the folder. On other systems, clone the repo anywhere you like and load that folder.

## Using it

Click the extension icon.

**Main tab**

- **On/off switch.** Applies straight away; refresh the page if the video doesn't change.
- **Updates.** A **Check for updates** button, plus an optional automatic check (see below).
- **Where this lives.** Shows the folder the extension is running from, with **Open folder** and **Copy path** buttons, so you can always see exactly what's installed and where.
- **Restart extension.** Reloads the extension from disk. Use it after updating the clone.

**Advanced tab**

Everything that's hard-coded by default can be changed here, behind a warning and an "I know what I'm doing" button:

- **Sites** the fix runs on. Subdomains are included. Chrome asks for permission for each site you add, and the permission is removed again if you remove the site.
- **How to find the element**: a CSS selector (a full CSS path like `#player > video` is just a longer selector) or an XPath, and whether to style the first match or every match.
- **The CSS** to apply, as plain declarations (`property: value;`).

**Reset to defaults** puts everything back. Don't change these unless you know what you're doing; wrong values can stop the fix working or restyle the wrong things on a page.

Your changes are stored in the browser, not in the repo folder, so updating the clone never conflicts with them.

## Updating

The extension checks this repo's [latest GitHub release](https://github.com/Kousei-Uchu/airplay-drm-fix/releases/latest) every few hours (you can turn that off, or press **Check for updates** whenever you like). If there's a newer one, the toolbar icon shows a small arrow and the popup shows a banner with a **Copy update command** button.

That command updates your local clone to the release (a `git fetch` and fast-forward merge, nothing else). Paste it into Terminal, then press **Restart extension** in the popup. The extension never downloads or installs anything itself, and you can also just run `git -C ~/.local/share/airplay-drm-fix pull --ff-only` any time.

### Releasing (for the maintainer)

Bump `version` in `manifest.json`, then publish a GitHub release whose tag matches (for example version `3.1.0` and tag `v3.1.0`). The update prompt compares the release tag with the installed version.

## If it doesn't work

- Try turning hardware acceleration off in your browser settings. It's the blunt version of the same idea, and a decent way to check whether that's the cause.
- Refresh the page, or restart the browser, after installing.
- Make sure the site you're on is in the list (Advanced tab) and the switch is on.

## Privacy

No data is collected, stored remotely, or sent anywhere. The only network request is the optional update check against GitHub. See [PRIVACY.md](PRIVACY.md) for details and a plain-English explanation of each permission.

## Uninstall

Click **Remove** on `chrome://extensions`, then delete the folder: `rm -rf ~/.local/share/airplay-drm-fix`.

## Licence

See [LICENSE](LICENSE).
