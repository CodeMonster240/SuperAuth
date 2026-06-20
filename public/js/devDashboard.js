(function () {
  const router = document.getElementById('dashboardRouter');
  const loader = document.getElementById('routerLoader');
  if (!router) return;

  const state = {
    page: 'overview',
    apps: [],
    activeApp: null,
    me: window.__USER__ || null,
  };

  const pageRoutes = {
    overview: '/dev/overview',
    apps:     '/dev/apps',
    deeplink: '/dev/deeplink',
    analytics:'/dev/analytics',
    settings: '/dev/settings',
    sandbox:  '/dev/sandbox'
    // intSettings path is dynamic: /dev/integration/:slug/settings
  };

  const pageScripts = {
    overview:     '/js/dashboard/dev/pages/overview.js',
    apps:         '/js/dashboard/dev/pages/apps.js',
    deeplink:     '/js/dashboard/dev/pages/deeplink.js',
    analytics:    '/js/dashboard/dev/pages/analytics.js',
    settings:     '/js/dashboard/dev/pages/settings.js',
    sandbox:      '/js/dashboard/dev/pages/sandbox.js',
    intSettings:  '/js/dashboard/dev/pages/integration-settings.js'
  };

  const loadedScripts = new Set();

  function getPageFromPathname(pathname) {
    if (pathname === '/dev' || pathname === '/dev/') return 'overview';
    if (pathname.match(/^\/dev\/integration\/[^/]+/)) return 'deeplink';
    const found = Object.entries(pageRoutes).find(([, p]) => pathname === p);
    return found ? found[0] : 'overview';
  }

  async function api(url, options) {
    const opts = Object.assign({}, options || {});
    if (opts.body && typeof opts.body === 'string') {
      opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    }
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  function setLoading(v) { loader.classList.toggle('hidden', !v); }

  async function loadPageScript(page) {
    const src = pageScripts[page];
    if (!src || loadedScripts.has(src)) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
    loadedScripts.add(src);
  }

  function go(page, appSlug, replacePath) {
    state.page = page;
    let target;
    if (page === 'intSettings') {
      const slug = appSlug || state.activeApp?.slug;
      target = replacePath || `/dev/integration/${slug}/settings`;
    } else {
      target = replacePath || pageRoutes[page] || pageRoutes.overview;
    }
    history.pushState({}, '', target);
    render().catch((err) => {
      console.error(err);
      router.innerHTML = '<section class="panel glass"><h2>Error</h2><p>Could not load this page.</p></section>';
    });
  }

  // expose so page modules can navigate
  window.SuperAuthDevGo = go;

  function updateNav() {
    document.querySelectorAll('.sidenav-link').forEach((a) => {
      a.classList.toggle('active', a.dataset.page === state.page);
    });
  }

  async function render() {
    updateNav();
    setLoading(true);

    const params = new URLSearchParams();
    if (state.activeApp) params.set('slug', state.activeApp.slug);

    try {
      const res = await fetch(`/dev/partial/${state.page}?${params}`);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`[SPA] partial/${state.page} returned ${res.status}:`, body);
        throw new Error(res.status + ': ' + body.slice(0, 200));
      }
      router.innerHTML = await res.text();
    } catch (err) {
      console.error('[SPA] render error:', err);
      router.innerHTML = `<section class="panel glass"><h2>Page Error</h2><p>${err.message}</p></section>`;
      setLoading(false);
      return;
    }

    await loadPageScript(state.page);
    const pageModule = window.SuperAuthDevPages?.[state.page];
    if (pageModule?.mount) {
      await pageModule.mount({ root: router, state, api, go, setLoading, load, reload, pageRoutes });
    }

    if (window.SuperAuthNumberFlow) {
      await window.SuperAuthNumberFlow.enhance(router, { delay: 200 });
    }

    setLoading(false);
  }

  async function reload() {
    await load();
    return render();
  }

  function initSidenavCollapse() {
    const key = 'superauth-sidenav-collapsed';
    const btn = document.getElementById('sidenavToggle');
    const root = document.body;
    if (!btn) return;

    const apply = (collapsed) => {
      root.classList.toggle('dashboard-collapsed', collapsed);
      btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    };

    apply(localStorage.getItem(key) === '1');
    btn.addEventListener('click', () => {
      const next = !root.classList.contains('dashboard-collapsed');
      apply(next);
      localStorage.setItem(key, next ? '1' : '0');
    });
  }

  async function load() {
    state.apps = await api('/dev/api/apps');
    const intMatch = location.pathname.match(/^\/dev\/integration\/([^/]+)/);
    const slug = intMatch ? intMatch[1] : null;
    if (slug) state.activeApp = state.apps.find(a => a.slug === slug) || null;
    if (!state.activeApp && state.apps.length) state.activeApp = state.apps[0];
  }

  document.querySelectorAll('.sidenav-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      go(a.dataset.page || 'overview');
    });
  });

  const createBtn = document.getElementById('createIntegrationBtn');
  if (createBtn) createBtn.addEventListener('click', () => go('apps'));

  window.addEventListener('popstate', () => {
    const newPage = getPageFromPathname(location.pathname);
    // If still on the same integration detail page, just switch the tab
    if (newPage === 'deeplink' && state.page === 'deeplink') {
      const tabMap = { deeplink: 'url', token: 'token', settings: 'settings', analytics: 'analytics' };
      const seg = location.pathname.split('/').pop();
      const tab = tabMap[seg] || 'url';
      window.SuperAuthIntTabSwitch?.(tab);
      return;
    }
    state.page = newPage;
    load().then(() => render()).catch(console.error);
  });

  initSidenavCollapse();
  state.page = getPageFromPathname(location.pathname);
  load()
    .then(() => render())
    .catch((err) => {
      console.error(err);
      router.innerHTML = '<section class="panel glass"><h2>Error</h2><p>Unable to load developer data.</p></section>';
      setLoading(false);
    });
})();
