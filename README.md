# SuperAuth

A full-stack OAuth SSO platform built with Node.js, Express, SQLite, bcrypt, Passport, and a glassmorphism UI.

## What You Get

- Secure local auth with bcrypt password hashing (12 rounds)
- COPPA-aware signup (age gate for under-13)
- 2FA with TOTP + QR setup
- Social login/linking:
  - Google
  - GitHub
  - Facebook
  - Instagram (via Meta/Facebook auth flow)
- DeepLink OAuth-like SSO flow for third-party integrations
- Separate regular user and developer dashboards
- Frontend-routed dashboard modules with persistent sidenav
- Animated landing page + counters + loading transitions

## Tech Stack

- Backend: Node.js, Express, Passport
- Database: SQLite (`sqlite3`)
- Auth Security: bcryptjs, rate limiting, Helmet
- Templating: EJS + express-ejs-layouts
- Frontend: vanilla JS SPA routing for dashboard sections

## 1) Install

```bash
npm install
```

## 2) Configure Environment

Copy `.env.example` to `.env` and set values:

```bash
PORT=3000
SESSION_SECRET=use_a_very_long_random_secret
NODE_ENV=development
BASE_URL=http://localhost:3000
```

Set OAuth credentials for providers you want active:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`

## 3) Run

```bash
npm run dev
```

If port `3000` is already used:

```bash
set PORT=3001 && npm start
```

## 4) Routes

- Landing: `/`
- Signup: `/signup`
- Login: `/login`
- User dashboard: `/dashboard`
- Developer dashboard: `/dev`
- Developer integration page: `/dev/integration/:slug`
- DeepLink create: `/deeplink/create?client_id=...&origin=https://yourapp.com&return_to=https://yourapp.com/callback/superauth`
- DeepLink token exchange: `POST /deeplink/token`

## 5) OAuth Provider Setup

Use `BASE_URL` as your app host in development, e.g. `http://localhost:3000`.

### Google

1. Open Google Cloud Console.
2. Create OAuth 2.0 Client ID (Web application).
3. Authorized redirect URI:
   - `http://localhost:3000/auth/google/callback`
4. Add credentials to `.env`.

### GitHub

1. Create an OAuth App in GitHub Developer Settings.
2. Authorization callback URL:
   - `http://localhost:3000/auth/github/callback`
3. Add credentials to `.env`.

### Facebook (and Instagram via Meta)

1. Create a Meta App in Facebook Developers.
2. Add Facebook Login product.
3. Valid OAuth Redirect URI:
   - `http://localhost:3000/auth/facebook/callback`
4. Add app credentials to `.env`.
5. Instagram login in this project routes through the Meta/Facebook auth strategy.

## 6) DeepLink Integration (Developer Flow)

### In SuperAuth Developer Dashboard

1. Sign up as developer (`/signup`, choose Developer).
2. Open `/dev` and create an integration.
3. Save:
   - Website URL (origin check)
   - Callback URL (where code should be returned)
4. Copy generated `client_id` and `client_secret`.

### In Your External App (example: simpleclikr.io)

Redirect user to:

```text
https://your-superauth-domain/deeplink/create?client_id=sa_xxx&origin=https://simpleclikr.io&return_to=https://simpleclikr.io/callback/superauth
```

After user approves, SuperAuth redirects to:

```text
https://simpleclikr.io/callback/superauth?code=...&state=...
```

Then exchange code server-to-server:

```bash
POST /deeplink/token
Content-Type: application/json

{
  "client_id": "sa_xxx",
  "client_secret": "your_secret",
  "code": "returned_code"
}
```

Response includes safe user profile fields.

## Security Notes

- Passwords are hashed with bcrypt (12 rounds).
- Sessions are HTTP-only cookies.
- Helmet adds core security headers.
- Auth endpoints are rate-limited.
- DeepLink codes are one-time and expire.
- Origin host checks protect against mismatched app origins.

## Current Notes

- X/Twitter and Microsoft linking UI placeholders are present but not fully wired to Passport strategies yet.
- Instagram is handled through Meta/Facebook flow.

## Suggested Next Upgrades

- Add Redis session store for production scaling.
- Add refresh token + signed JWT for external API authorization.
- Add email verification + password reset.
- Add backup codes for TOTP.
