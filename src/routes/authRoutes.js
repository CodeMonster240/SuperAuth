const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const validator = require('validator');
const { createUser, findUserByEmail, findUserByUsername, comparePassword, updateUser, getUserSocialAccounts } = require('../db/users');
const { redirectIfAuth, requireAuth } = require('../middleware/auth');
const { passport } = require('../middleware/passport');

// ─── Sign Up ──────────────────────────────────────────────────────────────────
router.get('/signup', redirectIfAuth, (req, res) => {
  if (req.query.returnTo) req.session.returnTo = req.query.returnTo;
  res.render('auth/signup', { title: 'Create Account', error: null, social: getSocialProviders(), queryType: req.query.type || null });
});

router.post('/signup', redirectIfAuth, async (req, res) => {
  try {
    const { username, email, password, confirmPassword, displayName, birthYear, gender, country, language, marketingOk, accountType } = req.body;

    if (!username || !email || !password) return res.render('auth/signup', { title: 'Create Account', error: 'All fields required.', social: getSocialProviders() });
    if (!validator.isEmail(email)) return res.render('auth/signup', { title: 'Create Account', error: 'Invalid email address.', social: getSocialProviders() });
    if (password !== confirmPassword) return res.render('auth/signup', { title: 'Create Account', error: 'Passwords do not match.', social: getSocialProviders() });
    if (password.length < 12) return res.render('auth/signup', { title: 'Create Account', error: 'Password must be at least 12 characters.', social: getSocialProviders() });
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) return res.render('auth/signup', { title: 'Create Account', error: 'Username: 3-24 chars, letters/numbers/underscore only.', social: getSocialProviders() });

    const age = birthYear ? (new Date().getFullYear() - parseInt(birthYear)) : null;
    if (age !== null && age < 13) return res.render('auth/signup', { title: 'Create Account', error: 'You must be at least 13 to create an account (COPPA).', social: getSocialProviders() });

    if (await findUserByEmail(email)) return res.render('auth/signup', { title: 'Create Account', error: 'Email already in use.', social: getSocialProviders() });
    if (await findUserByUsername(username)) return res.render('auth/signup', { title: 'Create Account', error: 'Username taken.', social: getSocialProviders() });

    const type = accountType === 'developer' ? 'developer' : 'user';
    const user = await createUser({ username, email, password, displayName, accountType: type, birthYear: birthYear ? parseInt(birthYear) : null, gender, country, language, marketingOk: !!marketingOk });

    req.session.userId = user.id;
    req.session.justSignedUp = true;
    if (req.session.returnTo) {
      req.session.onboardingRedirect = req.session.returnTo;
      delete req.session.returnTo;
    }
    res.redirect('/onboarding');
  } catch (err) {
    console.error('Signup error:', err);
    res.render('auth/signup', { title: 'Create Account', error: 'Something went wrong. Please try again.', social: getSocialProviders() });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
router.get('/login', redirectIfAuth, (req, res) => {
  if (req.query.returnTo) req.session.returnTo = req.query.returnTo;
  res.render('auth/login', { title: 'Sign In', error: null, social: getSocialProviders() });
});

router.post('/login', redirectIfAuth, async (req, res) => {
  const { emailOrUsername, password, totpCode } = req.body;
  if (!emailOrUsername || !password) return res.render('auth/login', { title: 'Sign In', error: 'All fields required.', social: getSocialProviders() });

  const user = emailOrUsername.includes('@') ? await findUserByEmail(emailOrUsername) : await findUserByUsername(emailOrUsername);
  if (!user || !user.password_hash) return res.render('auth/login', { title: 'Sign In', error: 'Invalid credentials.', social: getSocialProviders() });

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) return res.render('auth/login', { title: 'Sign In', error: 'Invalid credentials.', social: getSocialProviders() });

  if (user.totp_enabled) {
    if (!totpCode) {
      return res.render('auth/login', { title: 'Sign In', error: null, needsTotp: true, userId: user.id, social: getSocialProviders() });
    }
    const verified = speakeasy.totp.verify({ secret: user.totp_secret, encoding: 'base32', token: totpCode, window: 2 });
    if (!verified) return res.render('auth/login', { title: 'Sign In', error: '2FA code invalid.', needsTotp: true, userId: user.id, social: getSocialProviders() });
  }

  req.session.userId = user.id;
  const returnTo = req.session.returnTo || (user.account_type === 'developer' ? '/dev' : '/dashboard');
  delete req.session.returnTo;
  res.redirect(returnTo);
});

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ─── Social Auth ──────────────────────────────────────────────────────────────
const oauthProviders = {
  google: { scope: ['profile', 'email'] },
  github: {},
  facebook: { scope: ['email'] }
};

for (const [provider, opts] of Object.entries(oauthProviders)) {
  router.get(`/auth/${provider}`, (req, res, next) => {
    if (req.query.returnTo) req.session.returnTo = req.query.returnTo;
    passport.authenticate(provider, opts)(req, res, next);
  });

  router.get(`/auth/${provider}/callback`,
    passport.authenticate(provider, { failureRedirect: '/login?error=social_fail' }),
    async (req, res) => {
      const user = req.user;
      if (user) {
        req.session.userId = user.id;
        if (req.session.justSignedUp) {
          if (req.session.returnTo) {
            req.session.onboardingRedirect = req.session.returnTo;
            delete req.session.returnTo;
          }
          return res.redirect('/onboarding');
        }
        const returnTo = req.session.returnTo || (user.account_type === 'developer' ? '/dev' : '/dashboard');
        delete req.session.returnTo;
        return res.redirect(returnTo);
      }
      res.redirect('/login?error=social_fail');
    }
  );
}

router.get('/onboarding', requireAuth, (req, res) => {
  if (!req.session.justSignedUp && !req.session.onboardingRedirect) {
    return res.redirect(req.user.account_type === 'developer' ? '/dev' : '/dashboard');
  }

  const isGoogleSignup = req.session.onboardingSource === 'google';

  res.render('auth/onboarding', {
    title: 'Finish setup',
    error: null,
    user: req.user,
    isGoogleSignup
  });
});

router.post('/onboarding', requireAuth, async (req, res) => {
  try {
    const { username, displayName, accountType, country, language, marketingOk } = req.body;
    if (!username || !displayName) {
      return res.render('auth/onboarding', { title: 'Finish setup', error: 'Please complete your profile.', user: req.user });
    }

    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      return res.render('auth/onboarding', { title: 'Finish setup', error: 'Username: 3-24 chars, letters/numbers/underscore only.', user: req.user });
    }

    const existing = await findUserByUsername(username);
    if (existing && existing.id !== req.user.id) {
      return res.render('auth/onboarding', { title: 'Finish setup', error: 'That username is already taken.', user: req.user });
    }

    const type = accountType === 'developer' ? 'developer' : 'user';
    await updateUser(req.user.id, {
      username,
      display_name: displayName,
      account_type: type,
      country: country || null,
      language: language || 'en',
      marketing_ok: marketingOk ? 1 : 0
    });

    delete req.session.justSignedUp;
    const redirectTo = req.session.onboardingRedirect || (type === 'developer' ? '/dev' : '/dashboard');
    delete req.session.onboardingRedirect;
    delete req.session.onboardingSource;
    res.redirect(redirectTo);
  } catch (err) {
    console.error('Onboarding error:', err);
    res.render('auth/onboarding', { title: 'Finish setup', error: 'Unable to complete onboarding. Please try again.', user: req.user });
  }
});

