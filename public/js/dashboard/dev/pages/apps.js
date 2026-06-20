(function () {
  window.SuperAuthDevPages = window.SuperAuthDevPages || {};

  window.SuperAuthDevPages.apps = {
    async mount({ root, state, api, go, setLoading }) {
      const form     = root.querySelector('#newAppForm');
      const newBtn   = root.querySelector('#newIntegrationBtn');
      const cancel   = root.querySelector('#cancelNewApp');
      const emptyBtn = root.querySelector('#emptyNewBtn');

      function showForm() {
        form.style.display = '';
        form.querySelector('[name="name"]')?.focus();
      }

      newBtn?.addEventListener('click', showForm);
      emptyBtn?.addEventListener('click', showForm);
      cancel?.addEventListener('click', () => { form.style.display = 'none'; form.reset(); });

      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = Object.fromEntries(new FormData(form).entries());
        setLoading(true);
        try {
          const app = await api('/dev/api/apps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          state.activeApp = app;
          go('deeplink', app.slug, `/dev/integration/${app.slug}`);
        } catch (err) {
          toast.error('Failed to create integration: ' + (err.message || 'Unknown error'));
          setLoading(false);
        }
      });

      root.querySelectorAll('[data-open-app]').forEach((card) => {
        card.addEventListener('click', () => {
          const slug = card.dataset.openApp;
          state.activeApp = state.apps.find(a => a.slug === slug) || null;
          go('deeplink', slug, `/dev/integration/${slug}`);
        });
      });
    }
  };
})();
