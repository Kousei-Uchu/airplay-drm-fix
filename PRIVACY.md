# Privacy Policy for AirPlay Widevine Fix

**Last Updated:** November 13, 2026

## The short version

AirPlay Widevine Fix does not collect, store remotely, or transmit any of your data. It has no analytics, no tracking, and no accounts. Its only network request is an optional check for new releases on GitHub, described below.

## What the extension does

On the sites in its list, it applies a small CSS style change to the page's `<video>` element, to help avoid a black screen when using AirPlay from a non-Apple browser. It looks up the element(s) matching your selector in order to style them. It does not read, copy, or transmit page content.

It does not:
- collect or transmit personal information
- track your browsing history
- read or access your account details on any site
- load code or resources from external servers
- use third-party services, analytics, or tracking tools

## The one network request

If automatic update checks are on (the default; you can turn them off in the popup), the extension asks GitHub for this repository's latest release shortly after the browser starts and every few hours after that. Pressing **Check for updates** does the same on demand.

- It's a plain request to `api.github.com` for the repo's latest release.
- GitHub sees what any web request reveals (your IP address and the browser's user agent). No cookies are sent, and nothing about you, your browsing, or your settings is included.
- What comes back is the release's version and link. If a newer version exists, the popup says so. The extension never downloads or installs anything itself.

## What it stores

All of this stays on your device:

- **Settings** (in the browser's extension storage): the on/off switch, whether to check for updates, and any changes you make under the Advanced tab (site list, target, CSS). Only values that differ from the defaults are saved.
- **Update information** (in the same storage): the latest release version and link GitHub reported, when it was last checked, and which version you dismissed.
- **`local-install.json`** (a file in the extension's folder, written by `scripts/install.sh`): the folder path, so the popup can show you where the extension lives. It's git-ignored and never sent anywhere.

Removing the extension deletes the stored settings and update information.

## Permissions explained

### scripting
Lets the extension register its content script for the sites on your list, since that list is editable.

### activeTab
Lets the popup see the address of the tab you're on when you click the icon, so it can tell you whether the site is on the list and offer to add it. Nothing is stored or sent.

### storage
Saves the settings and update information described above.

### alarms
Schedules the periodic update check.

### Site access (host permissions)
- **Built-in sites:** a short list of streaming-service domains (see `host_permissions` in `manifest.json`) is allowed from install so the fix works out of the box. The extension has no access to other sites unless you add them.
- **api.github.com:** allowed so the update check described above can reach GitHub reliably. It's used for nothing else.
- **Sites you add:** these are optional permissions. Chrome asks you for each site you add under the Advanced tab, and the permission is removed again when you remove the site. Removing a built-in site from the list stops the extension running there, though Chrome still shows the manifest's permission for it.

## Changes to this policy

If this policy changes, the "Last Updated" date above will be updated.

## Contact

Questions about this policy? Open an issue on GitHub: https://github.com/Kousei-Uchu/airplay-drm-fix
