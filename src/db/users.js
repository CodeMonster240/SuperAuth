const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../db/database');

const SALT_ROUNDS = 12;

function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

async function createUser({ username, email, password, displayName, accountType = 'user', birthYear, gender, country, language, marketingOk }) {
  const hash = await hashPassword(password);
  const uuid = uuidv4();
  const result = await run(`
      INSERT INTO users (uuid, username, email, password_hash, display_name, account_type, birth_year, gender, country, language, marketing_ok)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [uuid, username.toLowerCase(), email.toLowerCase(), hash, displayName || username, accountType, birthYear || null, gender || null, country || null, language || 'en', marketingOk ? 1 : 0]);
  return get('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]);
}

function findUserByEmail(email) {
  return get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email.toLowerCase()]);
}

function findUserById(id) {
  return get('SELECT * FROM users WHERE id = ? AND is_active = 1', [id]);
}

function findUserByUsername(username) {
  return get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username.toLowerCase()]);
}

function updateUser(id, fields) {
  const allowed = ['username', 'display_name', 'avatar_url', 'email', 'account_type', 'birth_year', 'gender', 'country', 'language', 'marketing_ok', 'totp_secret', 'totp_enabled'];
  if (fields.username) fields.username = fields.username.toLowerCase();
  if (fields.email) fields.email = fields.email.toLowerCase();
  const sets = Object.keys(fields).filter(k => allowed.includes(k)).map(k => `${k} = ?`);
  if (!sets.length) return;
  const vals = Object.keys(fields).filter(k => allowed.includes(k)).map(k => fields[k]);
  vals.push(id);
  return run(`UPDATE users SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`, vals);
}

function getSocialAccount(provider, providerId) {
  return get('SELECT * FROM social_accounts WHERE provider = ? AND provider_id = ?', [provider, providerId]);
}

function linkSocialAccount(userId, provider, providerId, accessToken, refreshToken, profileData) {
  return run(`
    INSERT INTO social_accounts (user_id, provider, provider_id, access_token, refresh_token, profile_data)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider, provider_id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      profile_data = excluded.profile_data
  `, [userId, provider, providerId, accessToken || null, refreshToken || null, JSON.stringify(profileData || {})]);
}

function getUserSocialAccounts(userId) {
  return all('SELECT provider, provider_id, linked_at FROM social_accounts WHERE user_id = ?', [userId]);
}

function unlinkSocialAccount(userId, provider) {
  return run('DELETE FROM social_accounts WHERE user_id = ? AND provider = ?', [userId, provider]);
}

module.exports = {
  hashPassword,
  comparePassword,
  createUser,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  updateUser,
  getSocialAccount,
  linkSocialAccount,
  getUserSocialAccounts,
  unlinkSocialAccount
};
