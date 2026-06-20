require('dotenv').config();
process.on('uncaughtException',  (err)    => console.error('[uncaughtException]',  err));
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));
const express = require('express');
const path = require('path');
const http = require('http');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');

const { initDb } = require('./db/database');
const { setupPassport, passport } = require('./middleware/passport');
const { loadUser } = require('./middleware/auth');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const devRoutes = require('./routes/devRoutes');
const deeplinkRoutes = require('./routes/deeplinkRoutes');
const docsRoutes = require('./routes/docsRoutes');
const { getShortLink } = require('./db/shortlinks');

// Ensure data dir exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Init DB
setupPassport();

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  }
}));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Too many attempts, please wait.' });
app.use(limiter);

// ─── View engine ──────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'partials/layout');
app.use(expressLayouts);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret_change_in_production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(loadUser);

// ─── Template locals ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.env = process.env.NODE_ENV;
  res.locals.baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.render('landing', { title: 'SuperAuth — Universal SSO Platform' }));

app.use('/auth', authLimiter);
app.use('/', authRoutes);
app.use('/docs', docsRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/dev', devRoutes);
app.use('/deeplink', deeplinkRoutes);

// ─── Short link redirects ────────────────────────────────────────────────────
app.get('/go/:code', async (req, res) => {
  try {
    const link = await getShortLink(req.params.code);
    if (!link) return res.status(404).render('errors/404', { title: 'Link Not Found' });
    res.redirect(302, link.long_url);
  } catch {
    res.status(500).render('errors/500', { title: '500' });
  }
});

// ─── Sandbox proxy (forwards /sandbox/* to local sandbox process) ─────────────
{
  const SANDBOX_CFG = path.join(__dirname, '../sandbox/config.json');
  const getSandboxPort = () => {
    try { return JSON.parse(fs.readFileSync(SANDBOX_CFG, 'utf8')).SANDBOX_PORT || 4000; }
    catch { return 4000; }
  };
  app.use('/sandbox', (req, res) => {
    const port = getSandboxPort();

    // Body parsers upstream may have already consumed the stream — re-materialise.
    let bodyBuf = null;
    if (req.body !== undefined && req.method !== 'GET' && req.method !== 'HEAD') {
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        bodyBuf = Buffer.from(JSON.stringify(req.body));
      } else if (ct.includes('application/x-www-form-urlencoded')) {
        bodyBuf = Buffer.from(new URLSearchParams(req.body).toString());
      }
    }

    const headers = {
      ...req.headers,
      host: `127.0.0.1:${port}`,
      'x-forwarded-host':  req.headers.host || '',
      'x-forwarded-proto': req.protocol,
    };
    if (bodyBuf) headers['content-length'] = bodyBuf.byteLength;

    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/sandbox' + req.url,
      method: req.method,
      headers,
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    proxyReq.on('error', () => {
      if (!res.headersSent) res.status(502).send('Sandbox is not running. Start it from the Dev Console.');
    });
    if (bodyBuf) {
      proxyReq.end(bodyBuf);
    } else {
      req.pipe(proxyReq, { end: true });
    }
  });
}

// ─── 404 / Error handlers ─────────────────────────────────────────────────────
app.use((req, res) => res.status(404).render('errors/404', { title: '404 — Not Found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('errors/500', { title: '500 — Server Error', message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong.' });
});

const PORT = Number(process.env.PORT || 3000);

function buildHostCandidates() {
  const hostFromEnv = process.env.HOST ? [process.env.HOST] : [];
  const hostFallbacks = (process.env.HOST_FALLBACKS || '::,0.0.0.0,127.0.0.1')
    .split(',')
    .map(h => h.trim())
    .filter(Boolean);
  const unique = [];
  for (const host of [...hostFromEnv, ...hostFallbacks]) {
    if (!unique.includes(host)) unique.push(host);
  }
  return unique;
}

function buildPortCandidates(basePort) {
  const fallbackCount = Number(process.env.PORT_FALLBACKS || 20);
  const ports = [];
  for (let i = 0; i <= fallbackCount; i += 1) {
    ports.push(basePort + i);
  }
  return ports;
}

function listenOnce(port, host) {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host);
    const onError = (err) => {
      server.off('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(server);
    };
    server.once('error', onError);
    server.once('listening', onListening);
  });
}

async function startServerWithFallbacks() {
  const hosts = buildHostCandidates();
  const ports = buildPortCandidates(PORT);

  for (const host of hosts) {
    for (const port of ports) {
      try {
        await listenOnce(port, host);
        console.log(`🚀  SuperAuth running at http://localhost:${port} (bound ${host})`);
        return;
      } catch (err) {
        // Continue trying alternates for common bind failures.
        if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES')) {
          continue;
        }
        throw err;
      }
    }
  }

  throw new Error(`Unable to bind server. Tried hosts=[${hosts.join(', ')}], ports=[${ports[0]}..${ports[ports.length - 1]}].`);
}

initDb()
  .then(() => {
    return startServerWithFallbacks();
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

module.exports = app;
