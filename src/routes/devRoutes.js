const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const ejs      = require('ejs');
const { spawn } = require('child_process');
const { requireDev } = require('../middleware/auth');
const {
  createApplication, getApplicationBySlug, getApplicationsByOwner,
  updateApplication, deleteApplication, regenerateClientSecret, getAppAnalytics,
  getApplicationById
} = require('../db/applications');
const validator = require('validator');
const { createShortLink } = require('../db/shortlinks');

// ─── Sandbox process manager ──────────────────────────────────────────────────
const SANDBOX_SERVER_PATH = path.join(__dirname, '../../sandbox/server.js');
let sandboxProc   = null;
let sandboxLog    = [];        // rolling last 200 lines
const MAX_LOG     = 200;
const sseClients  = new Set(); // active SSE connections

function sandboxStatus() {
  return sandboxProc && !sandboxProc.killed ? 'running' : 'stopped';
}

function pushLog(type, text) {
  const lines = String(text).split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const entry = { type, text: line, ts: Date.now() };
    sandboxLog.push(entry);
    if (sandboxLog.length > MAX_LOG) sandboxLog.shift();
    for (const res of sseClients) {
      if (res.writableEnded || res.destroyed) { sseClients.delete(res); continue; }
      try { res.write(`data: ${JSON.stringify(entry)}\n\n`); } catch { sseClients.delete(res); }
    }
  }
}

