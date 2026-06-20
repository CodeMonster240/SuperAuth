(function () {
  let modulePromise;
  let observer;

  function loadNumberFlow() {
    if (!modulePromise) {
      modulePromise = import('https://unpkg.com/number-flow?module');
    }
    return modulePromise;
  }

  function getObserver() {
    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const host = entry.target;
          const state = host._numberFlowState;
          if (state) runAnimation(host, state.targetValue, state.options);
          observer.unobserve(host);
        });
      }, { threshold: 0.3 });
    }
    return observer;
  }

  function parseNumericContent(host) {
    if (host.dataset.target) {
      const value = Number.parseFloat(host.dataset.target);
      if (!Number.isFinite(value)) return null;
      return {
        value,
        decimals: Number.parseInt(host.dataset.decimal || '0', 10) || 0,
        suffix: host.dataset.suffix || '',
        start: Number.parseFloat(host.dataset.start || '0') || 0,
      };
    }

    const text = (host.dataset.numberFlowValue || host.textContent || '').trim();
    const match = text.match(/^(-?[\d,]+(?:\.\d+)?)(?:\s*)([%a-zA-Z+]+)?$/);
    if (!match) return null;

    const value = Number.parseFloat(match[1].replace(/,/g, ''));
    if (!Number.isFinite(value)) return null;

    const decimalPart = match[1].split('.')[1];

    return {
      value,
      decimals: decimalPart ? decimalPart.length : 0,
      suffix: match[2] || '',
      start: Number.parseFloat(host.dataset.start || '0') || 0,
    };
  }

  function renderFallback(host, target) {
    host.textContent = target.rawText;
  }

  function mount(host, NumberFlow, target, options) {
    const flow = document.createElement('number-flow');
    flow.className = 'sa-number-flow';
    flow.format = {
      minimumFractionDigits: target.decimals,
      maximumFractionDigits: target.decimals,
    };
    flow.numberSuffix = target.suffix;
    flow.trend = options.trend ?? 1;
    flow.willChange = true;
    flow.spinTiming = options.spinTiming || {
      duration: 1350,
      easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
    };
    flow.transformTiming = options.transformTiming || {
      duration: 1350,
      easing: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
    };
    flow.opacityTiming = options.opacityTiming || {
      duration: 420,
      easing: 'ease-out',
    };

    if (options.continuous !== false && typeof NumberFlow.continuous === 'function') {
      flow.plugins = [NumberFlow.continuous];
    }

    host.textContent = '';
    host.appendChild(flow);
    flow.update(target.start);

    host._numberFlowState = {
      flow,
      targetValue: target.value,
      options,
      rawText: target.rawText,
      timeoutId: null,
      hasAnimated: false,
    };

    return host._numberFlowState;
  }

  function runAnimation(host, value, options) {
    const state = host._numberFlowState;
    if (!state) return;
    if (state.timeoutId) window.clearTimeout(state.timeoutId);
    const delay = typeof options.delay === 'number' ? options.delay : 1000;
    state.timeoutId = window.setTimeout(() => {
      state.flow.update(value);
      state.hasAnimated = true;
      state.timeoutId = null;
    }, Math.max(0, delay));
  }

  async function enhance(root, options = {}) {
    const scope = root || document;
    const selector = options.selector || '[data-number-flow], .stat-num, .kpi-value, .chart-row strong, #progressPercent';
    const hosts = Array.from(scope.querySelectorAll(selector));
    if (!hosts.length) return;

    let NumberFlow;
    try {
      NumberFlow = await loadNumberFlow();
    } catch (err) {
      hosts.forEach((host) => {
        const target = parseNumericContent(host);
        if (!target) return;
        target.rawText = `${new Intl.NumberFormat('en-US', {
          minimumFractionDigits: target.decimals,
          maximumFractionDigits: target.decimals,
        }).format(target.value)}${target.suffix}`;
        renderFallback(host, target);
      });
      return;
    }

    hosts.forEach((host) => {
      const target = parseNumericContent(host);
      if (!target) return;

      target.rawText = `${new Intl.NumberFormat('en-US', {
        minimumFractionDigits: target.decimals,
        maximumFractionDigits: target.decimals,
      }).format(target.value)}${target.suffix}`;

      const state = host._numberFlowState || mount(host, NumberFlow, target, options);
      state.targetValue = target.value;
      state.rawText = target.rawText;
      state.options = options;

      if (host.matches('.stat-num') || host.hasAttribute('data-number-flow-observe')) {
        getObserver().observe(host);
        return;
      }

      runAnimation(host, target.value, options);
    });
  }

  window.SuperAuthNumberFlow = {
    enhance,
  };
})();
