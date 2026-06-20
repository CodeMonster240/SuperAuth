/**
 * SuperAuth Button Widget  v1.0
 * Drop-in "Sign in with SuperAuth" button — no dependencies, no build step.
 *
 * Usage:
 *   <div class="superauth-btn"
 *        data-client-id="sa_xxxxxxxxxxxx"
 *        data-return-to="https://yourapp.com/auth/callback">
 *   </div>
 *   <script src="https://superauth.io/js/btn.js" defer></script>
 *
 * Options (data attributes on the div):
 *   data-client-id   (required) Your integration client_id
 *   data-return-to   (required) Callback URL after auth
 *   data-origin      Overrides origin detection
 *   data-theme       "light" | "dark" | "auto"  (default "auto")
 *   data-size        "sm" | "md" | "lg"          (default "md")
 *   data-text        Button label text            (default "Sign in with SuperAuth")
 *   data-shape       "rounded" | "pill"           (default "rounded")
 */
(function () {
  'use strict';

  var STYLE_ID = '__superauth_btn_css';

  /* ── Resolve the SuperAuth base URL from this script's own origin ── */
  var BASE = (function () {
    try {
      var el = document.currentScript;
      if (el && el.src) return new URL(el.src).origin;
    } catch (_) {}
    return 'https://superauth.io';
  })();

  /* ── SVG Shield Logo ─────────────────────────────────────────── */
  var LOGO_SVG = '<svg class="sa-btn-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M12 2L4 6.5V12c0 4.72 3.64 9.14 8 10.5 4.36-1.36 8-5.78 8-10.5V6.5L12 2z" fill="currentColor"/>' +
    '<path d="M9.5 12.5l1.8 1.8 3.2-3.8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
    '</svg>';

  /* ── Injected CSS (scoped to .sa-btn-* classes) ──────────────── */
  var CSS = [
    '.sa-btn-wrap{display:inline-block;line-height:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',
    '.sa-btn{display:inline-flex;align-items:center;gap:10px;cursor:pointer;font-weight:600;',
    'text-decoration:none;border:none;outline:none;white-space:nowrap;',
    'transition:box-shadow .18s,opacity .18s,transform .1s;',
    'user-select:none;-webkit-user-select:none;',
    'border-radius:10px;padding:11px 20px;font-size:15px;line-height:1.25}',

    /* sizes */
    '.sa-btn.sa-sm{padding:8px 14px;font-size:13px;gap:7px}',
    '.sa-btn.sa-lg{padding:14px 26px;font-size:17px;gap:12px}',

    /* pill */
    '.sa-btn.sa-pill{border-radius:999px}',

    /* icon */
    '.sa-btn-icon{flex-shrink:0;width:1.15em;height:1.15em}',

    /* ── light theme ── */
    '.sa-btn.sa-light{background:#fff;color:#1a1730;',
    'border:1.5px solid rgba(91,78,240,0.22);',
    'box-shadow:0 1px 4px rgba(91,78,240,0.08)}',
    '.sa-btn.sa-light .sa-btn-icon path:first-child{fill:#6e5ff6}',
    '.sa-btn.sa-light:hover{box-shadow:0 4px 16px rgba(91,78,240,0.18);border-color:rgba(91,78,240,0.42)}',
    '.sa-btn.sa-light:active{transform:scale(0.97)}',

    /* ── dark theme ── */
    '.sa-btn.sa-dark{background:linear-gradient(135deg,#6e5ff6,#5b4ef0);color:#fff;',
    'border:1.5px solid transparent;',
    'box-shadow:0 2px 10px rgba(91,78,240,0.35)}',
    '.sa-btn.sa-dark .sa-btn-icon path:first-child{fill:rgba(255,255,255,0.92)}',
    '.sa-btn.sa-dark:hover{box-shadow:0 4px 20px rgba(91,78,240,0.55);opacity:.95}',
    '.sa-btn.sa-dark:active{transform:scale(0.97)}',

    /* ── auto theme (OS preference) ── */
    '@media(prefers-color-scheme:light){',
    '.sa-btn.sa-auto{background:#fff;color:#1a1730;',
    'border:1.5px solid rgba(91,78,240,0.22);',
    'box-shadow:0 1px 4px rgba(91,78,240,0.08)}',
    '.sa-btn.sa-auto .sa-btn-icon path:first-child{fill:#6e5ff6}',
    '.sa-btn.sa-auto:hover{box-shadow:0 4px 16px rgba(91,78,240,0.18);border-color:rgba(91,78,240,0.42)}',
    '}',
    '@media(prefers-color-scheme:dark){',
    '.sa-btn.sa-auto{background:linear-gradient(135deg,#6e5ff6,#5b4ef0);color:#fff;',
    'border:1.5px solid transparent;',
    'box-shadow:0 2px 10px rgba(91,78,240,0.35)}',
    '.sa-btn.sa-auto .sa-btn-icon path:first-child{fill:rgba(255,255,255,0.92)}',
    '.sa-btn.sa-auto:hover{box-shadow:0 4px 20px rgba(91,78,240,0.55);opacity:.95}',
    '}',

    /* disabled */
    '.sa-btn[disabled]{opacity:.45;cursor:not-allowed;pointer-events:none}'
  ].join('');

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  function buildDeepLinkUrl(clientId, returnTo, origin) {
    var o = origin || (returnTo ? (function () { try { return new URL(returnTo).origin; } catch (_) { return window.location.origin; } })() : window.location.origin);
    var url = new URL(BASE + '/deeplink/create');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('return_to', returnTo || window.location.href);
    url.searchParams.set('origin', o);
    return url.toString();
  }

  function enhance(root) {
    injectStyles();
    var els = (root || document).querySelectorAll('.superauth-btn:not([data-sa-enhanced])');
    els.forEach(function (el) {
      var clientId = el.dataset.clientId || el.getAttribute('data-client-id');
      var returnTo  = el.dataset.returnTo  || el.getAttribute('data-return-to');
      var origin    = el.dataset.origin    || el.getAttribute('data-origin') || null;
      var theme     = (el.dataset.theme    || el.getAttribute('data-theme') || 'auto').toLowerCase();
      var size      = (el.dataset.size     || el.getAttribute('data-size')  || 'md').toLowerCase();
      var text      = el.dataset.text      || el.getAttribute('data-text')  || 'Sign in with SuperAuth';
      var shape     = (el.dataset.shape    || el.getAttribute('data-shape') || 'rounded').toLowerCase();

      var sizeClass  = size  === 'sm' ? 'sa-sm' : size  === 'lg' ? 'sa-lg' : '';
      var shapeClass = shape === 'pill' ? 'sa-pill' : '';
      var themeClass = ['light','dark','auto'].includes(theme) ? 'sa-' + theme : 'sa-auto';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = ['sa-btn', themeClass, sizeClass, shapeClass].filter(Boolean).join(' ');
      btn.innerHTML = LOGO_SVG + '<span>' + text + '</span>';

      if (clientId) {
        var deepLinkUrl = buildDeepLinkUrl(clientId, returnTo, origin);
        btn.addEventListener('click', function () {
          window.location.href = deepLinkUrl;
        });
      } else {
        btn.disabled = true;
        btn.title = 'data-client-id is required';
      }

      var wrap = document.createElement('span');
      wrap.className = 'sa-btn-wrap';
      wrap.appendChild(btn);

      el.setAttribute('data-sa-enhanced', '1');
      el.innerHTML = '';
      el.appendChild(wrap);
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () { enhance(); });

  window.SuperAuthBtn = { enhance: enhance, version: '1.0' };
})();