// ─── TOTP Setup ───────────────────────────────────────────────────────────────
router.get('/api/user/totp/setup', requireAuth, async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `SuperAuth (${req.user.email})`, issuer: 'SuperAuth', length: 20 });
  req.session.pendingTotpSecret = secret.base32;
  const qrUrl = await QRCode.toDataURL(secret.otpauth_url);
  res.json({ secret: secret.base32, qrUrl, otpauthUrl: secret.otpauth_url });
});

router.post('/api/user/totp/enable', requireAuth, (req, res) => {
  const { token } = req.body;
  const secret = req.session.pendingTotpSecret;
  if (!secret) return res.status(400).json({ error: 'No pending 2FA setup.' });
  const valid = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 2 });
  if (!valid) return res.status(400).json({ error: 'Invalid code. Try again.' });
  updateUser(req.user.id, { totp_secret: secret, totp_enabled: 1 }).then(() => {
    delete req.session.pendingTotpSecret;
    res.json({ ok: true });
  }).catch(() => res.status(500).json({ error: 'Unable to enable 2FA right now.' }));
});

router.post('/api/user/totp/disable', requireAuth, async (req, res) => {
  const { password } = req.body;
  const valid = await comparePassword(password, req.user.password_hash);
  if (!valid) return res.status(403).json({ error: 'Wrong password.' });
  await updateUser(req.user.id, { totp_secret: null, totp_enabled: 0 });
  res.json({ ok: true });
});

// ─── User profile API ─────────────────────────────────────────────────────────
router.get('/api/user/me', requireAuth, (req, res) => {
  const { password_hash, totp_secret, ...safe } = req.user;
  res.json(safe);
});

router.patch('/api/user/me', requireAuth, async (req, res) => {
  const { displayName, gender, country, language, marketingOk } = req.body;
  await updateUser(req.user.id, {
    display_name: displayName,
    gender,
    country,
    language,
    marketing_ok: marketingOk !== undefined ? (marketingOk ? 1 : 0) : undefined
  });
  res.json({ ok: true });
});

router.get('/api/user/social', requireAuth, async (req, res) => {
  res.json(await getUserSocialAccounts(req.user.id));
});

function getEnvFlag(...keys) {
  return keys.some((key) => {
    const value = process.env[key];
    return value && value !== '' && !value.startsWith('your_');
  });
}

function getSocialProviders() {
  return {
    google: getEnvFlag('GOOGLE_CLIENT_ID', 'sign-in-with-google-client-id') && getEnvFlag('GOOGLE_CLIENT_SECRET', 'sign-in-with-google-client-secret'),
    github: getEnvFlag('GITHUB_CLIENT_ID') && getEnvFlag('GITHUB_CLIENT_SECRET'),
    facebook: getEnvFlag('FACEBOOK_APP_ID') && getEnvFlag('FACEBOOK_APP_SECRET'),
  };
}

module.exports = router;
