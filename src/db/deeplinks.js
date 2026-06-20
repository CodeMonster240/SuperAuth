const { nanoid } = require('nanoid');
const crypto = require('crypto');
const { run, get } = require('./database');

async function createDeeplink({ appId, requestingOrigin, returnTo, callbackUrl }) {
  const slug = nanoid(16);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min
  await run(`
    INSERT INTO deeplinks (slug, app_id, requesting_origin, return_to, callback_url, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [slug, appId, requestingOrigin || null, returnTo || null, callbackUrl || null, expiresAt]);
  return get('SELECT * FROM deeplinks WHERE slug = ?', [slug]);
}

function getDeeplinkBySlug(slug) {
  return get('SELECT * FROM deeplinks WHERE slug = ?', [slug]);
}

async function authenticateDeeplink(slug, userId) {
  const dl = await get('SELECT * FROM deeplinks WHERE slug = ? AND status = ? AND expires_at > datetime(\'now\')', [slug, 'pending']);
  if (!dl) return null;
  const code = crypto.randomBytes(32).toString('hex');
  await run(`
    UPDATE deeplinks SET user_id = ?, status = 'authenticated', code = ?, authenticated_at = datetime('now')
    WHERE slug = ?
  `, [userId, code, slug]);
  return get('SELECT * FROM deeplinks WHERE slug = ?', [slug]);
}

async function consumeDeeplinkCode(code) {
  const dl = await get(`SELECT * FROM deeplinks WHERE code = ? AND status = 'authenticated' AND expires_at > datetime('now')`, [code]);
  if (!dl) return null;
  await run(`UPDATE deeplinks SET status = 'consumed', consumed_at = datetime('now') WHERE code = ?`, [code]);
  return dl;
}

function expireOldDeeplinks() {
  return run(`UPDATE deeplinks SET status = 'expired' WHERE expires_at <= datetime('now') AND status = 'pending'`);
}

module.exports = { createDeeplink, getDeeplinkBySlug, authenticateDeeplink, consumeDeeplinkCode, expireOldDeeplinks };
