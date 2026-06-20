const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createDeeplink, getDeeplinkBySlug, authenticateDeeplink, consumeDeeplinkCode, expireOldDeeplinks } = require('../db/deeplinks');
const { getApplicationByClientId, getApplicationById, recordAppEvent, incrementAppStat, getOrCreateUserAppConnection } = require('../db/applications');
const { findUserById } = require('../db/users');
const { get: dbGet } = require('../db/database');
const validator = require('validator');

/**
 * Entry point: external app redirects user here to begin DeepLink auth
 * GET /deeplink/create?client_id=sa_xxx&return_to=https://app.io/callback&origin=https://app.io
 */
router.get('/create', (req, res) => {
  Promise.resolve().then(async () => {
  await expireOldDeeplinks();
  const { client_id, return_to, origin } = req.query;
  if (!client_id) return res.status(400).render('errors/400', { title: 'Bad Request', message: 'Missing client_id.' });

  const app = await getApplicationByClientId(client_id);
  if (!app || !app.is_active) return res.status(400).render('errors/400', { title: 'Bad Request', message: 'Unknown or inactive application.' });

  // Validate origin against registered website_url
  let requestingOrigin = origin || null;
  if (!requestingOrigin && req.headers.referer) {
    try {
      requestingOrigin = new URL(req.headers.referer).origin;
    } catch {
      requestingOrigin = null;
    }
  }

  // Validate origin host against registered app website host when available.
  if (app.website_url && requestingOrigin) {
    try {
      const allowedHost = new URL(app.website_url).hostname;
      const requestHost = new URL(requestingOrigin).hostname;
      if (allowedHost !== requestHost) {
        return res.status(403).render('errors/400', { title: 'Origin Mismatch', message: 'Request origin does not match the integration website URL.' });
      }
    } catch {
      return res.status(400).render('errors/400', { title: 'Bad Request', message: 'Invalid origin or website URL.' });
    }
  }

  // Create the deeplink session
  const callbackUrl = return_to || app.callback_url;
  const dl = await createDeeplink({ appId: app.id, requestingOrigin, returnTo: return_to || null, callbackUrl });

  // Redirect to the auth slug page
  res.redirect(`/deeplink/auth/${dl.slug}`);
  }).catch(() => res.status(500).render('errors/500', { title: '500' }));
});

/**
 * Auth page: user signs in and authorises the requesting app
 * GET /deeplink/auth/:slug
 */
router.get('/auth/:slug', (req, res) => {
  Promise.resolve().then(async () => {
    await expireOldDeeplinks();
    const dl = await getDeeplinkBySlug(req.params.slug);
    if (!dl || dl.status !== 'pending' || dl.expires_at <= new Date().toISOString()) {
      return res.render('deeplink/expired', { title: 'Link Expired' });
    }
    const app = await getApplicationById(dl.app_id);
    if (!req.session.userId) {
      req.session.returnTo = `/deeplink/auth/${dl.slug}`;
    }
    res.render('deeplink/auth', {
      title: `Sign in to ${app.name}`,
      dl,
      app,
      user: req.session.userId ? await findUserById(req.session.userId) : null,
      error: null
    });
  }).catch(() => res.status(500).render('errors/500', { title: '500' }));
});

/**
 * POST /deeplink/auth/:slug — user confirms authorisation
 */
router.post('/auth/:slug', requireAuth, async (req, res) => {
  await expireOldDeeplinks();
  const dl = await getDeeplinkBySlug(req.params.slug);
  if (!dl || dl.status !== 'pending' || dl.expires_at <= new Date().toISOString()) {
    return res.render('deeplink/expired', { title: 'Link Expired' });
  }
  const app = await getApplicationById(dl.app_id);

  // Authenticate deeplink, get callback code
  const updatedDl = await authenticateDeeplink(dl.slug, req.user.id);

  // Record event
  await recordAppEvent(app.id, 'clickthrough', req.user.id, req.ip, req.headers['user-agent'], { slug: dl.slug });
  await getOrCreateUserAppConnection(req.user.id, app.id);
  await incrementAppStat(app.id, 'total_clicks');

  // Build callback URL
  let callbackUrl = updatedDl.callback_url || app.callback_url;
  if (!callbackUrl) {
    return res.render('deeplink/success', { title: 'Authorised!', app, returnTo: dl.return_to });
  }

  // Append code to callback URL
  try {
    const url = new URL(callbackUrl);
    url.searchParams.set('code', updatedDl.code);
    url.searchParams.set('state', dl.slug);
    return res.redirect(url.toString());
  } catch {
    return res.render('deeplink/success', { title: 'Authorised!', app, returnTo: dl.return_to });
  }
});

/**
 * Token exchange: external app backend POSTs code to get user info
 * POST /deeplink/token
 * Body: { client_id, client_secret, code }
 */
router.post('/token', express.json(), async (req, res) => {
  const { client_id, client_secret, code } = req.body;
  if (!client_id || !client_secret || !code) return res.status(400).json({ error: 'Missing parameters.' });

  const app = await getApplicationByClientId(client_id);
  if (!app || app.client_secret !== client_secret) return res.status(401).json({ error: 'Invalid credentials.' });

  const dl = await consumeDeeplinkCode(code);
  if (!dl) return res.status(400).json({ error: 'Invalid or expired code.' });

  if (dl.app_id !== app.id) return res.status(403).json({ error: 'Code does not belong to this app.' });

  const user = await findUserById(dl.user_id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  // First-time user → signup; returning user → login
  const prior = await dbGet(
    `SELECT id FROM app_events WHERE app_id = ? AND user_id = ? AND event_type = 'signup' LIMIT 1`,
    [app.id, user.id]
  );
  const eventType = prior ? 'login' : 'signup';
  await recordAppEvent(app.id, eventType, user.id, null, null, { source: 'token_exchange' });
  if (!prior) await incrementAppStat(app.id, 'total_users');

  // Return safe user profile
  res.json({
    id: user.uuid,
    username: user.username,
    display_name: user.display_name,
    email: user.email,
    avatar_url: user.avatar_url,
    account_created: user.created_at
  });
});

module.exports = router;
