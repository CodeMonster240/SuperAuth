(function () {
  window.SuperAuthDevPages = window.SuperAuthDevPages || {};

  function bars(rows) {
    if (!rows || !rows.length) return '<p style="color:var(--muted)">No events recorded yet.</p>';
    const top = Math.max(...rows.map(r => r.c), 1);
    return '<div class="mini-chart">' + rows.slice(0, 14).map((r) => {
      const pct = Math.max(6, Math.round((r.c / top) * 100));
      return `<div class="chart-row"><span>${r.day} &middot; ${r.event_type}</span><div class="chart-bar"><i style="width:${pct}%"></i></div><strong>${r.c}</strong></div>`;
    }).join('') + '</div>';
  }

  window.SuperAuthDevPages.deeplink = {
    async mount({ root, state, go, api, setLoading }) {
      // Back to integrations list
      root.querySelector('#backToApps')?.addEventListener('click', () => go('apps'));
      // Empty-state button
      root.querySelector('[data-page="apps"]')?.addEventListener('click', () => go('apps'));

      // ── Tab switching ──────────────────────────────────────────────────────
      const tabs  = root.querySelectorAll('.int-tab');
      const panes = root.querySelectorAll('.int-pane');

      const tabToSeg  = { url: 'deeplink', token: 'token', settings: 'settings', analytics: 'analytics' };
      const segToTab   = { deeplink: 'url', token: 'token', settings: 'settings', analytics: 'analytics' };

      // ── Button Widget preview loader (declared before showTab to avoid TDZ) ─────────
      let btnWidgetLoaded = false;
      function loadBtnWidget(scopeRoot) {
        const alreadyEnhanced = scopeRoot.querySelector('[data-sa-enhanced]');
        if (alreadyEnhanced) return;
        const enhance = () => {
          scopeRoot.querySelectorAll('.superauth-btn:not([data-sa-enhanced])').forEach(el => {
            window.SuperAuthBtn?.enhance(el.closest('div') || scopeRoot);
          });
          scopeRoot.querySelectorAll('.superauth-btn--preview button').forEach(b => {
            b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); });
          });
        };
        if (window.SuperAuthBtn) { enhance(); return; }
        if (btnWidgetLoaded) return;
        btnWidgetLoaded = true;
        const s = document.createElement('script');
        s.src = '/js/btn.js';
        s.onload = enhance;
        document.body.appendChild(s);
      }

      function showTab(name, pushUrl = true) {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        panes.forEach(p => { p.style.display = p.id === 'pane-' + name ? '' : 'none'; });
        if (pushUrl && state.activeApp) {
          const seg = tabToSeg[name] || 'deeplink';
          history.pushState({}, '', `/dev/integration/${state.activeApp.slug}/${seg}`);
        }
        if (name === 'analytics') loadAnalytics();
        if (name === 'url') loadBtnWidget(root);
      }

      // Expose for popstate tab-switch from devDashboard
      window.SuperAuthIntTabSwitch = (name) => showTab(name, false);

      // Init from current URL
      const urlSeg    = location.pathname.split('/').pop();
      const initTab   = segToTab[urlSeg] || 'url';
      showTab(initTab, false);

      tabs.forEach(btn => btn.addEventListener('click', () => showTab(btn.dataset.tab)));

      // "Settings tab" link inside warn callout
      root.querySelectorAll('[data-tab-jump]').forEach(el => {
        el.addEventListener('click', () => showTab(el.dataset.tabJump));
      });

      // ── URL tab ───────────────────────────────────────────────────────────
      root.querySelectorAll('.code-copy-btn[data-copy-target]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const el = root.querySelector('#' + btn.dataset.copyTarget + ' code');
          if (!el) return;
          await navigator.clipboard.writeText(el.textContent.trim());
          const icon = btn.querySelector('i');
          icon.className = 'fas fa-check';
          btn.classList.add('copied');
          setTimeout(() => { icon.className = 'fas fa-copy'; btn.classList.remove('copied'); }, 1600);
        });
      });

      const deepLinkCodeEl = root.querySelector('#deepLinkUrl code');

      root.querySelector('#copyDeepLink')?.addEventListener('click', async (e) => {
        const url = deepLinkCodeEl?.textContent?.trim() || '';
        await navigator.clipboard.writeText(url);
        const btn = e.currentTarget; const old = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => { btn.innerHTML = old; }, 1200);
      });

      root.querySelector('#copyEmbed')?.addEventListener('click', async (e) => {
        const snippetEl = root.querySelector('#btnWidgetSnippet code');
        const text = snippetEl ? snippetEl.textContent.trim() : '';
        await navigator.clipboard.writeText(text);
        const btn = e.currentTarget; const old = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        setTimeout(() => { btn.innerHTML = old; }, 1200);
      });

      // ── Button Widget preview loader ───────────────────────────────────────
      // (function is defined earlier in this file, above showTab)

      // Shorten URL
      root.querySelector('#shortenDeepLink')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const url = deepLinkCodeEl?.textContent?.trim() || '';
        if (!url || !state.activeApp) return;
        const old = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
        try {
          const data = await api(`/dev/api/apps/${state.activeApp.slug}/shorten`, {
            method: 'POST',
            body: JSON.stringify({ url }),
          });
          const row   = root.querySelector('#shortUrlRow');
          const input = root.querySelector('#shortUrlInput');
          input.value = data.short_url;
          row.style.display = '';
        } catch (err) {
          toast.error('Could not shorten URL: ' + (err.message || 'Unknown error'));
        } finally {
          btn.innerHTML = old;
          btn.disabled = false;
        }
      });

      root.querySelector('#copyShortUrl')?.addEventListener('click', async (e) => {
        const input = root.querySelector('#shortUrlInput');
        if (!input?.value) return;
        await navigator.clipboard.writeText(input.value);
        const btn = e.currentTarget; const old = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = old; }, 1200);
      });

      // ── Settings tab ──────────────────────────────────────────────────────

      // Copy client ID
      root.querySelectorAll('[data-copy-client]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await navigator.clipboard.writeText(btn.dataset.copyClient);
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = orig; }, 1200);
        });
      });

      // Rotate secret
      root.querySelectorAll('[data-regen-secret]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const slug = btn.dataset.regenSecret;
          const ok = await toast.confirm(
            'Rotate client secret? All existing backend integrations using the old secret will break immediately.',
            { confirmText: 'Rotate', danger: true }
          );
          if (!ok) return;
          setLoading(true);
          const data = await api(`/dev/api/apps/${slug}/regen-secret`, { method: 'POST' });
          setLoading(false);
          await toast.secret('New Client Secret', data.client_secret);
        });
      });

      // Edit form
      const editForm = root.querySelector('#editIntegrationForm');
      if (editForm) {
        editForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const slug = editForm.dataset.slug;
          const body = {
            name:         editForm.querySelector('[name="name"]').value,
            description:  editForm.querySelector('[name="description"]').value,
            website_url:  editForm.querySelector('[name="website_url"]').value,
            callback_url: editForm.querySelector('[name="callback_url"]').value,
            logo_url:     editForm.querySelector('[name="logo_url"]').value,
            is_active:    editForm.querySelector('[name="is_active"]').checked ? 1 : 0,
          };
          setLoading(true);
          try {
            await api(`/dev/api/apps/${slug}`, { method: 'PATCH', body: JSON.stringify(body) });
            if (state.activeApp) state.activeApp.name = body.name;
            toast.success('Integration updated!');
          } catch (err) {
            toast.error('Save failed: ' + (err.message || 'Unknown error'));
          }
          setLoading(false);
        });
      }

      // Delete integration
      root.querySelector('#deleteIntegrationBtn')?.addEventListener('click', async (e) => {
        const { slug, name } = e.currentTarget.dataset;
        const ok = await toast.confirm(
          `Delete "${name}"? This cannot be undone — all credentials and analytics will be lost.`,
          { confirmText: 'Delete', danger: true }
        );
        if (!ok) return;
        setLoading(true);
        await api(`/dev/api/apps/${slug}`, { method: 'DELETE' });
        state.activeApp = null;
        setLoading(false);
        go('apps');
      });

      // ── Analytics tab (lazy-loaded) ───────────────────────────────────────
      let analyticsLoaded = false;
      async function loadAnalytics() {
        if (analyticsLoaded || !state.activeApp) return;
        analyticsLoaded = true;
        const mount = root.querySelector('#dlAnalyticsMount');
        if (!mount) return;
        try {
          const data = await api(`/dev/api/apps/${state.activeApp.slug}/analytics`);
          mount.innerHTML = `
            <div class="kpi-row" style="margin-bottom:14px">
              <div class="kpi"><span class="kpi-value">${data.signups}</span><span class="kpi-label">Signups</span></div>
              <div class="kpi"><span class="kpi-value">${data.logins}</span><span class="kpi-label">Logins</span></div>
              <div class="kpi"><span class="kpi-value">${data.clickthroughs}</span><span class="kpi-label">Clickthroughs</span></div>
            </div>
            <h4 style="margin:0 0 10px;color:var(--muted);font-size:0.85rem;text-transform:uppercase;letter-spacing:0.06em">Recent Events (last 30 days)</h4>
            ${bars(data.dailyCounts)}
          `;
        } catch {
          mount.innerHTML = '<p style="color:var(--muted)">Could not load analytics.</p>';
        }
      }
    }
  };
})();

