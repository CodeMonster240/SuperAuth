(function () {
  window.SuperAuthDocsPages = window.SuperAuthDocsPages || {};

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.SuperAuthDocsPages.playground = {
    render() {
      return `
        <article class="panel glass docs-article">
          <h2>Integration Playground</h2>
          <p>Generate a full callback URL, parse callback responses, and create token exchange snippets.</p>

          <section class="docs-subpanel">
            <h3>Build DeepLink URL</h3>
            <div class="form-row two">
              <label>SuperAuth Base URL
                <input id="pgBaseUrl" value="${location.origin}" />
              </label>
              <label>Client ID
                <input id="pgClientId" placeholder="sa_xxxxxxxxx" />
              </label>
            </div>
            <div class="form-row two">
              <label>Origin
                <input id="pgOrigin" placeholder="https://simpleclikr.io" />
              </label>
              <label>Return To Callback
                <input id="pgReturnTo" placeholder="https://simpleclikr.io/callback/superauth" />
              </label>
            </div>
            <button class="btn btn-primary" id="pgGenerate">Generate</button>
            <pre class="code-block" id="pgDeepLinkOut"><code>// Generated link appears here</code></pre>
            <pre class="code-block" id="pgAnchorOut"><code>// Button snippet appears here</code></pre>
          </section>

          <section class="docs-subpanel">
            <h3>Parse Callback URL</h3>
            <label>
              Callback URL Example
              <input id="pgCallbackInput" placeholder="https://simpleclikr.io/callback/superauth?code=abc&state=xyz" />
            </label>
            <button class="btn btn-glass" id="pgParse">Parse Callback</button>
            <pre class="code-block" id="pgCallbackParsed"><code>// Parsed code + state appears here</code></pre>
          </section>

          <section class="docs-subpanel">
            <h3>Token Exchange Snippets</h3>
            <div class="form-row two">
              <label>Client Secret
                <input id="pgSecret" placeholder="your_server_secret" />
              </label>
              <label>Code
                <input id="pgCode" placeholder="code_from_callback" />
              </label>
            </div>
            <button class="btn btn-glass" id="pgBuildToken">Build Snippets</button>
            <pre class="code-block" id="pgCurlOut"><code>// cURL snippet appears here</code></pre>
            <pre class="code-block" id="pgNodeOut"><code>// Node snippet appears here</code></pre>
          </section>

          <section class="docs-subpanel">
            <h3>Live Callback Flow Simulator</h3>
            <p>Visualize the full browser-to-backend auth journey.</p>
            <div class="inline-actions wrap">
              <button class="btn btn-primary" id="pgRunSim">Run Simulation</button>
              <button class="btn btn-glass" id="pgResetSim">Reset</button>
            </div>
            <div class="sim-timeline" id="pgTimeline">
              <div class="sim-step" data-step="1"><strong>1.</strong> User clicks Login with SuperAuth</div>
              <div class="sim-step" data-step="2"><strong>2.</strong> Redirect to /deeplink/create</div>
              <div class="sim-step" data-step="3"><strong>3.</strong> SuperAuth creates /deeplink/auth/:slug</div>
              <div class="sim-step" data-step="4"><strong>4.</strong> User authenticates (+ optional 2FA)</div>
              <div class="sim-step" data-step="5"><strong>5.</strong> Redirect to callback with code + state</div>
              <div class="sim-step" data-step="6"><strong>6.</strong> Backend exchanges code at /deeplink/token</div>
              <div class="sim-step" data-step="7"><strong>7.</strong> App receives verified user profile JSON</div>
            </div>
            <pre class="code-block" id="pgSimOut"><code>// Simulation events will stream here</code></pre>
          </section>
        </article>
      `;
    },

    mount({ root }) {
      const baseInput = root.querySelector('#pgBaseUrl');
      const clientInput = root.querySelector('#pgClientId');
      const originInput = root.querySelector('#pgOrigin');
      const returnInput = root.querySelector('#pgReturnTo');
      const deepLinkOut = root.querySelector('#pgDeepLinkOut code');
      const anchorOut = root.querySelector('#pgAnchorOut code');

      root.querySelector('#pgGenerate')?.addEventListener('click', () => {
        const base = (baseInput.value || '').trim().replace(/\/$/, '');
        const client = (clientInput.value || '').trim();
        const origin = encodeURIComponent((originInput.value || '').trim());
        const ret = encodeURIComponent((returnInput.value || '').trim());

        const url = `${base}/deeplink/create?client_id=${client}&origin=${origin}&return_to=${ret}`;
        deepLinkOut.textContent = url;
        anchorOut.innerHTML = escapeHtml(`<a href="${url}">Login with SuperAuth</a>`);
      });

      const callbackInput = root.querySelector('#pgCallbackInput');
      const callbackParsed = root.querySelector('#pgCallbackParsed code');
      root.querySelector('#pgParse')?.addEventListener('click', () => {
        try {
          const u = new URL((callbackInput.value || '').trim());
          const code = u.searchParams.get('code');
          const state = u.searchParams.get('state');
          callbackParsed.textContent = JSON.stringify({ code, state }, null, 2);
        } catch {
          callbackParsed.textContent = 'Invalid URL. Provide a full callback URL.';
        }
      });

      const secretInput = root.querySelector('#pgSecret');
      const codeInput = root.querySelector('#pgCode');
      const curlOut = root.querySelector('#pgCurlOut code');
      const nodeOut = root.querySelector('#pgNodeOut code');

      root.querySelector('#pgBuildToken')?.addEventListener('click', () => {
        const base = (baseInput.value || '').trim().replace(/\/$/, '');
        const client = (clientInput.value || '').trim();
        const secret = (secretInput.value || '').trim();
        const code = (codeInput.value || '').trim();

        curlOut.textContent = `curl -X POST ${base}/deeplink/token \\\n  -H "Content-Type: application/json" \\\n  -d '{"client_id":"${client}","client_secret":"${secret}","code":"${code}"}'`;

        nodeOut.textContent = `const resp = await fetch('${base}/deeplink/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: '${client}',
    client_secret: process.env.SUPERAUTH_CLIENT_SECRET,
    code: '${code}'
  })
});
const profile = await resp.json();`;
      });

      const timeline = root.querySelector('#pgTimeline');
      const simOut = root.querySelector('#pgSimOut code');

      function resetSimulator() {
        timeline?.querySelectorAll('.sim-step').forEach((el) => {
          el.classList.remove('active');
          el.classList.remove('done');
        });
        simOut.textContent = '// Simulation events will stream here';
      }

      root.querySelector('#pgResetSim')?.addEventListener('click', resetSimulator);

      root.querySelector('#pgRunSim')?.addEventListener('click', () => {
        resetSimulator();
        const steps = Array.from(timeline.querySelectorAll('.sim-step'));
        const logLines = [];
        const events = [
          'Browser -> SuperAuth: GET /deeplink/create?client_id=...&origin=...&return_to=...',
          'SuperAuth: deeplink session persisted, status=pending, expires_at=+15m',
          'Browser redirected to /deeplink/auth/:slug',
          'User authenticated (password/social) and 2FA challenge passed when enabled',
          'SuperAuth generated one-time code + marked deeplink authenticated',
          'Browser redirected to callback with ?code=...&state=slug',
          'Backend -> SuperAuth: POST /deeplink/token (client_id, client_secret, code)'
        ];

        steps.forEach((step, idx) => {
          setTimeout(() => {
            if (idx > 0) {
              steps[idx - 1].classList.remove('active');
              steps[idx - 1].classList.add('done');
            }
            step.classList.add('active');
            logLines.push(`[${new Date().toLocaleTimeString()}] ${events[idx] || 'Profile payload received by app.'}`);
            simOut.textContent = logLines.join('\n');

            if (idx === steps.length - 1) {
              setTimeout(() => {
                step.classList.remove('active');
                step.classList.add('done');
                logLines.push(`[${new Date().toLocaleTimeString()}] Success: app receives { id, username, display_name, email, avatar_url }`);
                simOut.textContent = logLines.join('\n');
              }, 450);
            }
          }, idx * 700);
        });
      });
    }
  };
})();
