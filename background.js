importScripts('defaults.js');

const SCRIPT_ID = 'awf-content';
const ALARM_NAME = 'awf-update-check';
const CHECK_EVERY_MINUTES = 6 * 60;

// ---- Content script registration -------------------------------------------
// The site list is user-editable, so the content script is registered here from
// storage instead of being declared statically in manifest.json.

let chain = Promise.resolve();
function enqueue(task) {
  chain = chain.catch(() => {}).then(task);
  return chain;
}

async function syncContentScripts() {
  const { config } = await chrome.storage.local.get('config');
  const cfg = AWF.mergeConfig(config);

  try {
    await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  } catch (e) {
    // Nothing registered yet.
  }

  // Only register for sites we actually have permission to run on.
  const matches = [];
  for (const host of cfg.domains) {
    const pattern = AWF.hostToPattern(host);
    if (await chrome.permissions.contains({ origins: [pattern] })) matches.push(pattern);
  }
  if (!matches.length) return;

  await chrome.scripting.registerContentScripts([{
    id: SCRIPT_ID,
    matches,
    js: ['defaults.js', 'content.js'],
    runAt: 'document_start',
    allFrames: true,
    persistAcrossSessions: true
  }]);
}

function resync() {
  return enqueue(() => syncContentScripts().catch((e) => console.error('Could not register content script:', e)));
}

// ---- Update checks ----------------------------------------------------------
// Looks at the repo's latest GitHub release. It never downloads or installs
// anything; the popup just tells you a newer release exists and gives you the
// git command to update your local clone.

async function checkForUpdates() {
  const current = chrome.runtime.getManifest().version;
  const res = await fetch('https://api.github.com/repos/' + AWF.REPO + '/releases/latest', {
    headers: { Accept: 'application/vnd.github+json' },
    credentials: 'omit',
    cache: 'no-store'
  });

  if (res.status === 404) {
    await chrome.storage.local.remove('updateInfo');
    await refreshBadge();
    return { none: true };
  }
  if (!res.ok) throw new Error('GitHub answered ' + res.status);

  const rel = await res.json();
  const tag = String(rel.tag_name || '');
  const latest = tag.replace(/^v/i, '');
  const url = typeof rel.html_url === 'string' && rel.html_url.startsWith('https://github.com/') ? rel.html_url : null;
  const info = {
    checkedAt: Date.now(),
    current,
    latest,
    tag,
    url,
    newer: AWF.compareVersions(latest, current) > 0
  };
  await chrome.storage.local.set({ updateInfo: info });
  await refreshBadge();
  return info;
}

async function refreshBadge() {
  const { updateInfo, dismissedVersion } = await chrome.storage.local.get(['updateInfo', 'dismissedVersion']);
  const current = chrome.runtime.getManifest().version;
  const show = Boolean(updateInfo) &&
    AWF.compareVersions(updateInfo.latest, current) > 0 &&
    dismissedVersion !== updateInfo.latest;
  await chrome.action.setBadgeText({ text: show ? '↑' : '' });
  if (show) await chrome.action.setBadgeBackgroundColor({ color: '#0a84ff' });
}

async function ensureAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: CHECK_EVERY_MINUTES });
}

// ---- Wiring -----------------------------------------------------------------

function boot() {
  chrome.action.enable();
  resync();
  ensureAlarm();
  refreshBadge();
}

chrome.runtime.onInstalled.addListener(boot);
chrome.runtime.onStartup.addListener(boot);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.config) resync();
  if (changes.updateInfo || changes.dismissedVersion) refreshBadge();
});

chrome.permissions.onAdded.addListener(resync);
chrome.permissions.onRemoved.addListener(resync);

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const { config } = await chrome.storage.local.get('config');
  if (!AWF.mergeConfig(config).autoUpdateCheck) return;
  try {
    await checkForUpdates();
  } catch (e) {
    console.warn('Update check failed:', e);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'checkUpdates') {
    checkForUpdates().then(
      (info) => sendResponse({ ok: true, info }),
      (err) => sendResponse({ ok: false, error: String((err && err.message) || err) })
    );
    return true; // keep the channel open for the async response
  }
  return false;
});
