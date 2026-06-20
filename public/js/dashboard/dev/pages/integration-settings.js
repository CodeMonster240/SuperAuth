(function () {
  window.SuperAuthDevPages = window.SuperAuthDevPages || {};

  window.SuperAuthDevPages.intSettings = {
    async mount({ root, state, go, api, setLoading }) {
      // Empty state
      root.querySelector('[data-page="apps"]')?.addEventListener('click', () => go('apps'));

      // Back button → return to deeplink view
      root.querySelector('#backToDeeplink')?.addEventListener('click', () => {
        go('deeplink', state.activeApp?.slug);
      });

      // Copy client ID
      root.querySelectorAll('[data-copy-client]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await navigator.clipboard.writeText(btn.dataset.copyClient);
          const original = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = original; }, 1200);
        });
      });

      // Rotate secret
      root.querySelectorAll('[data-regen-secret]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const slug = btn.dataset.regenSecret;
          const ok = await toast.confirm(
            'Rotate client secret? All existing backend integrations using the old secret will break.',
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
            name: editForm.querySelector('[name="name"]').value,
            description: editForm.querySelector('[name="description"]').value,
            website_url: editForm.querySelector('[name="website_url"]').value,
            callback_url: editForm.querySelector('[name="callback_url"]').value,
            is_active: editForm.querySelector('[name="is_active"]').checked ? 1 : 0,
          };
          setLoading(true);
          const res = await api(`/dev/api/apps/${slug}`, { method: 'PATCH', body: JSON.stringify(body) });
          setLoading(false);
          if (res && res.ok) {
            // Update activeApp name in state so sidenav/header stays fresh
            if (state.activeApp) state.activeApp.name = body.name;
            toast.success('Integration updated!');
          }
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
    }
  };
})();
