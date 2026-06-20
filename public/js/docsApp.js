(function () {
  const mount = document.getElementById('docsRouter');
  const loader = document.getElementById('docsLoader');
  const searchInput = document.getElementById('docsSearchInput');
  const searchResults = document.getElementById('docsSearchResults');
  if (!mount) return;

  const state = {
    page: 'getting-started'
  };

  const pageRoutes = {
    'getting-started': '/docs/getting-started',
    'callback-system': '/docs/callback-system',
    'auth-flow': '/docs/auth-flow',
    'playground': '/docs/playground',
    'button-widget': '/docs/button-widget'
  };

  const pageScripts = {
    'getting-started': '/js/docs/pages/getting-started.js',
    'callback-system': '/js/docs/pages/callback-system.js',
    'auth-flow': '/js/docs/pages/auth-flow.js',
    'playground': '/js/docs/pages/playground.js',
    'button-widget': '/js/docs/pages/button-widget.js'
  };

  const loaded = new Set();

  const docsIndex = [
    {
      page: 'getting-started',
      title: 'Getting Started',
      route: '/docs/getting-started',
      keywords: ['developer account', 'integration', 'client_id', 'client_secret', 'setup', 'first callback']
    },
    {
      page: 'callback-system',
      title: 'Callback System',
      route: '/docs/callback-system',
      keywords: ['deeplink', 'return_to', 'origin', 'callback', 'validation', 'one-time code']
    },
    {
      page: 'auth-flow',
      title: 'Auth Flow',
      route: '/docs/auth-flow',
      keywords: ['sequence', 'token exchange', 'profile payload', 'security checklist', 'backend']
    },
    {
      page: 'playground',
      title: 'Playground',
      route: '/docs/playground',
      keywords: ['builder', 'parser', 'simulator', 'curl', 'node snippet', 'test callback']
    },
    {
      page: 'button-widget',
      title: 'Button Widget',
      route: '/docs/button-widget',
      keywords: ['button', 'sign in', 'widget', 'embed', 'html snippet', 'login button', 'btn.js', 'theme', 'dark', 'light']
    }
  ];

  function setLoading(v) {
    loader.classList.toggle('hidden', !v);
  }

  function getPageFromPath(pathname) {
    if (pathname === '/docs' || pathname === '/docs/') return 'getting-started';
    const found = Object.entries(pageRoutes).find(([, route]) => route === pathname);
    return found ? found[0] : 'getting-started';
  }

  function updateNav() {
    document.querySelectorAll('#docsNav a').forEach((a) => {
      a.classList.toggle('active', a.dataset.docsPage === state.page);
    });
  }

  function initSidebarToggle() {
    const btn = document.getElementById('docsSidebarToggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      document.body.classList.toggle('docs-sidebar-collapsed');
    });
  }

  function attachCopyButtons(root) {
    // add language labels and copy buttons to all code blocks
    const langMap = {
      'lang-js': 'JavaScript', 'lang-html': 'HTML', 'lang-json': 'JSON',
      'lang-http': 'HTTP', 'lang-text': 'Text', 'lang-bash': 'Shell'
    };

    root.querySelectorAll('pre code').forEach((codeEl) => {
      const pre = codeEl.closest('pre');
      if (!pre || pre.dataset.copyReady === '1') return;
      pre.dataset.copyReady = '1';

      // ensure the pre is wrapped in a .code-copy-wrap if not already
      if (!pre.closest('.code-copy-wrap')) {
        pre.classList.add('code-copy-wrap');
      }

      // detect language from class
      const langClass = [...codeEl.classList].find(c => langMap[c]);
      if (langClass) {
        const tag = document.createElement('span');
        tag.className = 'code-lang-tag';
        tag.textContent = langMap[langClass];
        pre.appendChild(tag);
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy-btn';
      btn.innerHTML = '<i class="fas fa-copy"></i> Copy';
      btn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(codeEl.textContent || '');
        const old = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied';
        setTimeout(() => { btn.innerHTML = old; }, 1200);
      });

      pre.appendChild(btn);
    });
  }

  function renderSearchResults(query) {
    if (!searchResults) return;
    const q = query.trim().toLowerCase();
    if (!q) {
      searchResults.classList.add('hidden');
      searchResults.innerHTML = '';
      return;
    }

    const rows = docsIndex.filter((item) => {
      if (item.title.toLowerCase().includes(q)) return true;
      return item.keywords.some(k => k.toLowerCase().includes(q));
    });

    searchResults.classList.remove('hidden');
    searchResults.innerHTML = rows.length
      ? `<div class="panel glass"><h3>Search Results</h3><div class="docs-search-list">${rows.map((item) => `<a href="${item.route}" data-docs-jump="${item.page}" class="docs-search-item"><strong>${item.title}</strong><small>${item.route}</small></a>`).join('')}</div></div>`
      : '<div class="panel glass"><h3>Search Results</h3><p>No matches found.</p></div>';

    searchResults.querySelectorAll('[data-docs-jump]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        go(el.dataset.docsJump);
        searchResults.classList.add('hidden');
        searchResults.innerHTML = '';
        if (searchInput) searchInput.value = '';
      });
    });
  }

  async function loadScript(page) {
    const src = pageScripts[page];
    if (!src || loaded.has(src)) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
    loaded.add(src);
  }

  async function render() {
    setLoading(true);
    updateNav();
    await loadScript(state.page);

    const module = window.SuperAuthDocsPages && window.SuperAuthDocsPages[state.page];
    if (!module || typeof module.render !== 'function') {
      mount.innerHTML = '<section class="panel glass"><h2>Missing Page</h2><p>This docs page failed to load.</p></section>';
      setLoading(false);
      return;
    }

    mount.innerHTML = module.render();
    if (typeof module.mount === 'function') {
      await module.mount({ root: mount });
    }
    attachCopyButtons(mount);

    setLoading(false);
  }

  function go(page) {
    state.page = pageRoutes[page] ? page : 'getting-started';
    history.pushState({}, '', pageRoutes[state.page]);
    render().catch(console.error);
  }

  // expose for use in page modules
  window.__docsNavigate = go;

  document.querySelectorAll('#docsNav a').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      go(a.dataset.docsPage);
    });
  });

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderSearchResults(searchInput.value || '');
    });
  }

  window.addEventListener('popstate', () => {
    state.page = getPageFromPath(location.pathname);
    render().catch(console.error);
  });

  initSidebarToggle();
  state.page = getPageFromPath(location.pathname);
  render().catch(console.error);
})();
