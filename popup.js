document.addEventListener('DOMContentLoaded', async () => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const manifest = chrome.runtime.getManifest();

    // Release tags come from the network and end up in a command you paste into
    // Terminal, so only allow plain tag characters.
    const SAFE_TAG = /^[A-Za-z0-9._\/-]+$/;

    let cfg = AWF.mergeConfig(null);
    let installPath = null;
    let tabHost = null;

    // ---------- helpers ----------

    const shellQuote = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (_) { /* ignore */ }
            ta.remove();
            return ok;
        }
    }

    function say(el, text, kind) {
        el.textContent = text || '';
        el.className = 'msg' + (kind ? ' ' + kind : '');
        el.hidden = !text;
    }

    async function loadConfig() {
        const { config } = await chrome.storage.local.get('config');
        cfg = AWF.mergeConfig(config);
    }

    async function saveConfig(next) {
        cfg = AWF.mergeConfig(next);
        await chrome.storage.local.set({ config: AWF.diffFromDefaults(cfg) });
    }

    // ---------- tabs ----------

    document.querySelectorAll('.tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach((b) => {
                const on = b === btn;
                b.classList.toggle('active', on);
                b.setAttribute('aria-selected', String(on));
            });
            $('tab-main').hidden = btn.dataset.tab !== 'main';
            $('tab-advanced').hidden = btn.dataset.tab !== 'advanced';
        });
    });

    // ---------- main: toggle and site status ----------

    function renderToggle() {
        $('toggle-fix').checked = cfg.enabled;
        $('status-text').textContent = cfg.enabled ? 'Enabled' : 'Disabled';
        $('status-text').classList.toggle('inactive', !cfg.enabled);
        $('auto-update').checked = cfg.autoUpdateCheck;
    }

    async function loadTab() {
        tabHost = null;
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const url = tab && tab.url ? new URL(tab.url) : null;
            if (url && (url.protocol === 'http:' || url.protocol === 'https:')) tabHost = url.hostname;
        } catch (e) { /* no tab or no access */ }
    }

    function renderSiteStatus() {
        const el = $('site-status');
        el.classList.remove('on');
        if (!tabHost) {
            el.textContent = 'Open a website to see whether the fix applies to it.';
        } else if (AWF.hostInList(tabHost, cfg.domains)) {
            el.textContent = 'Active on ' + tabHost;
            el.classList.add('on');
        } else {
            el.textContent = tabHost + " isn't on the site list (see the Advanced tab).";
        }
    }

    $('toggle-fix').addEventListener('change', async (e) => {
        await saveConfig({ ...cfg, enabled: e.target.checked });
        renderToggle();
        $('refresh-hint').classList.add('show');
    });

    // ---------- main: updates ----------

    function updateCommand(info) {
        if (!installPath) return null;
        const dir = shellQuote(installPath);
        if (info && info.tag && SAFE_TAG.test(info.tag)) {
            return 'git -C ' + dir + ' fetch --tags --force --quiet && git -C ' + dir +
                ' merge --ff-only ' + shellQuote(info.tag);
        }
        return 'git -C ' + dir + ' pull --ff-only';
    }

    async function renderUpdate(message) {
        const { updateInfo, dismissedVersion } = await chrome.storage.local.get(['updateInfo', 'dismissedVersion']);
        const newer = Boolean(updateInfo) && AWF.compareVersions(updateInfo.latest, manifest.version) > 0;
        $('update-banner').hidden = !(newer && dismissedVersion !== updateInfo.latest);
        if (newer) {
            $('update-text').textContent =
                'Version ' + updateInfo.latest + ' is available (you have ' + manifest.version + ').';
            $('copy-update').disabled = !installPath;
            $('update-hint').hidden = Boolean(installPath);
            $('view-release').disabled = !updateInfo.url;
        }
        $('last-checked').textContent = updateInfo
            ? 'Checked ' + new Date(updateInfo.checkedAt).toLocaleString()
            : 'Not checked yet';
        if (message) say($('update-msg'), message.text, message.kind);
    }

    $('check-updates').addEventListener('click', async () => {
        const btn = $('check-updates');
        btn.disabled = true;
        say($('update-msg'), 'Checking…', '');
        try {
            await chrome.storage.local.remove('dismissedVersion');
            const res = await chrome.runtime.sendMessage({ type: 'checkUpdates' });
            if (!res || !res.ok) throw new Error((res && res.error) || 'no response');
            if (res.info.none) {
                await renderUpdate({ text: 'No releases have been published yet.', kind: '' });
            } else if (res.info.newer) {
                await renderUpdate({ text: 'Update available: ' + res.info.latest + '.', kind: 'ok' });
            } else {
                await renderUpdate({ text: "You're up to date (" + manifest.version + ').', kind: 'ok' });
            }
        } catch (e) {
            say($('update-msg'), "Couldn't check for updates: " + e.message, 'error');
        } finally {
            btn.disabled = false;
        }
    });

    $('copy-update').addEventListener('click', async () => {
        const { updateInfo } = await chrome.storage.local.get('updateInfo');
        const cmd = updateCommand(updateInfo);
        if (!cmd) return say($('update-msg'), 'Install folder unknown. Run git pull inside the folder you loaded.', 'error');
        const ok = await copyText(cmd);
        say($('update-msg'),
            ok ? 'Copied. Paste it into Terminal, then press "Restart extension" below.' : "Couldn't copy to the clipboard.",
            ok ? 'ok' : 'error');
    });

    $('view-release').addEventListener('click', async () => {
        const { updateInfo } = await chrome.storage.local.get('updateInfo');
        if (updateInfo && updateInfo.url) chrome.tabs.create({ url: updateInfo.url });
    });

    $('dismiss-update').addEventListener('click', async () => {
        const { updateInfo } = await chrome.storage.local.get('updateInfo');
        if (updateInfo) await chrome.storage.local.set({ dismissedVersion: updateInfo.latest });
        await renderUpdate();
    });

    $('auto-update').addEventListener('change', async (e) => {
        await saveConfig({ ...cfg, autoUpdateCheck: e.target.checked });
    });

    // ---------- main: install location and restart ----------

    async function loadInstallInfo() {
        try {
            const res = await fetch(chrome.runtime.getURL('local-install.json'), { cache: 'no-store' });
            if (!res.ok) throw new Error('missing');
            const info = await res.json();
            installPath = typeof info.path === 'string' && info.path ? info.path : null;
        } catch (e) {
            installPath = null;
        }
        $('install-path').textContent = installPath ||
            'Not recorded. Run scripts/install.sh from the folder you loaded.';
        $('open-folder').disabled = !installPath;
        $('copy-path').disabled = !installPath;
    }

    $('open-folder').addEventListener('click', async () => {
        if (!installPath) return;
        try {
            await chrome.tabs.create({ url: 'file://' + encodeURI(installPath) + '/' });
        } catch (e) {
            await copyText(installPath);
            say($('loc-msg'),
                "Couldn't open it from here, so the path was copied instead. In Finder use Go ▸ Go to Folder (⇧⌘G) and paste.",
                'error');
        }
    });

    $('copy-path').addEventListener('click', async () => {
        if (!installPath) return;
        const ok = await copyText(installPath);
        say($('loc-msg'), ok ? 'Path copied.' : "Couldn't copy to the clipboard.", ok ? 'ok' : 'error');
    });

    $('restart').addEventListener('click', () => chrome.runtime.reload());

    // ---------- advanced ----------

    function fillAdvanced() {
        $('domains').value = cfg.domains.join('\n');
        $('targetType').value = cfg.targetType;
        $('target').value = cfg.target;
        $('applyTo').value = cfg.applyTo;
        $('css').value = cfg.css;
    }

    function validateTarget(type, target) {
        try {
            if (type === 'xpath') {
                document.evaluate(target, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
            } else {
                document.createDocumentFragment().querySelector(target);
            }
            return null;
        } catch (e) {
            return 'Invalid ' + (type === 'xpath' ? 'XPath' : 'CSS selector') + ': ' + e.message;
        }
    }

    $('unlock').addEventListener('click', () => {
        $('unlock-box').hidden = true;
        $('adv-form').hidden = false;
    });

    $('add-site').addEventListener('click', () => {
        const msg = $('adv-msg');
        if (!tabHost) return say(msg, 'Open the website you want to add, then open this popup again.', 'error');
        const host = AWF.normalizeHost(tabHost);
        if (!host) return say(msg, '"' + tabHost + '" is not a site name that can be added.', 'error');
        const current = $('domains').value.split(/[\s,]+/).filter(Boolean).map(AWF.normalizeHost);
        if (!current.includes(host)) $('domains').value = ($('domains').value.trim() + '\n' + host).trim();
        say(msg, 'Added ' + host + ' to the list. Press "Save & apply" to confirm.', 'ok');
    });

    $('save').addEventListener('click', async () => {
        const msg = $('adv-msg');

        const domains = [];
        const bad = [];
        $('domains').value.split(/[\s,]+/).filter(Boolean).forEach((token) => {
            const host = AWF.normalizeHost(token);
            if (!host) bad.push(token);
            else if (!domains.includes(host)) domains.push(host);
        });
        if (bad.length) return say(msg, 'Not valid site names: ' + bad.join(', '), 'error');

        const targetType = $('targetType').value;
        const target = $('target').value.trim();
        const applyTo = $('applyTo').value;
        const css = $('css').value;

        if (!target) return say(msg, 'Enter a selector or XPath for the element to style.', 'error');
        const targetError = validateTarget(targetType, target);
        if (targetError) return say(msg, targetError, 'error');
        if (css.trim() && !AWF.parseDeclarations(css).length) {
            return say(msg, 'No CSS declarations could be read. Use lines like "opacity: 0.9999;" with no selector or braces.', 'error');
        }

        // Chrome only shows its permission prompt in response to a click, so ask
        // before doing anything else asynchronous. Built-in sites are already allowed.
        const needed = domains.filter((d) => !AWF.DEFAULTS.domains.includes(d)).map(AWF.hostToPattern);
        if (needed.length) {
            let granted = false;
            try {
                granted = await chrome.permissions.request({ origins: needed });
            } catch (e) {
                return say(msg, "Couldn't ask for access: " + e.message, 'error');
            }
            if (!granted) return say(msg, 'Access to the added site(s) was declined, so nothing was saved.', 'error');
        }

        const dropped = cfg.domains
            .filter((d) => !domains.includes(d) && !AWF.DEFAULTS.domains.includes(d))
            .map(AWF.hostToPattern);

        await saveConfig({ ...cfg, domains, targetType, target, applyTo, css });
        if (dropped.length) {
            try { await chrome.permissions.remove({ origins: dropped }); } catch (e) { /* already gone */ }
        }

        fillAdvanced();
        renderSiteStatus();
        say(msg, 'Saved. Open tabs update straight away; reload any tab on a newly added site.', 'ok');
    });

    $('reset').addEventListener('click', async () => {
        if (!confirm('Reset sites, target and CSS to the built-in defaults?')) return;
        const dropped = cfg.domains.filter((d) => !AWF.DEFAULTS.domains.includes(d)).map(AWF.hostToPattern);
        await saveConfig({ enabled: cfg.enabled, autoUpdateCheck: cfg.autoUpdateCheck });
        if (dropped.length) {
            try { await chrome.permissions.remove({ origins: dropped }); } catch (e) { /* already gone */ }
        }
        fillAdvanced();
        renderSiteStatus();
        say($('adv-msg'), 'Reset to defaults.', 'ok');
    });

    // ---------- init ----------

    $('version').textContent = 'v' + manifest.version;
    await Promise.all([loadConfig(), loadInstallInfo(), loadTab()]);
    renderToggle();
    renderSiteStatus();
    fillAdvanced();
    await renderUpdate();
});
