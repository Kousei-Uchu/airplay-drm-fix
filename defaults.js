// Shared settings and helpers. Loaded by the background worker (importScripts),
// the content script, and the popup. Plain script, no modules, no network access.
(function (root) {
  'use strict';

  // Where update checks look for new releases.
  const REPO = 'Kousei-Uchu/airplay-drm-fix';

  // Built-in behaviour. Anything the user changes in the popup is stored as an
  // override in chrome.storage.local, so these stay the source of truth for
  // "Reset to defaults" and the repo itself never has local edits.
  const DEFAULTS = {
    enabled: true,
    autoUpdateCheck: true,
    domains: [
      'netflix.com',
      'disneyplus.com',
      'dssott.com',
      'disney-plus.net',
      'dssedge.com',
      'search-api-disney.bamgrid.com'
    ],
    targetType: 'css', // 'css' (a selector, including a full CSS path) or 'xpath'
    target: 'video',
    applyTo: 'first',  // 'first' match or 'all' matches
    css: 'filter: sepia(0%);\nopacity: 0.9999;\nmix-blend-mode: normal;'
  };

  const HOST_RE = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

  // "https://www.Example.com:8080/watch?x=1" -> "example.com". Returns null if
  // the result is not a plain hostname. Subdomains are covered automatically.
  function normalizeHost(input) {
    if (typeof input !== 'string') return null;
    let h = input.trim().toLowerCase();
    if (!h) return null;
    h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
    h = h.replace(/[/?#].*$/, '');
    h = h.replace(/^[^@]*@/, '');
    h = h.replace(/:\d+$/, '');
    h = h.replace(/^\*\./, '').replace(/^www\./, '');
    return HOST_RE.test(h) ? h : null;
  }

  function hostToPattern(host) {
    return '*://*.' + host + '/*';
  }

  function hostInList(hostname, list) {
    const h = String(hostname || '').toLowerCase();
    return (list || []).some((d) => h === d || h.endsWith('.' + d));
  }

  function parseVersion(v) {
    return String(v || '').trim().replace(/^v/i, '').split('-')[0].split('.')
      .map((p) => parseInt(p, 10) || 0);
  }

  function compareVersions(a, b) {
    const x = parseVersion(a);
    const y = parseVersion(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
      const d = (x[i] || 0) - (y[i] || 0);
      if (d) return d > 0 ? 1 : -1;
    }
    return 0;
  }

  // Overrides (possibly missing or malformed) -> a complete, valid config.
  function mergeConfig(overrides) {
    const o = overrides && typeof overrides === 'object' ? overrides : {};
    const domains = Array.isArray(o.domains)
      ? Array.from(new Set(o.domains.map(normalizeHost).filter(Boolean)))
      : DEFAULTS.domains.slice();
    return {
      enabled: typeof o.enabled === 'boolean' ? o.enabled : DEFAULTS.enabled,
      autoUpdateCheck: typeof o.autoUpdateCheck === 'boolean' ? o.autoUpdateCheck : DEFAULTS.autoUpdateCheck,
      domains,
      targetType: o.targetType === 'xpath' || o.targetType === 'css' ? o.targetType : DEFAULTS.targetType,
      target: typeof o.target === 'string' && o.target.trim() ? o.target.trim() : DEFAULTS.target,
      applyTo: o.applyTo === 'all' || o.applyTo === 'first' ? o.applyTo : DEFAULTS.applyTo,
      css: typeof o.css === 'string' ? o.css : DEFAULTS.css
    };
  }

  // Only keep what differs from the defaults, so future default changes still
  // reach anyone who never customised that setting.
  function diffFromDefaults(cfg) {
    const out = {};
    Object.keys(DEFAULTS).forEach((key) => {
      if (JSON.stringify(cfg[key]) !== JSON.stringify(DEFAULTS[key])) out[key] = cfg[key];
    });
    return out;
  }

  // "opacity: 0.9;\nfilter: none" -> [[name, value, priority], ...]. The browser
  // does the parsing, so anything it understands is accepted and anything it
  // doesn't is dropped. Needs a DOM (content script and popup only).
  function parseDeclarations(text) {
    if (typeof document === 'undefined' || typeof text !== 'string') return [];
    const probe = document.createElement('div');
    probe.style.cssText = text;
    const out = [];
    for (let i = 0; i < probe.style.length; i++) {
      const name = probe.style[i];
      out.push([name, probe.style.getPropertyValue(name), probe.style.getPropertyPriority(name)]);
    }
    return out;
  }

  root.AWF = {
    REPO,
    DEFAULTS,
    normalizeHost,
    hostToPattern,
    hostInList,
    compareVersions,
    mergeConfig,
    diffFromDefaults,
    parseDeclarations
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
