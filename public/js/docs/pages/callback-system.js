(function () {
  window.SuperAuthDocsPages = window.SuperAuthDocsPages || {};

  window.SuperAuthDocsPages['callback-system'] = {
    render() {
      return `
        <article class="panel glass docs-article">
          <h2>Callback System</h2>
          <p>DeepLink callbacks are designed to be explicit, origin-aware, and single-use. Understanding the validation model helps you build secure integrations and handle edge cases gracefully.</p>

          <h3>Required Query Parameters on Create</h3>
          <p>When constructing the DeepLink URL, all three parameters are required:</p>
          <ul>
            <li><code>client_id</code> — your integration identifier from the Dev Console</li>
            <li><code>origin</code> — the origin of your app (e.g. <code>https://simpleclikr.io</code>) — used for CORS and validation</li>
            <li><code>return_to</code> — the full callback URL including path (e.g. <code>https://simpleclikr.io/callback/superauth</code>)</li>
          </ul>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-text">GET https://superauth.io/deeplink/create
  ?client_id=sa_xxxxxxxxx
  &amp;origin=https://simpleclikr.io
  &amp;return_to=https://simpleclikr.io/callback/superauth</code></pre>
          </div>

          <h3>Full Callback Flow</h3>
          <ol>
            <li>User clicks your login link in your app.</li>
            <li>SuperAuth validates <code>client_id</code>, <code>origin</code>, and <code>return_to</code>, then creates a DeepLink session.</li>
            <li>User is redirected to <code>/deeplink/auth/:slug</code> to sign in.</li>
            <li>After successful auth, SuperAuth redirects to <code>return_to</code> with <code>code</code> and <code>state</code>.</li>
            <li>Your backend POSTs code + credentials to <code>/deeplink/token</code> to get the user profile.</li>
          </ol>

          <h3>Token Exchange Endpoint</h3>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-http">POST /deeplink/token
Content-Type: application/json

{
  "client_id":     "sa_xxxxxxxxx",
  "client_secret": "your_server_secret",
  "code":          "one_time_code_from_callback"
}</code></pre>
          </div>
          <p>On success, the response is the verified user profile:</p>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-json">{
  "id":              "uuid",
  "username":        "exampleuser",
  "display_name":    "Example User",
  "email":           "user@example.com",
  "avatar_url":      "https://...",
  "account_created": "2024-01-01T00:00:00.000Z"
}</code></pre>
          </div>

          <h3>Validation Rules</h3>
          <ul>
            <li>Origin hostname is validated against the integration website URL if provided.</li>
            <li>Codes are single-use — consuming the code invalidates it immediately.</li>
            <li>Code must match the app that issued it (via <code>client_id</code>).</li>
            <li>Codes expire after a short window — request a fresh login on expiry.</li>
          </ul>

          <h3>Error Responses</h3>
          <p>The token endpoint returns HTTP 400 with a JSON body on error:</p>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-json">{ "error": "invalid_code" }       // code not found or already used
{ "error": "code_expired" }       // code has exceeded its time window
{ "error": "invalid_client" }     // client_id / client_secret mismatch
{ "error": "origin_mismatch" }    // origin hostname validation failed</code></pre>
          </div>

          <h3>Recommended Callback Handler (Node.js)</h3>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-js">app.get('/callback/superauth', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('Missing code');

  const resp = await fetch('https://superauth.io/deeplink/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:     process.env.SUPERAUTH_CLIENT_ID,
      client_secret: process.env.SUPERAUTH_CLIENT_SECRET,
      code
    })
  });

  if (!resp.ok) {
    const err = await resp.json();
    return res.status(400).send('Auth failed: ' + err.error);
  }

  const user = await resp.json();
  // map user.id to your local users table, create session
  req.session.userId = user.id;
  res.redirect('/app');
});</code></pre>
          </div>

          <div class="docs-callout warn">
            <strong>Do not trust callback query params alone.</strong> Always verify by exchanging the code server-to-server. The <code>code</code> param in the callback URL is not proof of identity — it\'s a voucher you exchange for the actual user profile.
          </div>
        </article>
      `;
    }
  };
})();
