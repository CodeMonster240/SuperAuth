const { v4: uuidv4 } = require('uuid');
const { nanoid } = require('nanoid');
const slugify = require('slugify');
const { run, get, all } = require('./database');
const crypto = require('crypto');

function generateClientId() {
  return 'sa_' + nanoid(32);
}

function generateClientSecret() {
  return crypto.randomBytes(40).toString('hex');
}

async function createApplication({ ownerId, name, description, websiteUrl, callbackUrl, logoUrl }) {
  const uuid = uuidv4();
  const baseSlug = slugify(name, { lower: true, strict: true });
  // ensure slug uniqueness
  let slug = baseSlug;
  let attempt = 0;
  while (await get('SELECT id FROM applications WHERE slug = ?', [slug])) {
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }
  const clientId = generateClientId();
  const clientSecret = generateClientSecret();

  const result = await run(`
    INSERT INTO applications (uuid, owner_id, name, slug, description, website_url, callback_url, logo_url, client_id, client_secret)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [uuid, ownerId, name, slug, description || null, websiteUrl || null, callbackUrl || null, logoUrl || null, clientId, clientSecret]);

  return get('SELECT * FROM applications WHERE id = ?', [result.lastInsertRowid]);
}

function getApplicationBySlug(slug) {
  return get('SELECT * FROM applications WHERE slug = ? AND is_active = 1', [slug]);
}

function getApplicationByClientId(clientId) {
  return get('SELECT * FROM applications WHERE client_id = ?', [clientId]);
}

function getApplicationById(id) {
  return get('SELECT * FROM applications WHERE id = ?', [id]);
}

function getApplicationsByOwner(ownerId) {
  return all('SELECT * FROM applications WHERE owner_id = ? ORDER BY created_at DESC', [ownerId]);
}

function updateApplication(id, ownerId, fields) {
  const allowed = ['name', 'description', 'website_url', 'callback_url', 'logo_url', 'is_active'];
  const keys = Object.keys(fields).filter(k => allowed.includes(k) && fields[k] !== undefined);
  const sets = keys.map(k => `${k} = ?`);
  if (!sets.length) return;
  const vals = keys.map(k => fields[k]);
  vals.push(id, ownerId);
  return run(`UPDATE applications SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ? AND owner_id = ?`, vals);
}

function deleteApplication(id, ownerId) {
  return run(`DELETE FROM applications WHERE id = ? AND owner_id = ?`, [id, ownerId]);
}

function regenerateClientSecret(id, ownerId) {
  const secret = generateClientSecret();
  return run(`UPDATE applications SET client_secret = ?, updated_at = datetime('now') WHERE id = ? AND owner_id = ?`, [secret, id, ownerId]).then(() => secret);
}

function recordAppEvent(appId, eventType, userId, ipAddress, userAgent, metadata) {
  return run(`
    INSERT INTO app_events (app_id, event_type, user_id, ip_address, user_agent, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [appId, eventType, userId || null, ipAddress || null, userAgent || null, metadata ? JSON.stringify(metadata) : null]);
}

function incrementAppStat(appId, field) {
  const allowed = ['total_users', 'total_clicks'];
  if (!allowed.includes(field)) return;
  return run(`UPDATE applications SET ${field} = ${field} + 1 WHERE id = ?`, [appId]);
}

async function getAppAnalytics(appId, days = 30) {
  const [signups, logins, clickthroughs, dailyCounts] = await Promise.all([
    get(`SELECT COUNT(DISTINCT user_id) as c FROM app_events WHERE app_id = ? AND event_type = 'signup' AND created_at > datetime('now', ?)`, [appId, `-${days} days`]),
    get(`SELECT COUNT(*) as c FROM app_events WHERE app_id = ? AND event_type = 'login' AND created_at > datetime('now', ?)`, [appId, `-${days} days`]),
    get(`SELECT COUNT(*) as c FROM app_events WHERE app_id = ? AND event_type = 'clickthrough' AND created_at > datetime('now', ?)`, [appId, `-${days} days`]),
    all(`
      SELECT date(created_at) as day, event_type, COUNT(*) as c
      FROM app_events
      WHERE app_id = ? AND created_at > datetime('now', ?)
      GROUP BY day, event_type
      ORDER BY day DESC
    `, [appId, `-${days} days`])
  ]);

  return {
    signups: signups ? signups.c : 0,
    logins: logins ? logins.c : 0,
    clickthroughs: clickthroughs ? clickthroughs.c : 0,
    dailyCounts
  };
}

function getUserAppConnections(userId) {
  return all(`
    SELECT uac.*, a.name, a.slug, a.logo_url, a.website_url, a.description
    FROM user_app_connections uac
    JOIN applications a ON a.id = uac.app_id
    WHERE uac.user_id = ?
    ORDER BY uac.connected_at DESC
  `, [userId]);
}

async function getOrCreateUserAppConnection(userId, appId) {
  let conn = await get('SELECT * FROM user_app_connections WHERE user_id = ? AND app_id = ?', [userId, appId]);
  if (!conn) {
    await run('INSERT INTO user_app_connections (user_id, app_id) VALUES (?, ?)', [userId, appId]);
    conn = await get('SELECT * FROM user_app_connections WHERE user_id = ? AND app_id = ?', [userId, appId]);
  }
  return conn;
}

function setUserAppConnectionStatus(userId, appId, isActive) {
  return run('UPDATE user_app_connections SET is_active = ? WHERE user_id = ? AND app_id = ?', [isActive ? 1 : 0, userId, appId]);
}

module.exports = {
  createApplication,
  getApplicationBySlug,
  getApplicationByClientId,
  getApplicationById,
  getApplicationsByOwner,
  updateApplication,
  deleteApplication,
  regenerateClientSecret,
  recordAppEvent,
  incrementAppStat,
  getAppAnalytics,
  getUserAppConnections,
  getOrCreateUserAppConnection,
  setUserAppConnectionStatus
};
