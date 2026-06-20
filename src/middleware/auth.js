const { findUserById } = require('../db/users');

function requireAuth(req, res, next) {
  Promise.resolve().then(async () => {
    if (req.session && req.session.userId) {
      const user = await findUserById(req.session.userId);
      if (user) {
        req.user = user;
        return next();
      }
    }
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
  }).catch(next);
}

function requireDev(req, res, next) {
  Promise.resolve().then(async () => {
    if (req.session && req.session.userId) {
      const user = await findUserById(req.session.userId);
      if (user && user.account_type === 'developer') {
        req.user = user;
        return next();
      }
      if (user) {
        return res.redirect('/dashboard');
      }
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
  }).catch(next);
}

function redirectIfAuth(req, res, next) {
  Promise.resolve().then(async () => {
    if (req.session && req.session.userId) {
      const user = await findUserById(req.session.userId);
      if (user) {
        req.user = user;
        return res.redirect(user.account_type === 'developer' ? '/dev' : '/dashboard');
      }
    }
    next();
  }).catch(next);
}

function loadUser(req, res, next) {
  Promise.resolve().then(async () => {
    if (req.session && req.session.userId) {
      const user = await findUserById(req.session.userId);
      if (user) req.user = user;
    }
    next();
  }).catch(next);
}

module.exports = { requireAuth, requireDev, redirectIfAuth, loadUser };
