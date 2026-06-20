(function () {
  window.SuperAuthDevPages = window.SuperAuthDevPages || {};

  function bars(rows) {
    if (!rows.length) return '<p>No analytics events yet.</p>';
    const top = Math.max(...rows.map(r => r.c), 1);
    return rows.slice(0, 14).map((r) => {
      const pct = Math.max(6, Math.round((r.c / top) * 100));
      return `<div class="chart-row"><span>${r.day} &middot; ${r.event_type}</span><div class="chart-bar"><i style="width:${pct}%"></i></div><strong>${r.c}</strong></div>`;
    }).join('');
  }

  window.SuperAuthDevPages.analytics = {
    async mount({ root, state, api }) {
      if (!state.activeApp) return;
      const mount = root.querySelector('#analyticsMount');
      const data = await api(`/dev/api/apps/${state.activeApp.slug}/analytics`);
      mount.innerHTML = `
        <div class="kpi-row">
          <div class="kpi"><span class="kpi-value">${data.signups}</span><span class="kpi-label">Signups</span></div>
          <div class="kpi"><span class="kpi-value">${data.logins}</span><span class="kpi-label">Logins</span></div>
          <div class="kpi"><span class="kpi-value">${data.clickthroughs}</span><span class="kpi-label">Clickthroughs</span></div>
        </div>
        <div class="panel glass mt-12">
          <h3>Recent Event Trend</h3>
          <div class="mini-chart">${bars(data.dailyCounts || [])}</div>
        </div>
      `;
    }
  };
})();
