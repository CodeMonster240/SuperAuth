const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getUserAppConnections, setUserAppConnectionStatus } = require('../db/applications');
const { getUserSocialAccounts, unlinkSocialAccount, updateUser, comparePassword, hashPassword } = require('../db/users');
const { run } = require('../db/database');

// User dashboard SPA shell
const shellPages = ['/', '/home', '/integrations', '/security', '/settings'];
router.get(shellPages, requireAuth, (req, res) => {
  res.render('dashboard/user', { title: 'Dashboard', user: req.user });
});

// API: Get connected apps
router.get('/api/connections', requireAuth, async (req, res) => {
  const connections = await getUserAppConnections(req.user.id);
  res.json(connections);
});

// API: Toggle app connection
router.patch('/api/connections/:appId', requireAuth, async (req, res) => {
  const { active } = req.body;
  await setUserAppConnectionStatus(req.user.id, parseInt(req.params.appId, 10), !!active);
  res.json({ ok: true });
});

// API: Revoke app connection
router.delete('/api/connections/:appId', requireAuth, async (req, res) => {
  await run('DELETE FROM user_app_connections WHERE user_id = ? AND app_id = ?', [req.user.id, parseInt(req.params.appId, 10)]);
  res.json({ ok: true });
});

// API: Social accounts
router.get('/api/social', requireAuth, async (req, res) => {
  res.json(await getUserSocialAccounts(req.user.id));
});

router.delete('/api/social/:provider', requireAuth, async (req, res) => {
  await unlinkSocialAccount(req.user.id, req.params.provider);
  res.json({ ok: true });
});

// API: Update profile
router.patch('/api/profile', requireAuth, async (req, res) => {
  const { displayName, gender, country, language, marketingOk } = req.body;
  const updates = {};
  if (displayName) updates.display_name = displayName;
  if (gender !== undefined) updates.gender = gender;
  if (country !== undefined) updates.country = country;
  if (language !== undefined) updates.language = language;
  if (marketingOk !== undefined) updates.marketing_ok = marketingOk ? 1 : 0;
  await updateUser(req.user.id, updates);
  res.json({ ok: true });
});

// API: Change password
router.post('/api/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Missing fields.' });
  if (newPassword.length < 12) return res.status(400).json({ error: 'New password must be at least 12 characters.' });

  if (!req.user.password_hash) return res.status(400).json({ error: 'Password login is not set for this account.' });
  const valid = await comparePassword(currentPassword, req.user.password_hash);
  if (!valid) return res.status(403).json({ error: 'Current password is incorrect.' });

  const nextHash = await hashPassword(newPassword);
  await run('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?', [nextHash, req.user.id]);
  res.json({ ok: true });
});

// API: Switch account type
router.post('/api/account-type', requireAuth, async (req, res) => {
  const { accountType } = req.body;
  if (!accountType || !['user', 'developer'].includes(accountType)) {
    return res.status(400).json({ error: 'Invalid account type.' });
  }
  await updateUser(req.user.id, { account_type: accountType });
  res.json({ ok: true, accountType });
});

module.exports = router;
