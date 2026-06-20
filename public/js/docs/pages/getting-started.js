(function () {
  window.SuperAuthDocsPages = window.SuperAuthDocsPages || {};

  window.SuperAuthDocsPages['getting-started'] = {
    render() {
      return `
        <article class="panel glass docs-article">
          <h2>Getting Started</h2>
          <p>SuperAuth is a hosted OAuth platform — like Sign in with Google, but for any app. Drop in a link, and your users can sign in with their SuperAuth account. Your backend exchanges a one-time code for a verified user profile. No auth infrastructure to build or maintain.</p>

          <div class="docs-callout" style="margin-top:0;">
            <strong>Prerequisites:</strong> A <a href="https://superauth.io/signup?type=developer" target="_blank" rel="noopener">free SuperAuth developer account</a> and a web app that can handle server-side HTTP requests. Any language works — examples use Node.js.
          </div>

          <h3>1. Create a Developer Account</h3>
          <ol>
            <li>Sign up at <a href="https://superauth.io/signup?type=developer" target="_blank" rel="noopener">superauth.io</a> and choose a developer account.</li>
            <li>Log in and go to the <a href="/dev/apps">Dev Console &rarr; Apps</a> page.</li>
            <li>Click <strong>New Integration</strong> and fill in your app name, website URL, and callback URL.</li>
            <li>Save the generated <code>client_id</code> and <code>client_secret</code>.</li>
          </ol>

          <h3>2. Understand Your Credentials</h3>
          <p>Each integration has two credentials with different security requirements:</p>
          <ul>
            <li><code>client_id</code> — public identifier, safe to embed in frontend HTML links</li>
            <li><code>client_secret</code> — private secret, <strong>server-side only</strong>, never in frontend code</li>
          </ul>

          <h3>3. Add a Login Button in Your App</h3>
          <p>Construct a DeepLink URL and add it as an anchor tag. Replace the placeholders with your real values.</p>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-html">&lt;a href="https://superauth.io/deeplink/create
  ?client_id=sa_xxxxxxxxx
  &amp;origin=https://yourapp.com
  &amp;return_to=https://yourapp.com/callback/superauth"&gt;
  Login with SuperAuth
&lt;/a&gt;</code></pre>
          </div>

          <h3>4. Handle the Callback</h3>
          <p>After the user authenticates, SuperAuth redirects to your <code>return_to</code> URL with two query params:</p>
          <ul>
            <li><code>code</code> — one-time use auth code (expires in 5 minutes)</li>
            <li><code>state</code> — the integration slug for verification</li>
          </ul>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-text">https://yourapp.com/callback/superauth?code=abc123&amp;state=slug123</code></pre>
          </div>

          <h3>5. Exchange the Code Server-to-Server</h3>
          <p>Make a POST request from your <strong>backend</strong> immediately after receiving the code. The code is single-use and time-limited.</p>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-js">// Node.js / Express example
app.get('/callback/superauth', async (req, res) => {
  const { code, state } = req.query;

  const resp = await fetch('https://superauth.io/deeplink/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SUPERAUTH_CLIENT_ID,
      client_secret: process.env.SUPERAUTH_CLIENT_SECRET,
      code
    })
  });

  const user = await resp.json();
  // { id, username, email, avatar_url, display_name, account_created }

  req.session.userId = user.id;
  res.redirect('/dashboard');
});</code></pre>
          </div>

          <div class="docs-callout">
            <strong>Security note:</strong> Never expose <code>client_secret</code> in client-side JavaScript or HTML. Store it in environment variables and only use it in server-to-server requests.
          </div>

          <h3>What\'s Next?</h3>
          <ul>
            <li>Read <a href="/docs/callback-system" data-docs-page="callback-system">Callback System</a> for validation rules and error handling.</li>
            <li>See <a href="/docs/auth-flow" data-docs-page="auth-flow">Auth Flow Deep Dive</a> for the full sequence diagram.</li>
            <li>Try the <a href="/docs/playground" data-docs-page="playground">Playground</a> to generate a real callback URL instantly.</li>
          </ul>
        </article>
      `;
    },

    mount({ root }) {
      root.querySelectorAll('[data-docs-page]').forEach(a => {
        a.addEventListener('click', e => {
          e.preventDefault();
          const page = a.dataset.docsPage;
          if (window.__docsNavigate) window.__docsNavigate(page);
        });
      });
    }
  };
})();
