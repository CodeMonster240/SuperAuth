(function () {
  window.SuperAuthUserPages = window.SuperAuthUserPages || {};

  window.SuperAuthUserPages.security = {
    render(state) {
      return `
        <section class="panel glass">
          <h2>Security Center</h2>
          <p>Protect your account with two-factor authentication and a strong password routine.</p>
          <div class="kpi-row">
            <div class="kpi"><span class="kpi-value">${state.me.totp_enabled ? '90' : '65'}</span><span class="kpi-label">Security Score</span></div>
            <div class="kpi"><span class="kpi-value">${state.me.totp_enabled ? 'On' : 'Off'}</span><span class="kpi-label">2FA</span></div>
            <div class="kpi"><span class="kpi-value">${state.social.length}</span><span class="kpi-label">Recovery Providers</span></div>
          </div>
        </section>
        <section class="panel glass">
          <h3>Two-Factor Authentication</h3>
          <p>${state.me.totp_enabled ? '2FA is currently enabled.' : 'Add 2FA in under a minute.'}</p>
          <div class="inline-actions wrap">
            <button class="btn btn-primary" id="setup2fa">${state.me.totp_enabled ? 'Reconfigure 2FA' : 'Setup 2FA'}</button>
          </div>
          <div id="twoFaMount" class="mt-12"></div>
        </section>
      `;
    },

    async mount({ root, api, load, setLoading, go }) {
      const setup2fa = root.querySelector('#setup2fa');
      const mount = root.querySelector('#twoFaMount');
      if (!setup2fa || !mount) return;

      setup2fa.addEventListener('click', async () => {
        setLoading(true);
        const data = await api('/api/user/totp/setup');
        mount.innerHTML = `
          <div class="glass p-12">
            <img src="${data.qrUrl}" alt="QR code" style="max-width:200px;border-radius:16px"/>
            <p>Manual secret: <code>${data.secret}</code></p>
            <div class="inline-actions wrap">
              <input id="totpCode" placeholder="Enter 6-digit code" style="max-width:220px"/>
              <button id="enable2fa" class="btn btn-primary">Enable</button>
            </div>
          </div>
        `;
        setLoading(false);

        const enableBtn = root.querySelector('#enable2fa');
        if (enableBtn) {
          enableBtn.addEventListener('click', async () => {
            const token = root.querySelector('#totpCode').value;
            setLoading(true);
            await api('/api/user/totp/enable', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token })
            });
            await load();
            setLoading(false);
            go('home');
          });
        }
      });
    }
  };
})();
