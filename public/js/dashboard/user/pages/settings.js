(function () {
  window.SuperAuthUserPages = window.SuperAuthUserPages || {};

  const socialProviders = [
    { id: 'google', label: 'Google', icon: 'fab fa-google', href: '/auth/google' },
    { id: 'github', label: 'GitHub', icon: 'fab fa-github', href: '/auth/github', note: 'Callback: /auth/github/callback' },
    { id: 'facebook', label: 'Facebook', icon: 'fab fa-facebook', href: '/auth/facebook' },
    { id: 'instagram', label: 'Instagram', icon: 'fab fa-instagram', note: 'Meta strategy required' },
    { id: 'x', label: 'X', icon: 'fab fa-twitter', note: 'Strategy required' },
    { id: 'microsoft', label: 'Microsoft', icon: 'fab fa-microsoft', note: 'Strategy required' }
  ];

  function providerById(id) {
    return socialProviders.find((p) => p.id === id) || {
      id,
      label: id,
      icon: 'fas fa-link'
    };
  }

  function socialConnectButtons(linkedIds) {
    const linked = new Set(linkedIds);
    const cards = socialProviders
      .filter((provider) => !linked.has(provider.id))
      .map((provider) => {
        const href = provider.href ? `${provider.href}?returnTo=/dashboard/settings` : null;
        return `
          <div class="social-connect-card glass social-provider-${provider.id}">
            <div class="social-connect-meta">
              <i class="${provider.icon}"></i>
              <div>
                <strong>${provider.label}</strong>
                <span>${provider.note || 'Connect your account'}</span>
              </div>
            </div>
            ${
              href
                ? `<a class="btn btn-glass btn-sm" href="${href}">Link</a>`
                : `<button class="btn btn-ghost btn-sm" type="button" disabled title="Configure provider strategy first">Link</button>`
            }
          </div>
        `;
      })
      .join('');

    return cards || '<p class="muted-note">All available social providers are already linked.</p>';
  }

  window.SuperAuthUserPages.settings = {
    render(state) {
      const linkedIds = state.social.map((s) => s.provider);
      const social = state.social.length
        ? state.social.map((s) => {
            const provider = providerById(s.provider);
            return `
              <article class="social-linked-card glass social-provider-${provider.id}">
                <div class="social-linked-top">
                  <div class="social-linked-badge">
                    <i class="${provider.icon}"></i>
                  </div>
                  <div>
                    <h4>${provider.label}</h4>
                    <p>Connected ${new Date(s.linked_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <button class="btn btn-outline btn-sm" data-unlink="${s.provider}">Unlink</button>
              </article>
            `;
          }).join('')
        : '<div class="empty-state glass"><strong>No linked social accounts yet.</strong><p>Connect one below to make login easier.</p></div>';

      const accountTypeLabel = state.me.account_type === 'developer' ? 'Developer' : 'Regular User';
      const accountTypeIcon = state.me.account_type === 'developer' ? 'fa-code' : 'fa-user';
      const nextAccountType = state.me.account_type === 'developer' ? 'user' : 'developer';
      const nextLabel = nextAccountType === 'developer' ? 'Developer' : 'Regular User';

      return `
        <section class="panel glass">
          <h2>Account Settings</h2>
          <p>Update profile info, linked accounts, and password.</p>
        </section>

        <section class="panel glass">
          <h3>Account Type</h3>
          <p>Currently <strong><i class="fas ${accountTypeIcon}"></i> ${accountTypeLabel}</strong></p>
          <button class="btn btn-glass" id="switchAccountTypeBtn">Switch to ${nextLabel}</button>
        </section>

        <section class="panel glass">
          <h3>Profile</h3>
          <form id="profileForm">
            <div class="form-row two">
              <label>Display Name<input name="displayName" value="${state.me.display_name || ''}"/></label>
              <label>Country<input name="country" value="${state.me.country || ''}"/></label>
            </div>
            <div class="form-row two">
              <label>Language<input name="language" value="${state.me.language || 'en'}"/></label>
              <label>Gender<input name="gender" value="${state.me.gender || ''}"/></label>
            </div>
            <label class="checkbox-line"><input type="checkbox" name="marketingOk" ${state.me.marketing_ok ? 'checked' : ''}/> Product updates and security notices</label>
            <button class="btn btn-primary" type="submit">Save Profile</button>
          </form>
        </section>

        <section class="panel glass">
          <h3>Linked Social Accounts</h3>
          <div class="social-linked-grid">${social}</div>
        </section>

        <section class="panel glass">
          <h3>Connect More Socials</h3>
          <p>Pick a provider to add. Already linked services are hidden here.</p>
          <div class="social-connect-grid">
            ${socialConnectButtons(linkedIds)}
          </div>
        </section>

        <section class="panel glass">
          <h3>Change Password</h3>
          <form id="passwordForm">
            <div class="form-row two">
              <label>Current Password<input type="password" name="currentPassword" required minlength="12"/></label>
              <label>New Password<input type="password" name="newPassword" required minlength="12"/></label>
            </div>
            <button class="btn btn-primary" type="submit">Update Password</button>
          </form>
        </section>
      `;
    },

    async mount({ root, state, api, load, reload, setLoading }) {
      // Account type switch
      const switchBtn = root.querySelector('#switchAccountTypeBtn');
      if (switchBtn) {
        switchBtn.addEventListener('click', async () => {
          const nextType = state.me.account_type === 'developer' ? 'user' : 'developer';
          const label = nextType === 'developer' ? 'Developer' : 'Regular User';
          if (!confirm(`Switch to ${label} account? This will redirect you to your new dashboard.`)) return;
          setLoading(true);
          await api('/dashboard/api/account-type', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountType: nextType })
          });
          window.location.href = nextType === 'developer' ? '/dev' : '/dashboard';
        });
      }
      const profileForm = root.querySelector('#profileForm');
      if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(profileForm).entries());
          setLoading(true);
          await api('/dashboard/api/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              displayName: data.displayName,
              country: data.country,
              language: data.language,
              gender: data.gender,
              marketingOk: !!data.marketingOk
            })
          });
          await load();
          setLoading(false);
          alert('Profile updated.');
        });
      }

      root.querySelectorAll('[data-unlink]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm(`Unlink ${btn.dataset.unlink}?`)) return;
          setLoading(true);
          await api(`/dashboard/api/social/${btn.dataset.unlink}`, { method: 'DELETE' });
          await reload();
          setLoading(false);
        });
      });

      const passwordForm = root.querySelector('#passwordForm');
      if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(passwordForm).entries());
          setLoading(true);
          await api('/dashboard/api/password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          setLoading(false);
          passwordForm.reset();
          alert('Password updated.');
        });
      }
    }
  };
})();
