(function () {
  window.SuperAuthUserPages = window.SuperAuthUserPages || {};

  function renderItems(items) {
    return items.map((c) => `
      <div class="integration-item glass">
        <div>
          <h4>${c.name}</h4>
          <p>${c.description || 'No description.'}</p>
          <small>Connected: ${new Date(c.connected_at).toLocaleString()}</small>
        </div>
        <div class="inline-actions wrap">
          <button class="btn btn-ghost" data-action="toggle" data-app="${c.app_id}" data-active="${c.is_active ? 0 : 1}">${c.is_active ? 'Disable' : 'Enable'}</button>
          <button class="btn btn-outline" data-action="delete" data-app="${c.app_id}">Delete</button>
        </div>
      </div>
    `).join('');
  }

  window.SuperAuthUserPages.integrations = {
    render(state) {
      const rows = renderItems(state.connections);
      return `
        <section class="panel glass">
          <div class="inline-actions" style="justify-content:space-between;">
            <h2 style="margin:0;">Integrations</h2>
            <input id="integrationSearch" placeholder="Search integrations" style="max-width:260px;"/>
          </div>
          <p>Disable access temporarily or remove integrations completely.</p>
        </section>
        <section id="integrationList">${rows || '<section class="panel glass"><p>No integrations yet.</p></section>'}</section>
      `;
    },

    async mount({ root, api, load, setLoading, state }) {
      const listEl = root.querySelector('#integrationList');

      async function bind() {
        root.querySelectorAll('[data-action="toggle"]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            setLoading(true);
            await api(`/dashboard/api/connections/${btn.dataset.app}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ active: parseInt(btn.dataset.active, 10) === 1 })
            });
            await load();
            listEl.innerHTML = renderItems(state.connections);
            setLoading(false);
            bind();
          });
        });

        root.querySelectorAll('[data-action="delete"]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            if (!confirm('Delete this integration link?')) return;
            setLoading(true);
            await api(`/dashboard/api/connections/${btn.dataset.app}`, { method: 'DELETE' });
            await load();
            listEl.innerHTML = renderItems(state.connections);
            setLoading(false);
            bind();
          });
        });
      }

      const search = root.querySelector('#integrationSearch');
      if (search) {
        search.addEventListener('input', () => {
          const q = search.value.toLowerCase().trim();
          const filtered = q ? state.connections.filter(c => (c.name || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q)) : state.connections;
          listEl.innerHTML = renderItems(filtered) || '<section class="panel glass"><p>No matching integrations.</p></section>';
          bind();
        });
      }

      await bind();
    }
  };
})();
