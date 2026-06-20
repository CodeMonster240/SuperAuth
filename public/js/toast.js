/**
 * SuperAuth Toast & Modal System
 * Provides: toast.success/error/warn/info, toast.confirm(), toast.secret()
 */
(function () {
  // ── Toast container ──────────────────────────────────────────────────────
  function getContainer() {
    let c = document.getElementById('saToastContainer');
    if (!c) {
      c = document.createElement('div');
      c.id = 'saToastContainer';
      document.body.appendChild(c);
    }
    return c;
  }

  function show(message, type, duration) {
    type     = type     || 'info';
    duration = duration !== undefined ? duration : 3800;

    const icons = {
      success: 'fa-check-circle',
      error:   'fa-times-circle',
      warn:    'fa-exclamation-triangle',
      info:    'fa-info-circle'
    };

    const el = document.createElement('div');
    el.className = 'sa-toast sa-toast-' + type;
    el.innerHTML =
      '<i class="fas ' + (icons[type] || icons.info) + '"></i>' +
      '<span class="sa-toast-msg">' + message + '</span>' +
      '<button class="sa-toast-close" aria-label="Close">&times;</button>';

    getContainer().appendChild(el);

    // Trigger entrance animation next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('sa-toast-in'));
    });

    function dismiss() {
      if (el._dismissed) return;
      el._dismissed = true;
      el.classList.remove('sa-toast-in');
      el.classList.add('sa-toast-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }

    el.querySelector('.sa-toast-close').addEventListener('click', dismiss);
    if (duration > 0) setTimeout(dismiss, duration);

    return dismiss;
  }

  // ── Confirm modal ────────────────────────────────────────────────────────
  function confirm(message, opts) {
    opts = opts || {};
    const confirmText = opts.confirmText || 'Confirm';
    const cancelText  = opts.cancelText  || 'Cancel';
    const danger      = !!opts.danger;
    const title       = opts.title || null;

    return new Promise(function (resolve) {
      const overlay = document.createElement('div');
      overlay.className = 'sa-modal-overlay';
      overlay.innerHTML =
        '<div class="sa-modal-box" role="dialog" aria-modal="true">' +
          (title ? '<h3 class="sa-modal-title">' + title + '</h3>' : '') +
          '<p class="sa-modal-msg">' + message + '</p>' +
          '<div class="sa-modal-actions">' +
            '<button class="btn btn-glass sa-modal-cancel">' + cancelText + '</button>' +
            '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + ' sa-modal-confirm">' + confirmText + '</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => overlay.classList.add('sa-modal-in'));
      });

      function close(result) {
        overlay.classList.remove('sa-modal-in');
        overlay.classList.add('sa-modal-out');
        overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
        resolve(result);
      }

      overlay.querySelector('.sa-modal-confirm').addEventListener('click', () => close(true));
      overlay.querySelector('.sa-modal-cancel').addEventListener('click', () => close(false));
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(false); });

      // Focus confirm button
      setTimeout(() => overlay.querySelector('.sa-modal-confirm').focus(), 50);
    });
  }

  // ── Secret display modal ─────────────────────────────────────────────────
  function secret(label, value) {
    return new Promise(function (resolve) {
      const overlay = document.createElement('div');
      overlay.className = 'sa-modal-overlay';
      overlay.innerHTML =
        '<div class="sa-modal-box sa-modal-secret" role="dialog" aria-modal="true">' +
          '<div class="sa-modal-secret-icon"><i class="fas fa-key"></i></div>' +
          '<h3 class="sa-modal-title">' + label + '</h3>' +
          '<p class="sa-modal-note">This is the only time this secret will be shown. Copy it now.</p>' +
          '<div class="sa-secret-field">' +
            '<input class="sa-secret-input" type="password" value="' + value.replace(/"/g, '&quot;') + '" readonly />' +
            '<button class="sa-secret-reveal btn-icon" aria-label="Toggle visibility"><i class="fas fa-eye"></i></button>' +
          '</div>' +
          '<button class="btn btn-primary sa-secret-copy" style="width:100%;margin-top:10px">Copy Secret</button>' +
          '<div class="sa-modal-actions" style="margin-top:14px">' +
            '<button class="btn btn-glass sa-modal-done" style="width:100%">Done</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(overlay);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => overlay.classList.add('sa-modal-in'));
      });

      function close() {
        overlay.classList.remove('sa-modal-in');
        overlay.classList.add('sa-modal-out');
        overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
        resolve();
      }

      const input = overlay.querySelector('.sa-secret-input');

      overlay.querySelector('.sa-secret-reveal').addEventListener('click', function (e) {
        const hidden = input.type === 'password';
        input.type = hidden ? 'text' : 'password';
        e.currentTarget.querySelector('i').className = 'fas fa-eye' + (hidden ? '-slash' : '');
      });

      const copyBtn = overlay.querySelector('.sa-secret-copy');
      copyBtn.addEventListener('click', async function () {
        await navigator.clipboard.writeText(value);
        copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        copyBtn.disabled = true;
        setTimeout(() => {
          copyBtn.innerHTML = 'Copy Secret';
          copyBtn.disabled = false;
        }, 2000);
      });

      overlay.querySelector('.sa-modal-done').addEventListener('click', close);

      // Click backdrop to close
      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });

      // Focus copy button immediately
      setTimeout(() => copyBtn.focus(), 50);
    });
  }

  window.toast = {
    show:    show,
    success: function (m, d) { return show(m, 'success', d); },
    error:   function (m, d) { return show(m, 'error', d); },
    warn:    function (m, d) { return show(m, 'warn', d); },
    info:    function (m, d) { return show(m, 'info', d); },
    confirm: confirm,
    secret:  secret
  };
})();
