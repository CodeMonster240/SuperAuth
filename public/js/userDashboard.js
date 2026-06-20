(function () {
  const router = document.getElementById('dashboardRouter');
  const loader = document.getElementById('routerLoader');
  if (!router) return;

  const state = {
    page: 'home',
    connections: [],
    social: [],
    me: window.__USER__ || null,
  };

  const funFacts = [
    'The first computer password was used at MIT in the 1960s.',
    '2FA can block over 99% of automated account attacks.',
    'OAuth was originally published in 2010 as RFC 5849.'
  ];

  async function api(url, options) {
    const res = await fetch(url, options || {});
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  function setLoading(v) {
    loader.classList.toggle('hidden', !v);
  }

  const pageRoutes = {
    home: '/dashboard/home',
    integrations: '/dashboard/integrations',
    security: '/dashboard/security',
    settings: '/dashboard/settings'
  };

  const pageScripts = {
    home: '/js/dashboard/user/pages/home.js',
    integrations: '/js/dashboard/user/pages/integrations.js',
    security: '/js/dashboard/user/pages/security.js',
    settings: '/js/dashboard/user/pages/settings.js'
  };

  const loadedScripts = new Set();

  function getPageFromPathname(pathname) {
    if (pathname === '/dashboard' || pathname === '/dashboard/') return 'home';
    const found = Object.entries(pageRoutes).find(([, p]) => pathname === p);
    return found ? found[0] : 'home';
  }

  function updateNav() {
    document.querySelectorAll('.sidenav-link').forEach((a) => {
      a.classList.toggle('active', a.dataset.page === state.page);
    });
  }

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

  function go(page) {
    state.page = page;
    history.pushState({ page }, '', pageRoutes[page] || pageRoutes.home);
    render().catch((err) => {
      console.error(err);
      router.innerHTML = '<section class="panel glass"><h2>Error</h2><p>Could not load this page.</p></section>';
    });
  }

  async function render() {
    updateNav();
    setLoading(true);

    await loadPageScript(state.page);
    const pageModule = window.SuperAuthUserPages && window.SuperAuthUserPages[state.page];
    if (!pageModule || typeof pageModule.render !== 'function') {
      router.innerHTML = '<section class="panel glass"><h2>Page Missing</h2><p>This page module failed to load.</p></section>';
      setLoading(false);
      return;
    }

    router.innerHTML = pageModule.render(state, { pageRoutes });
    if (typeof pageModule.mount === 'function') {
      await pageModule.mount({
        root: router,
        state,
        api,
        go,
        setLoading,
        load,
        reload,
        pageRoutes
      });
    }

    if (window.SuperAuthNumberFlow) {
      await window.SuperAuthNumberFlow.enhance(router, { delay: 1000 });
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
    const [connections, social, me] = await Promise.all([
      api('/dashboard/api/connections'),
      api('/dashboard/api/social'),
      api('/api/user/me')
    ]);
    state.connections = connections;
    state.social = social;
    state.me = me;
  }

  document.querySelectorAll('.sidenav-link').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      go(a.dataset.page || 'home');
    });
  });

  const funBtn = document.getElementById('openFunFact');
  if (funBtn) {
    funBtn.addEventListener('click', () => {
      const fact = funFacts[Math.floor(Math.random() * funFacts.length)];
      alert(fact);
    });
  }

  window.addEventListener('popstate', () => {
    state.page = getPageFromPathname(location.pathname);
    render().catch(console.error);
  });

  initSidenavCollapse();
  state.page = getPageFromPathname(location.pathname);

  load()
    .then(() => render())
    .catch((err) => {
      console.error(err);
      router.innerHTML = '<section class="panel glass"><h2>Error</h2><p>Unable to load dashboard data.</p></section>';
      setLoading(false);
    });
})();
