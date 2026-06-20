(function () {
  window.SuperAuthDevPages = window.SuperAuthDevPages || {};

  window.SuperAuthDevPages.sandbox = {
    async mount({ root, api, setLoading, reload, go }) {
      // ── Terminal + SSE ────────────────────────────────────────────────────
      const terminal  = root.querySelector('#sbTerminal');
      const badge     = root.querySelector('#sbStatusBadge');
      let   autoScroll = true;
      let   sseSource  = null;

      function setStatus(status) {
        const dot  = badge?.querySelector('.sb-status-dot');
        const text = badge?.querySelector('.sb-status-text');
        const map  = { running: ['status-green', 'running'], stopped: ['status-muted', 'stopped'], restarting: ['', 'restarting…'] };
        const [cls, label] = map[status] || ['', status];
        if (dot)  { dot.className = 'sb-status-dot ' + cls; }
        if (text) { text.textContent = label; }
        // toggle button states
        const startBtn   = root.querySelector('#sbStartBtn');
        const stopBtn    = root.querySelector('#sbStopBtn');
        const restartBtn = root.querySelector('#sbRestartBtn');
        if (startBtn)   startBtn.disabled   = status === 'running';
        if (stopBtn)    stopBtn.disabled    = status === 'stopped';
        if (restartBtn) restartBtn.disabled = false;
      }

      function appendLine(type, text) {
        const wasEmpty = terminal.querySelector('.sb-term-placeholder');
        if (wasEmpty) wasEmpty.remove();

        const line = document.createElement('div');
        line.className = 'sb-line sb-line-' + type;
        line.textContent = text;
        terminal.appendChild(line);

        if (autoScroll) terminal.scrollTop = terminal.scrollHeight;

        // Cap displayed lines at 500
        const lines = terminal.querySelectorAll('.sb-line');
        if (lines.length > 500) lines[0].remove();
      }

      function connectSSE() {
        if (sseSource) { sseSource.close(); sseSource = null; }
        sseSource = new EventSource('/dev/api/sandbox/logs');

        sseSource.addEventListener('status', (e) => {
          const { status } = JSON.parse(e.data);
          setStatus(status);
        });

        sseSource.onmessage = (e) => {
          const { type, text } = JSON.parse(e.data);
          appendLine(type, text);
        };

        sseSource.onerror = () => {
          setStatus('stopped');
        };
      }

      connectSSE();

      // Navigate to apps/integrations when clicked in callout
      root.querySelectorAll('[data-page="apps"]').forEach(el => {
        el.addEventListener('click', (e) => { e.preventDefault(); go('apps'); });
      });

      // Auto-scroll toggle on user scroll
      terminal?.addEventListener('scroll', () => {
        const atBottom = terminal.scrollHeight - terminal.scrollTop - terminal.clientHeight < 30;
        autoScroll = atBottom;
      });

      // Clear log
      root.querySelector('#sbClearBtn')?.addEventListener('click', () => {
        terminal.innerHTML = '<div class="sb-term-placeholder">Log cleared.</div>';
      });

      // Process control buttons
      async function sandboxAction(action) {
        try {
          await fetch('/dev/api/sandbox/' + action, { method: 'POST' });
        } catch (err) {
          toast.error('Failed: ' + err.message);
        }
      }

      root.querySelector('#sbStartBtn')?.addEventListener('click',   () => sandboxAction('start'));
      root.querySelector('#sbStopBtn')?.addEventListener('click',    () => sandboxAction('stop'));
      root.querySelector('#sbRestartBtn')?.addEventListener('click', () => sandboxAction('restart'));

      // Clean up SSE when page unloads / tab switches
      const origUnmount = () => { if (sseSource) { sseSource.close(); sseSource = null; } };
      window.addEventListener('beforeunload', origUnmount);

      // ── Config form ───────────────────────────────────────────────────────
      const form = root.querySelector('#sandboxConfigForm');
      form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        setLoading(true);
        try {
          await api('/dev/api/sandbox/config', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify(data)
          });
          toast.success('Config saved — restarting server…');
          await reload();
          // Restart so new config takes effect
          await sandboxAction('restart');
        } catch (err) {
          toast.error('Failed to save: ' + err.message);
        } finally {
          setLoading(false);
        }
      });

      // ── File viewer ───────────────────────────────────────────────────────
      const fileCodeEl = root.querySelector('#sandboxFileCode');
      const tabBtns    = root.querySelectorAll('.tab-btn');
      const copyBtn    = root.querySelector('#sbFileCopyBtn');
      const fileCache  = {};
      let   currentFileText = '';

      function escape(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }

      async function showFile(name, activeBtn) {
        fileCodeEl.textContent = 'Loading…';
        tabBtns.forEach(b => b.classList.remove('active'));
        activeBtn.classList.add('active');
        if (!fileCache[name]) {
          const res  = await fetch(`/dev/api/sandbox/file/${name}`);
          fileCache[name] = await res.text();
        }
        currentFileText = fileCache[name];
        fileCodeEl.innerHTML = escape(currentFileText);
      }

      tabBtns.forEach(btn => btn.addEventListener('click', () => showFile(btn.dataset.file, btn)));

      copyBtn?.addEventListener('click', async () => {
        if (!currentFileText) return;
        await navigator.clipboard.writeText(currentFileText);
        const icon = copyBtn.querySelector('i');
        icon.className = 'fas fa-check';
        copyBtn.classList.add('copied');
        setTimeout(() => { icon.className = 'fas fa-copy'; copyBtn.classList.remove('copied'); }, 1600);
      });

      const firstBtn = root.querySelector('.tab-btn.active') || tabBtns[0];
      if (firstBtn) showFile(firstBtn.dataset.file, firstBtn);
    }
  };
})();