function startSandbox() {
  if (sandboxProc && !sandboxProc.killed) return false; // already running
  pushLog('system', '▶ Starting DankBoard sandbox…');
  // Minimal env — do NOT inherit SESSION_SECRET, DB, or any SuperAuth internals.
  const safeEnv = {
    NODE_ENV:    process.env.NODE_ENV || 'development',
    PATH:        process.env.PATH        || '',
    HOME:        process.env.HOME        || process.env.USERPROFILE || '',
    USERPROFILE: process.env.USERPROFILE || '',
    TEMP:        process.env.TEMP        || process.env.TMP || '',
    TMP:         process.env.TMP         || '',
    SystemRoot:  process.env.SystemRoot  || '',
    APPDATA:     process.env.APPDATA     || '',
    BASE_PATH:   '/sandbox',
  };
  sandboxProc = spawn(process.execPath, [SANDBOX_SERVER_PATH], {
    cwd:   path.join(__dirname, '../../sandbox'),
    env:   safeEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  sandboxProc.stdout.on('data', d => pushLog('out', d.toString()));
  sandboxProc.stderr.on('data', d => pushLog('err', d.toString()));
  sandboxProc.on('exit', (code) => {
    pushLog('system', `■ Process exited (code ${code ?? '?'})`);
    sandboxProc = null;
    broadcastStatus();
  });
  broadcastStatus();
  return true;
}

function stopSandbox() {
  if (!sandboxProc || sandboxProc.killed) return false;
  pushLog('system', '⏹ Stopping sandbox…');
  sandboxProc.kill('SIGTERM');
  return true;
}

function broadcastStatus() {
  const msg = JSON.stringify({ status: sandboxStatus() });
  for (const res of sseClients) {
    if (res.writableEnded || res.destroyed) { sseClients.delete(res); continue; }
    try { res.write(`event: status\ndata: ${msg}\n\n`); } catch { sseClients.delete(res); }
  }
}

// Dev dashboard SPA shell
const devShellPages = ['/', '/overview', '/apps', '/deeplink', '/analytics', '/settings', '/sandbox'];
router.get(devShellPages, requireDev, (req, res) => {
  res.render('dashboard/dev', { title: 'Developer Console', user: req.user });
});

// /dev/integration/:slug and all sub-pages — SPA shell with slug context
const intSubPaths = ['', '/deeplink', '/token', '/settings', '/analytics'];
for (const sub of intSubPaths) {
  router.get(`/integration/:slug${sub}`, requireDev, (req, res) => {
    Promise.resolve().then(async () => {
      const app = await getApplicationBySlug(req.params.slug);
      if (!app || app.owner_id !== req.user.id) return res.status(404).render('errors/404', { title: '404' });
      const subLabel = sub ? sub.slice(1).charAt(0).toUpperCase() + sub.slice(2) + ' — ' : '';
      res.render('dashboard/dev', { title: `${subLabel}${app.name} — Dev Console`, user: req.user, appSlug: req.params.slug });
    }).catch(() => res.status(500).render('errors/500', { title: '500' }));
  });
}

// ─── Dev page partials (SSR HTML fragments, no layout) ───────────────────────

const PARTIAL_PAGES = ['overview', 'apps', 'deeplink', 'analytics', 'settings', 'sandbox', 'intSettings'];

const SANDBOX_CONFIG_PATH = path.join(__dirname, '../../sandbox/config.json');

function readSandboxConfig() {
  try { return JSON.parse(fs.readFileSync(SANDBOX_CONFIG_PATH, 'utf8')); }
  catch { return { SUPERAUTH_BASE_URL: '', CLIENT_ID: '', CLIENT_SECRET: '', SANDBOX_PORT: 4000, SANDBOX_BASE_URL: '' }; }
}

router.get('/partial/:page', requireDev, async (req, res) => {
  const page = req.params.page;
  if (!PARTIAL_PAGES.includes(page)) return res.status(404).send('');

  try {
    const apps = await getApplicationsByOwner(req.user.id);
    const slug = req.query.slug;
    const activeApp = slug
      ? (apps.find(a => a.slug === slug) || apps[0] || null)
      : (apps[0] || null);
    const origin = `${req.protocol}://${req.get('host')}`;

    const templateFile = page === 'intSettings' ? 'integration-settings' : page;
    const templatePath = path.join(__dirname, `../views/dashboard/dev/${templateFile}.ejs`);
    const html = await ejs.renderFile(templatePath, {
      apps, activeApp, user: req.user, origin, encodeURIComponent,
      sandboxConfig: readSandboxConfig()
    });
    res.send(html);
  } catch (err) {
    console.error(`[partial/${page}]`, err);
    res.status(500).send(`<section class="panel glass"><h2>Render Error</h2><pre style="white-space:pre-wrap;font-size:0.8rem">${err.message}</pre></section>`);
  }
});

// ─── API ──────────────────────────────────────────────────────────────────────

// List my apps
router.get('/api/apps', requireDev, async (req, res) => {
  res.json(await getApplicationsByOwner(req.user.id));
});

// Create app
router.post('/api/apps', requireDev, async (req, res) => {
  const { name, description, websiteUrl, callbackUrl } = req.body;
  if (!name || name.length < 2) return res.status(400).json({ error: 'App name required (min 2 chars).' });
  const urlOpts = { require_protocol: true, require_tld: false };
  if (websiteUrl && !validator.isURL(websiteUrl, urlOpts)) return res.status(400).json({ error: 'Invalid website URL.' });
  if (callbackUrl && !validator.isURL(callbackUrl, urlOpts)) return res.status(400).json({ error: 'Invalid callback URL.' });

  const app = await createApplication({ ownerId: req.user.id, name, description, websiteUrl, callbackUrl });
  res.json(app);
});

// Get single app
router.get('/api/apps/:slug', requireDev, async (req, res) => {
  const app = await getApplicationBySlug(req.params.slug);
  if (!app || app.owner_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
  res.json(app);
});

// Update app
router.patch('/api/apps/:slug', requireDev, async (req, res) => {
  const app = await getApplicationBySlug(req.params.slug);
  if (!app || app.owner_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
  const { name, description, website_url, callback_url, logo_url, is_active } = req.body;
  const urlOpts = { require_protocol: true, require_tld: false };
  if (website_url && !validator.isURL(website_url, urlOpts)) return res.status(400).json({ error: 'Invalid website URL.' });
  if (callback_url && !validator.isURL(callback_url, urlOpts)) return res.status(400).json({ error: 'Invalid callback URL.' });
  if (logo_url && !validator.isURL(logo_url, urlOpts)) return res.status(400).json({ error: 'Invalid logo URL.' });
  await updateApplication(app.id, req.user.id, { name, description, website_url, callback_url, logo_url, is_active });
  res.json({ ok: true });
});

// Delete app
router.delete('/api/apps/:slug', requireDev, async (req, res) => {
  const app = await getApplicationBySlug(req.params.slug);
  if (!app || app.owner_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
  deleteApplication(app.id, req.user.id);
  res.json({ ok: true });
});

// Regenerate secret
router.post('/api/apps/:slug/regen-secret', requireDev, async (req, res) => {
  const app = await getApplicationBySlug(req.params.slug);
  if (!app || app.owner_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
  const newSecret = await regenerateClientSecret(app.id, req.user.id);
  res.json({ client_secret: newSecret });
});

// Shorten a DeepLink URL
router.post('/api/apps/:slug/shorten', requireDev, async (req, res) => {
  const app = await getApplicationBySlug(req.params.slug);
  if (!app || app.owner_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
  const { url } = req.body;
  if (!url || typeof url !== 'string' || url.length > 4096) {
    return res.status(400).json({ error: 'Invalid URL.' });
  }
  // Only allow shortening DeepLink URLs belonging to this app
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL.' }); }
  if (!parsed.pathname.startsWith('/deeplink/')) {
    return res.status(400).json({ error: 'Only DeepLink URLs can be shortened.' });
  }
  if (parsed.searchParams.get('client_id') !== app.client_id) {
    return res.status(403).json({ error: 'client_id does not match this integration.' });
  }
  const code = await createShortLink({ longUrl: url, appId: app.id, createdBy: req.user.id });
  const shortUrl = `${req.protocol}://${req.get('host')}/go/${code}`;
  res.json({ short_url: shortUrl, code });
});

// Analytics
router.get('/api/apps/:slug/analytics', requireDev, async (req, res) => {
  const app = await getApplicationBySlug(req.params.slug);
  if (!app || app.owner_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
  const days = parseInt(req.query.days) || 30;
  res.json(await getAppAnalytics(app.id, days));
});

// ─── Sandbox config ───────────────────────────────────────────────────────────

router.get('/api/sandbox/config', requireDev, (req, res) => {
  res.json(readSandboxConfig());
});

const SANDBOX_FILES = {
  server: path.join(__dirname, '../../sandbox/server.js'),
  config: path.join(__dirname, '../../sandbox/config.json'),
  login:  path.join(__dirname, '../../sandbox/views/login.ejs'),
  home:   path.join(__dirname, '../../sandbox/views/home.ejs'),
};

router.get('/api/sandbox/file/:name', requireDev, (req, res) => {
  const filePath = SANDBOX_FILES[req.params.name];
  if (!filePath) return res.status(404).json({ error: 'Unknown file' });
  try {
    res.type('text/plain').send(fs.readFileSync(filePath, 'utf8'));
  } catch {
    res.status(500).json({ error: 'Could not read file' });
  }
});

router.post('/api/sandbox/config', requireDev, async (req, res) => {
  const { CLIENT_ID, CLIENT_SECRET, SUPERAUTH_BASE_URL, SANDBOX_PORT, SANDBOX_BASE_URL } = req.body;

  // Validate CLIENT_ID belongs to the requesting developer
  if (CLIENT_ID) {
    const ownerApps = await getApplicationsByOwner(req.user.id).catch(() => []);
    const app = ownerApps.find(a => a.client_id === CLIENT_ID);
    if (!app) return res.status(403).json({ error: 'Integration not found or does not belong to your account.' });
  }

  const current = readSandboxConfig();
  const port = SANDBOX_PORT ? parseInt(SANDBOX_PORT) : (current.SANDBOX_PORT || 4000);
  const superAuthPort = Number(process.env.PORT || 3000);
  if (port < 1025 || port > 65534) return res.status(400).json({ error: 'Port must be between 1025 and 65534.' });
  if (port === superAuthPort) return res.status(400).json({ error: `Port ${port} is used by SuperAuth — choose a different port.` });
  const derivedSuperAuthUrl = `${req.protocol}://${req.get('host')}`;
  const next = {
    SUPERAUTH_BASE_URL: SUPERAUTH_BASE_URL || derivedSuperAuthUrl,
    CLIENT_ID:          CLIENT_ID          || current.CLIENT_ID,
    CLIENT_SECRET:      CLIENT_SECRET      || current.CLIENT_SECRET,
    SANDBOX_PORT:       port,
    SANDBOX_BASE_URL:   `${derivedSuperAuthUrl}/sandbox`,
  };

  fs.writeFileSync(SANDBOX_CONFIG_PATH, JSON.stringify(next, null, 2));
  res.json({ ok: true, config: next });
});

// ─── Sandbox process control ──────────────────────────────────────────────────

router.get('/api/sandbox/status', requireDev, (_req, res) => {
  res.json({ status: sandboxStatus() });
});

router.post('/api/sandbox/start', requireDev, (_req, res) => {
  if (sandboxStatus() === 'running') return res.json({ ok: true, status: 'running' });
  startSandbox();
  res.json({ ok: true, status: sandboxStatus() });
});

router.post('/api/sandbox/stop', requireDev, (_req, res) => {
  stopSandbox();
  res.json({ ok: true, status: 'stopping' });
});

router.post('/api/sandbox/restart', requireDev, (_req, res) => {
  stopSandbox();
  // Give the process up to 1s to fully stop, then start
  const wait = sandboxProc ? 800 : 0;
  setTimeout(() => { startSandbox(); }, wait);
  res.json({ ok: true, status: 'restarting' });
});

// ─── SSE log stream ───────────────────────────────────────────────────────────
router.get('/api/sandbox/logs', requireDev, (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // Send status immediately
  res.write(`event: status\ndata: ${JSON.stringify({ status: sandboxStatus() })}\n\n`);
  // Replay buffered log
  for (const entry of sandboxLog) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }

  sseClients.add(res);
  const cleanup = () => sseClients.delete(res);
  req.on('close', cleanup);
  res.on('error', cleanup);
});

module.exports = router;
