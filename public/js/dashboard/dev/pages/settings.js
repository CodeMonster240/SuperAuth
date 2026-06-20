(function () {
  window.SuperAuthDevPages = window.SuperAuthDevPages || {};

  window.SuperAuthDevPages.settings = {
    async mount({ root, api, setLoading, reload, state }) {
      const form = root.querySelector('#devProfileForm');
      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const data = Object.fromEntries(new FormData(form).entries());
          setLoading(true);
          try {
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
            await reload();
            toast.success('Settings saved!');
          } catch (err) {
            toast.error('Failed to save settings: ' + (err.message || 'Unknown error'));
          } finally {
            setLoading(false);
          }
        });
      }

      const switchBtn = root.querySelector('#switchAccountTypeBtn');
      if (switchBtn) {
        switchBtn.addEventListener('click', async () => {
          const nextType = state.me?.account_type === 'developer' ? 'user' : 'developer';
          const nextLabel = nextType === 'developer' ? 'Developer' : 'Regular User';
          if (!confirm(`Switch to ${nextLabel} account? This will redirect you to the ${nextType === 'developer' ? 'developer console' : 'user dashboard'}.`)) return;

          const originalHtml = switchBtn.innerHTML;
          switchBtn.disabled = true;
          switchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Switching...';

          try {
            await api('/dashboard/api/account-type', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accountType: nextType })
            });
            window.location.href = nextType === 'developer' ? '/dev' : '/dashboard';
          } catch (err) {
            toast.error('Could not switch account type: ' + (err.message || 'Unknown error'));
            switchBtn.disabled = false;
            switchBtn.innerHTML = originalHtml;
          }
        });
      }

      root.querySelector('#themeHintBtn')?.addEventListener('click', () => {
        document.getElementById('themeToggleSide')?.click();
      });
    }
  };
})();
