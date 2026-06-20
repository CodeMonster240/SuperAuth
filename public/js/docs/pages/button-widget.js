(function () {
  window.SuperAuthDocsPages = window.SuperAuthDocsPages || {};

  window.SuperAuthDocsPages['button-widget'] = {
    render() {
      return `
        <article class="panel glass docs-article">
          <h2>Button Widget</h2>
          <p>A self-contained, pre-styled "Sign in with SuperAuth" button you can drop into any website with two lines of HTML — no build step, no dependencies, no custom CSS required.</p>

          <h3>Quick Start</h3>
          <p>Place a <code>&lt;div class="superauth-btn"&gt;</code> where you want the button, then load the widget script once anywhere on the page.</p>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-html">&lt;div class="superauth-btn"
     data-client-id="sa_xxxxxxxxxxxx"
     data-return-to="https://yourapp.com/auth/callback"&gt;
&lt;/div&gt;

&lt;script src="https://superauth.io/js/btn.js" defer&gt;&lt;/script&gt;</code></pre>
          </div>

          <h3>Live Preview</h3>
          <p>These are all rendered by the actual widget script:</p>
          <div class="docs-subpanel" id="btnPreviewMount" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding:20px 18px">
            <div class="superauth-btn" data-client-id="sa_demo" data-return-to="#" data-theme="light"></div>
            <div class="superauth-btn" data-client-id="sa_demo" data-return-to="#" data-theme="dark"></div>
            <div class="superauth-btn" data-client-id="sa_demo" data-return-to="#" data-theme="light" data-size="sm"></div>
            <div class="superauth-btn" data-client-id="sa_demo" data-return-to="#" data-theme="dark" data-size="lg" data-shape="pill"></div>
          </div>

          <h3>All Options</h3>
          <div class="docs-subpanel" style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:0.88rem">
              <thead>
                <tr style="border-bottom:1px solid var(--border)">
                  <th style="padding:8px 12px;text-align:left;color:var(--muted);font-weight:600">Attribute</th>
                  <th style="padding:8px 12px;text-align:left;color:var(--muted);font-weight:600">Values</th>
                  <th style="padding:8px 12px;text-align:left;color:var(--muted);font-weight:600">Default</th>
                  <th style="padding:8px 12px;text-align:left;color:var(--muted);font-weight:600">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 12px"><code>data-client-id</code></td>
                  <td style="padding:8px 12px"><em>your client_id</em></td>
                  <td style="padding:8px 12px">—</td>
                  <td style="padding:8px 12px">Required</td>
                </tr>
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 12px"><code>data-return-to</code></td>
                  <td style="padding:8px 12px"><em>full callback URL</em></td>
                  <td style="padding:8px 12px">current page URL</td>
                  <td style="padding:8px 12px">Server-side route that handles the code exchange</td>
                </tr>
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 12px"><code>data-origin</code></td>
                  <td style="padding:8px 12px"><em>origin URL</em></td>
                  <td style="padding:8px 12px">inferred from <code>return-to</code></td>
                  <td style="padding:8px 12px">Override if your app origin differs from the callback URL</td>
                </tr>
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 12px"><code>data-theme</code></td>
                  <td style="padding:8px 12px"><code>light</code> &nbsp; <code>dark</code> &nbsp; <code>auto</code></td>
                  <td style="padding:8px 12px"><code>auto</code></td>
                  <td style="padding:8px 12px"><code>auto</code> follows the user's OS preference</td>
                </tr>
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 12px"><code>data-size</code></td>
                  <td style="padding:8px 12px"><code>sm</code> &nbsp; <code>md</code> &nbsp; <code>lg</code></td>
                  <td style="padding:8px 12px"><code>md</code></td>
                  <td style="padding:8px 12px"></td>
                </tr>
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px 12px"><code>data-shape</code></td>
                  <td style="padding:8px 12px"><code>rounded</code> &nbsp; <code>pill</code></td>
                  <td style="padding:8px 12px"><code>rounded</code></td>
                  <td style="padding:8px 12px"></td>
                </tr>
                <tr>
                  <td style="padding:8px 12px"><code>data-text</code></td>
                  <td style="padding:8px 12px"><em>any string</em></td>
                  <td style="padding:8px 12px"><code>Sign in with SuperAuth</code></td>
                  <td style="padding:8px 12px">e.g. "Continue with SuperAuth"</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Multiple Buttons</h3>
          <p>You can render as many buttons as you want — load the script once and add as many <code>.superauth-btn</code> divs as needed. Each can have different options.</p>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-html">&lt;!-- Primary CTA --&gt;
&lt;div class="superauth-btn"
     data-client-id="sa_xxxxxxxxxxxx"
     data-return-to="https://yourapp.com/auth/callback"
     data-theme="dark"
     data-size="lg"
     data-shape="pill"
     data-text="Continue with SuperAuth"&gt;
&lt;/div&gt;

&lt;!-- Smaller secondary --&gt;
&lt;div class="superauth-btn"
     data-client-id="sa_xxxxxxxxxxxx"
     data-return-to="https://yourapp.com/auth/callback"
     data-theme="light"
     data-size="sm"&gt;
&lt;/div&gt;</code></pre>
          </div>

          <h3>JavaScript API</h3>
          <p>If you render buttons dynamically (e.g. in a SPA), call <code>SuperAuthBtn.enhance()</code> after inserting new elements:</p>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-js">// Re-scan the document for any new .superauth-btn elements
SuperAuthBtn.enhance();

// Or scope to a specific container
SuperAuthBtn.enhance(document.querySelector('#my-modal'));</code></pre>
          </div>

          <div class="docs-callout warn" style="margin-top:14px">
            <strong>Tip:</strong> The widget auto-detects whether you're on <code>localhost</code> or production and builds DeepLink URLs accordingly. No config needed.
          </div>
        </article>
      `;
    },

    mount({ root }) {
      // Load the real btn.js widget to render the live preview
      if (!window.SuperAuthBtn) {
        var s = document.createElement('script');
        s.src = '/js/btn.js';
        s.onload = function () {
          window.SuperAuthBtn && window.SuperAuthBtn.enhance(root.querySelector('#btnPreviewMount'));
        };
        document.body.appendChild(s);
      } else {
        window.SuperAuthBtn.enhance(root.querySelector('#btnPreviewMount'));
      }

      // Prevent demo buttons from navigating
      root.querySelectorAll('#btnPreviewMount .superauth-btn').forEach(function (el) {
        el.addEventListener('click', function (e) { e.stopPropagation(); }, true);
      });
      root.querySelectorAll('#btnPreviewMount button').forEach(function (btn) {
        btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); });
      });
    }
  };
})();
