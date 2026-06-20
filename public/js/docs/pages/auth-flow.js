(function () {
  window.SuperAuthDocsPages = window.SuperAuthDocsPages || {};

  window.SuperAuthDocsPages['auth-flow'] = {
    render() {
      return `
        <article class="panel glass docs-article">
          <h2>Auth Flow Deep Dive</h2>
          <p>This page explains the complete technical sequence of a SuperAuth login — from button click to verified user profile — including every actor and security checkpoint.</p>

          <h3>Actors</h3>
          <ul>
            <li><strong>Your app frontend</strong> — renders the login button and receives the callback redirect</li>
            <li><strong>Your app backend</strong> — exchanges the one-time code for a verified user profile</li>
            <li><strong>SuperAuth DeepLink</strong> — creates sessions, authenticates users, issues codes</li>
            <li><strong>User browser</strong> — the session context held throughout the flow</li>
          </ul>

          <h3>Sequence Diagram</h3>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-text">Your Frontend   SuperAuth DeepLink      User Browser    Your Backend
     |                  |                    |                |
     |-- GET /deeplink/create?... ---------> |                |
     |                  |<-- validate params-+                |
     |                  |-- create session --+                |
     |<-- Redirect /deeplink/auth/:slug ---- |                |
     |                  |                    |                |
     |                  |<-- User signs in --+                |
     |                  |   (+ 2FA if on)    |                |
     |                  |-- authorize & -----+                |
     |                  |   generate code    |                |
     |<-- Redirect return_to?code=X&state=Y -+                |
     |                                       |                |
     |-- Pass code to backend -------------------------------->|
     |                  |                    |                |
     |                  |<--- POST /deeplink/token { code } --|
     |                  |---- verify code ---+                |
     |                  |---- return user JSON -------------->|
     |                  |                    |  Create session|
     |<-- Redirect /dashboard -------------------------------- |</code></pre>
          </div>

          <h3>What You Receive from Token Exchange</h3>
          <p>The <code>POST /deeplink/token</code> response is a verified user profile object:</p>
          <div class="code-copy-wrap">
            <pre class="code-block"><code class="lang-json">{
  "id":              "550e8400-e29b-41d4-a716-446655440000",
  "username":        "janedoe",
  "display_name":    "Jane Doe",
  "email":           "jane@example.com",
  "avatar_url":      "https://avatars.example.com/janedoe.png",
  "account_created": "2025-01-15T10:30:00.000Z"
}</code></pre>
          </div>
          <p>After receiving this, you should:</p>
          <ol>
            <li>Look up or create a local user by <code>id</code> (SuperAuth UUID).</li>
            <li>Create a local session or JWT for your app.</li>
            <li>Redirect the user to their post-login destination.</li>
          </ol>

          <h3>Security Checkpoints</h3>
          <p>SuperAuth enforces security at every step:</p>
          <ul>
            <li><strong>Origin validation</strong> — <code>origin</code> hostname must match the integration\'s registered website URL</li>
            <li><strong>Code expiry</strong> — codes are short-lived (minutes)</li>
            <li><strong>Single use</strong> — consuming a code invalidates it immediately (replay protection)</li>
            <li><strong>Client secret</strong> — token exchange requires the server-side secret</li>
            <li><strong>2FA enforcement</strong> — if the SuperAuth user has TOTP enabled, they must pass 2FA before any code is issued</li>
          </ul>

          <h3>Production Checklist</h3>
          <ol>
            <li>Store <code>client_secret</code> in server environment variables only — never in client-side code.</li>
            <li>Use HTTPS for all callback URLs.</li>
            <li>Create a local user mapping table: <code>superauth_id &rarr; local_user_id</code>.</li>
            <li>Audit and log failed token exchanges for observability.</li>
            <li>Handle retry gracefully — codes are single-use, so request a fresh login on expiry or error.</li>
            <li>Validate <code>state</code> matches your expected integration slug when possible.</li>
          </ol>

          <div class="docs-callout">
            <strong>Stateful one-time codes</strong> eliminate replay attack windows that exist with static shared tokens or long-lived access codes. Each login generates a fresh, expiring, single-use code.
          </div>
        </article>
      `;
    }
  };
})();
