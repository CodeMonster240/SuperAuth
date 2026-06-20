const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const { findUserById, getSocialAccount, linkSocialAccount, findUserByEmail } = require('../db/users');
const { v4: uuidv4 } = require('uuid');
const { get, run } = require('../db/database');

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  findUserById(id)
    .then(user => done(null, user || false))
    .catch(done);
});

function getConfigVar(...keys) {
  return keys
    .map((key) => process.env[key])
    .find((value) => value && value !== '' && !value.startsWith('your_')) || null;
}

function buildOAuthCallback(provider) {
  return async (req, accessToken, refreshToken, profile, done) => {
    try {
      const providerId = String(profile.id);
      const email = (profile.emails && profile.emails[0] && profile.emails[0].value) || null;
      const displayName = profile.displayName || profile.username || 'User';
      const avatarUrl = (profile.photos && profile.photos[0] && profile.photos[0].value) || null;
      const currentUser = req.user || null;

      // Check if social account already exists
      let existing = await getSocialAccount(provider, providerId);
      if (existing) {
        const user = await findUserById(existing.user_id);
        if (user) {
          await linkSocialAccount(user.id, provider, providerId, accessToken, refreshToken, profile._json);
          return done(null, user);
        }
      }

      // When linking from Settings, attach the provider to the signed-in account.
      if (currentUser) {
        await linkSocialAccount(currentUser.id, provider, providerId, accessToken, refreshToken, profile._json);
        return done(null, currentUser);
      }

      // Try to match by email
      if (email) {
        const userByEmail = await findUserByEmail(email);
        if (userByEmail) {
          await linkSocialAccount(userByEmail.id, provider, providerId, accessToken, refreshToken, profile._json);
          return done(null, userByEmail);
        }
      }

      // Create new user
      const username = await generateUniqueUsername(displayName);
      const uuid = uuidv4();
      const userEmail = email || `${provider}-${providerId}@social.superauth.local`;
      const result = await run(`
        INSERT INTO users (uuid, username, email, display_name, avatar_url, account_type, is_verified)
        VALUES (?, ?, ?, ?, ?, 'user', ?)
      `, [uuid, username, userEmail, displayName, avatarUrl, email ? 1 : 0]);
      const newUser = await findUserById(result.lastInsertRowid);
      await linkSocialAccount(newUser.id, provider, providerId, accessToken, refreshToken, profile._json);

      if (req && req.session) {
        req.session.justSignedUp = true;
        req.session.onboardingSource = provider;
      }

      return done(null, newUser);
    } catch (err) {
      return done(err);
    }
  };
}

async function generateUniqueUsername(displayName) {
  const base = displayName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18) || 'user';
  let username = base;
  let i = 0;
  while (await get('SELECT id FROM users WHERE username = ?', [username])) {
    i++;
    username = `${base}${i}`;
  }
  return username;
}

function setupPassport() {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const googleClientId = getConfigVar('GOOGLE_CLIENT_ID', 'sign-in-with-google-client-id');
  const googleClientSecret = getConfigVar('GOOGLE_CLIENT_SECRET', 'sign-in-with-google-client-secret');

  if (googleClientId && googleClientSecret) {
    passport.use(new GoogleStrategy({
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: `${baseUrl}/auth/google/callback`,
      passReqToCallback: true,
      scope: ['profile', 'email']
    }, buildOAuthCallback('google')));
  }

  const githubClientId = getConfigVar('GITHUB_CLIENT_ID');
  const githubClientSecret = getConfigVar('GITHUB_CLIENT_SECRET');
  if (githubClientId && githubClientSecret) {
    passport.use(new GitHubStrategy({
      clientID: githubClientId,
      clientSecret: githubClientSecret,
      callbackURL: `${baseUrl}/auth/github/callback`,
      passReqToCallback: true
    }, buildOAuthCallback('github')));
  }

  const facebookAppId = getConfigVar('FACEBOOK_APP_ID');
  const facebookAppSecret = getConfigVar('FACEBOOK_APP_SECRET');
  if (facebookAppId && facebookAppSecret) {
    passport.use(new FacebookStrategy({
      clientID: facebookAppId,
      clientSecret: facebookAppSecret,
      callbackURL: `${baseUrl}/auth/facebook/callback`,
      passReqToCallback: true,
      profileFields: ['id', 'emails', 'name', 'picture']
    }, buildOAuthCallback('facebook')));
  }

  return passport;
}

module.exports = { setupPassport, passport };
