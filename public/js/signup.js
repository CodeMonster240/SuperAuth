(function () {
  const steps = Array.from(document.querySelectorAll('.signup-step'));
  const progress = document.getElementById('signupProgress');
  const progressStepLabel = document.getElementById('progressStepLabel');
  const progressPercent = document.getElementById('progressPercent');
  const prevBtn = document.getElementById('prevStepBtn');
  const nextBtn = document.getElementById('nextStepBtn');
  const submitBtn = document.getElementById('submitBtn');
  const form = document.getElementById('signupForm');

  if (!steps.length) return;

  let current = 1;

  function showStep(step) {
    current = step;
    steps.forEach((s) => s.classList.toggle('active', parseInt(s.dataset.step, 10) === step));
    const pct = Math.round((step / steps.length) * 100);
    progress.style.width = `${pct}%`;
    progressStepLabel.textContent = `Step ${step} of ${steps.length}`;
    progressPercent.textContent = `${pct}%`;

    if (window.SuperAuthNumberFlow) {
      window.SuperAuthNumberFlow.enhance(document, { delay: 1000, selector: '#progressPercent' });
    }

    prevBtn.disabled = step === 1;
    const isLast = step === steps.length;
    nextBtn.style.display = isLast ? 'none' : 'inline-flex';
    submitBtn.style.display = isLast ? 'inline-flex' : 'none';
  }

  function validateCurrentStep() {
    const stepEl = steps[current - 1];
    const req = stepEl.querySelectorAll('input[required], select[required], textarea[required]');
    for (const el of req) {
      if (!el.value || !el.checkValidity()) {
        el.reportValidity();
        return false;
      }
    }
    if (current === 3) {
      const pw = document.getElementById('password');
      const cp = document.getElementById('confirmPassword');
      if (pw && cp && pw.value !== cp.value) {
        cp.setCustomValidity('Passwords do not match.');
        cp.reportValidity();
        return false;
      }
      if (cp) cp.setCustomValidity('');
    }
    return true;
  }

  prevBtn.addEventListener('click', () => showStep(Math.max(1, current - 1)));
  nextBtn.addEventListener('click', () => {
    if (!validateCurrentStep()) return;
    showStep(Math.min(steps.length, current + 1));
  });

  form.addEventListener('submit', (e) => {
    if (!validateCurrentStep()) e.preventDefault();
  });

  // Account type picker
  const accountTypeInput = document.getElementById('accountTypeInput');
  document.querySelectorAll('.account-type-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.account-type-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      accountTypeInput.value = card.dataset.type;
    });
  });

  // Password strength meter
  const pw = document.getElementById('password');
  const bar = document.getElementById('passwordMeterBar');
  const hints = document.getElementById('passwordHints');
  if (pw && bar && hints) {
    pw.addEventListener('input', () => {
      const v = pw.value;
      const checks = {
        len: v.length >= 12,
        upper: /[A-Z]/.test(v),
        num: /[0-9]/.test(v),
        special: /[^A-Za-z0-9]/.test(v),
      };
      let score = 0;
      Object.entries(checks).forEach(([k, ok]) => {
        const li = hints.querySelector(`[data-rule="${k}"]`);
        if (li) li.classList.toggle('ok', ok);
        if (ok) score++;
      });
      bar.style.width = `${(score / 4) * 100}%`;
      bar.classList.toggle('good', score >= 3);
      bar.classList.toggle('great', score === 4);
    });
  }

  showStep(1);
})();
