// Applies the configured CSS declarations to the configured element(s) on pages
// whose hostname is on the site list. That is all it does: it reads the page only
// to find the target element, and it never sends anything anywhere.
(function () {
  'use strict';

  if (globalThis.__airplayWidevineFixLoaded) return;
  globalThis.__airplayWidevineFixLoaded = true;

  const applied = new Map(); // element -> names of the properties we set on it
  let cfg = null;
  let declarations = [];
  let observer = null;

  function active() {
    return Boolean(cfg && cfg.enabled && AWF.hostInList(location.hostname, cfg.domains));
  }

  function findTargets() {
    try {
      let found = [];
      if (cfg.targetType === 'xpath') {
        const snap = document.evaluate(cfg.target, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let i = 0; i < snap.snapshotLength; i++) {
          const node = snap.snapshotItem(i);
          if (node && node.nodeType === 1) found.push(node);
        }
      } else if (cfg.applyTo === 'all') {
        found = Array.from(document.querySelectorAll(cfg.target));
      } else {
        const one = document.querySelector(cfg.target);
        if (one) found.push(one);
      }
      return cfg.applyTo === 'all' ? found : found.slice(0, 1);
    } catch (e) {
      return []; // invalid selector or XPath: do nothing rather than break the page
    }
  }

  function revertAll() {
    applied.forEach((names, el) => {
      names.forEach((name) => el.style.removeProperty(name));
    });
    applied.clear();
  }

  function applyNow() {
    if (!active() || !declarations.length) return;
    findTargets().forEach((el) => {
      declarations.forEach(([name, value, priority]) => el.style.setProperty(name, value, priority));
      applied.set(el, declarations.map((d) => d[0]));
    });
    applied.forEach((names, el) => {
      if (!el.isConnected) applied.delete(el);
    });
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(applyNow);
    observer.observe(document, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) observer.disconnect();
    observer = null;
  }

  function setConfig(raw) {
    revertAll();
    cfg = AWF.mergeConfig(raw);
    declarations = AWF.parseDeclarations(cfg.css);
    if (active()) {
      applyNow();
      startObserver();
    } else {
      stopObserver();
    }
  }

  try {
    chrome.storage.local.get('config').then((res) => setConfig(res && res.config)).catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.config) setConfig(changes.config.newValue);
    });
  } catch (e) {
    // Extension was reloaded while this page was open; a page refresh fixes it.
  }
})();
