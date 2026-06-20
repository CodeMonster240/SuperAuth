(function () {
  window.SuperAuthUserPages = window.SuperAuthUserPages || {};

  const socialProviders = [
    { id: 'google', label: 'Google', icon: 'fab fa-google', href: '/auth/google' },
    { id: 'github', label: 'GitHub', icon: 'fab fa-github', href: '/auth/github' },
    { id: 'facebook', label: 'Facebook', icon: 'fab fa-facebook', href: '/auth/facebook' },
    { id: 'instagram', label: 'Instagram', icon: 'fab fa-instagram' },
    { id: 'x', label: 'X', icon: 'fab fa-twitter' },
    { id: 'microsoft', label: 'Microsoft', icon: 'fab fa-microsoft' }
  ];

  window.SuperAuthUserPages.home = {
    render(state) {
      const recent = state.connections.slice(0, 5).map((c) => `
        <li class="list-row">
          <span><strong>${c.name}</strong> ${c.is_active ? '<span class="pill">active</span>' : '<span class="pill">disabled</span>'}</span>
          <small>${new Date(c.connected_at).toLocaleDateString()}</small>
        </li>
      `).join('');

      const linked = new Set(state.social.map((s) => s.provider));
      const socialCards = socialProviders.map((provider) => {
        const isLinked = linked.has(provider.id);
        return `
          <article class="social-home-card glass social-provider-${provider.id} ${isLinked ? 'is-linked' : ''}">
            <div class="social-home-head">
              <div class="social-home-icon"><i class="${provider.icon}"></i></div>
              <div>
                <h4>${provider.label}</h4>
                <p>${isLinked ? 'Already connected' : 'Available to add'}</p>
              </div>
            </div>
            ${
              isLinked
                ? '<span class="pill pill-linked">Linked</span>'
                : (provider.href
                    ? `<a class="btn btn-glass btn-sm" href="${provider.href}?returnTo=/dashboard/settings">Link now</a>`
                    : '<button class="btn btn-ghost btn-sm" type="button" disabled>Link now</button>')
            }
          </article>
        `;
      }).join('');

      return `
        <section class="panel glass">
          <h2>Welcome, ${state.me.display_name}</h2>
          <p>Everything in one place. Jump to integrations, security tools, or account settings.</p>
          <div class="kpi-row">
            <div class="kpi"><span class="kpi-value">${state.connections.length}</span><span class="kpi-label">Integrations</span></div>
            <div class="kpi"><span class="kpi-value">${state.social.length}</span><span class="kpi-label">Linked Socials</span></div>
            <div class="kpi"><span class="kpi-value">${state.me.totp_enabled ? 'Enabled' : 'Off'}</span><span class="kpi-label">2FA Status</span></div>
          </div>
        </section>
        <section class="panel glass">
          <h3>Recent Integration Activity</h3>
          <ul class="plain-list">${recent || '<li>No recent activity yet.</li>'}</ul>
          <div class="inline-actions mt-12">
            <button class="btn btn-glass" data-jump="integrations">Manage Integrations</button>
            <button class="btn btn-glass" data-jump="security">Review Security</button>
          </div>
        </section>

        <section class="panel glass">
          <h3>Connect Socials</h3>
          <p>Link an account to make sign-in faster and keep recovery options open.</p>
          <div class="social-home-grid">${socialCards}</div>
        </section>
      `;
    },

    async mount({ root, go }) {
      root.querySelectorAll('[data-jump]').forEach((btn) => {
        btn.addEventListener('click', () => go(btn.dataset.jump));
      });
    }
  };
})();
