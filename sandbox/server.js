/**
 * DankBoard - A stupid meme voting app for practicing SuperAuth OAuth.
 *
 * Run:  node sandbox/server.js
 * Then: open http://localhost:4000
 *
 * Edit sandbox/config.json with your SuperAuth integration credentials,
 * or use the Sandbox tab in the Dev Console to do it automatically.
 */

const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const app      = express();

// ─── Base path (injected by SuperAuth parent process) ─────────────────────────
const B = process.env.BASE_PATH || '';   // e.g. '/sandbox' when proxied
app.locals.b = B;                        // available in every EJS template
const COOKIE_PATH = B || '/';

// ─── Config ───────────────────────────────────────────────────────────────────
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  } catch {
    return { SUPERAUTH_BASE_URL: '', CLIENT_ID: '', CLIENT_SECRET: '', SANDBOX_PORT: 4000, SANDBOX_BASE_URL: 'http://localhost:4000' };
  }
}

// ─── Meme data ────────────────────────────────────────────────────────────────
const MEMES = [
  { id: 1, title: 'When the code works on the first try',           emoji: '🦄', tag: 'dev' },
  { id: 2, title: 'It works on my machine ¯\\_(ツ)_/¯',            emoji: '🤷', tag: 'dev' },
  { id: 3, title: 'Just one more feature before I push',           emoji: '🌚', tag: 'dev' },
  { id: 4, title: 'CSS is my passion (it is not)',                 emoji: '😭', tag: 'dev' },
  { id: 5, title: 'git commit -m "fix" (it is not fixed)',         emoji: '🔥', tag: 'dev' },
  { id: 6, title: 'Stack Overflow being down at 2am',              emoji: '😱', tag: 'dev' },
  { id: 7, title: 'undefined is not a function (classic)',         emoji: '💀', tag: 'js'  },
  { id: 8, title: 'npm install (5 minutes later)',                 emoji: '⏳', tag: 'js'  },
  { id: 9, title: 'Left-pad incident PTSD flashback',             emoji: '🧹', tag: 'js'  },
  { id: 10, title: '"No bugs in prod" they said',                  emoji: '🐛', tag: 'ops' },
  { id: 11, title: 'Works in dev, broken in prod... "same thing"', emoji: '🎭', tag: 'ops' },
  { id: 12, title: 'The customer is always wrong (sorry)',         emoji: '😅', tag: 'pm'  },
];

// In-memory votes (resets on server restart — it is a sandbox lol)
const votes = Object.fromEntries(MEMES.map(m => [m.id, { up: 0, down: 0 }]));

// In-memory sessions (Map: sessionId -> { user, state })
const sessions = new Map();
const COOKIE   = 'dankboard_sid';

// ─── Middleware ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(B || '/', express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Auto-prepend base path to all relative redirects
app.use((_req, res, next) => {
  if (!B) return next();
  const _redir = res.redirect.bind(res);
  res.redirect = (url, ...rest) => {
    if (typeof url === 'string' && url.startsWith('/') && !url.startsWith(B)) {
      url = B + url;
    }
    _redir(url, ...rest);
  };
  next();
});

// Simple cookie session
app.use((req, _res, next) => {
  const cookies = Object.fromEntries(
    (req.headers.cookie || '').split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
  req.sid  = cookies[COOKIE] || null;
  req.sess = req.sid ? (sessions.get(req.sid) || null) : null;
  next();
});

function requireLogin(req, res, next) {
  if (req.sess?.user) return next();
  res.redirect('/');
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Home / Login page
app.get(B + '/', (req, res) => {
  if (req.sess?.user) return res.redirect('/memes');
  const cfg = loadConfig();
  const configured = !!(cfg.CLIENT_ID && cfg.CLIENT_SECRET && cfg.SUPERAUTH_BASE_URL);
  res.render('login', { configured, error: req.query.error || null, saUrl: cfg.SUPERAUTH_BASE_URL || '' });
});

// Kick off OAuth flow
app.get(B + '/auth/login', (req, res) => {
  const cfg = loadConfig();
  if (!cfg.CLIENT_ID || !cfg.SUPERAUTH_BASE_URL) {
    return res.redirect('/?error=not_configured');
  }
  // Generate state and store in pending map (keyed by state value)
  const state = crypto.randomBytes(16).toString('hex');
  sessions.set('pending_' + state, { state, ts: Date.now() });

  const publicHost  = req.get('x-forwarded-host') || req.get('host');
  const publicProto = req.get('x-forwarded-proto') || req.protocol;
  const sandboxBase = `${publicProto}://${publicHost}${B}`;
  const callbackUrl = `${sandboxBase}/auth/callback`;
  const deeplink = `${cfg.SUPERAUTH_BASE_URL}/deeplink/create`
    + `?client_id=${encodeURIComponent(cfg.CLIENT_ID)}`
    + `&origin=${encodeURIComponent(sandboxBase)}`
    + `&return_to=${encodeURIComponent(callbackUrl)}`;

  res.redirect(deeplink);
});

// OAuth callback — exchange code for user profile
app.get(B + '/auth/callback', async (req, res) => {
  const { code, state: returnedState } = req.query;
  if (!code) return res.redirect('/?error=missing_code');

  const cfg = loadConfig();

  let user;
  try {
    const response = await fetch(`${cfg.SUPERAUTH_BASE_URL}/deeplink/token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        client_id:     cfg.CLIENT_ID,
        client_secret: cfg.CLIENT_SECRET,
        code
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.redirect(`/?error=${encodeURIComponent(err.error || 'auth_failed')}`);
    }
    user = await response.json();
  } catch (e) {
    console.error('[DankBoard] token exchange failed:', e.message);
    return res.redirect('/?error=fetch_failed');
  }

  // Create session
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, { user });
  res.setHeader('Set-Cookie', `${COOKIE}=${encodeURIComponent(sid)}; HttpOnly; Path=${COOKIE_PATH}; SameSite=Lax`);
  res.redirect('/memes');
});

// Meme feed (protected)
app.get(B + '/memes', requireLogin, (req, res) => {
  const withVotes = MEMES.map(m => ({ ...m, ...votes[m.id] }));
  res.render('home', { user: req.sess.user, memes: withVotes });
});

// Vote on a meme (protected)
app.post(B + '/memes/:id/vote', requireLogin, (req, res) => {
  const id  = parseInt(req.params.id, 10);
  const dir = req.body.dir === 'down' ? 'down' : 'up';
  if (votes[id]) votes[id][dir]++;
  res.json({ ok: true, votes: votes[id] });
});

// Logout
app.post(B + '/logout', (req, res) => {
  if (req.sid) sessions.delete(req.sid);
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=${COOKIE_PATH}; Max-Age=0`);
  res.redirect('/');
});

// ─── Start ────────────────────────────────────────────────────────────────────
const cfg  = loadConfig();
const PORT = cfg.SANDBOX_PORT || 4000;
app.listen(PORT, '127.0.0.1', () => {
  const configured = !!(cfg.CLIENT_ID && cfg.CLIENT_SECRET);
  const publicUrl  = cfg.SANDBOX_BASE_URL || `http://127.0.0.1:${PORT}${B}`;
  console.log(`\n🤡 DankBoard running → ${publicUrl}`);
  if (!configured) {
    console.log('⚠️  Not configured yet! Open the Sandbox tab in the SuperAuth Dev Console.\n');
  } else {
    console.log(`✅  OAuth configured — client_id: ${cfg.CLIENT_ID}\n`);
  }
});
