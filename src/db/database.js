const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/superauth.db');

let db;

function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new sqlite3.Database(DB_PATH);
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastInsertRowid: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    getDb().exec(sql, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

async function initDb() {
  await run('PRAGMA journal_mode = WAL');
  await run('PRAGMA foreign_keys = ON');

  await exec(`
    /* ─── Users ─────────────────────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid         TEXT    NOT NULL UNIQUE,
      username     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      email        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT,
      display_name TEXT,
      avatar_url   TEXT,
      account_type TEXT    NOT NULL DEFAULT 'user',  -- 'user' | 'developer'
      birth_year   INTEGER,
      gender       TEXT,
      country      TEXT,
      language     TEXT    DEFAULT 'en',
      marketing_ok INTEGER DEFAULT 1,
      is_verified  INTEGER DEFAULT 0,
      is_active    INTEGER DEFAULT 1,
      totp_secret  TEXT,
      totp_enabled INTEGER DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    /* ─── Social Accounts ────────────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS social_accounts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider    TEXT    NOT NULL,  -- 'google'|'github'|'twitter'|'facebook'|'instagram'|'microsoft'
      provider_id TEXT    NOT NULL,
      access_token  TEXT,
      refresh_token TEXT,
      profile_data  TEXT,  -- JSON
      linked_at     TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(provider, provider_id)
    );

    /* ─── Developer Applications (Integrations) ──────────────────── */
    CREATE TABLE IF NOT EXISTS applications (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid         TEXT    NOT NULL UNIQUE,
      owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name         TEXT    NOT NULL,
      slug         TEXT    NOT NULL UNIQUE,
      description  TEXT,
      logo_url     TEXT,
      website_url  TEXT,
      callback_url TEXT,
      client_id    TEXT    NOT NULL UNIQUE,
      client_secret TEXT   NOT NULL,
      is_active    INTEGER DEFAULT 1,
      is_verified  INTEGER DEFAULT 0,
      total_users  INTEGER DEFAULT 0,
      total_clicks INTEGER DEFAULT 0,
      created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    /* ─── Application Analytics Events ───────────────────────────── */
    CREATE TABLE IF NOT EXISTS app_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id      INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      event_type  TEXT    NOT NULL,  -- 'signup'|'login'|'clickthrough'|'error'
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ip_address  TEXT,
      user_agent  TEXT,
      metadata    TEXT,  -- JSON
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    /* ─── DeepLink Sessions ───────────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS deeplinks (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      slug         TEXT    NOT NULL UNIQUE,
      app_id       INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      requesting_origin TEXT,
      return_to    TEXT,
      callback_url TEXT,
      code         TEXT    UNIQUE,
      user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      status       TEXT NOT NULL DEFAULT 'pending',  -- 'pending'|'authenticated'|'consumed'|'expired'
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at   TEXT NOT NULL,
      authenticated_at TEXT,
      consumed_at  TEXT
    );

    /* ─── User <-> App link (which users have authorised which apps) */
    CREATE TABLE IF NOT EXISTS user_app_connections (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      app_id     INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      is_active  INTEGER DEFAULT 1,
      scopes     TEXT DEFAULT 'identity',
      connected_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_used_at TEXT,
      UNIQUE(user_id, app_id)
    );

    /* ─── Sessions (stored in SQLite via connect-sqlite3) ────────── */

    /* ─── Indexes ─────────────────────────────────────────────────── */
    CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_deeplinks_slug ON deeplinks(slug);
    CREATE INDEX IF NOT EXISTS idx_deeplinks_code ON deeplinks(code);
    CREATE INDEX IF NOT EXISTS idx_app_events_app ON app_events(app_id, event_type);

    /* ─── Short Links ─────────────────────────────────── */
    CREATE TABLE IF NOT EXISTS short_links (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      code       TEXT    NOT NULL UNIQUE,
      long_url   TEXT    NOT NULL,
      app_id     INTEGER REFERENCES applications(id) ON DELETE CASCADE,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_short_links_code ON short_links(code);
  `);

  console.log('✅  Database initialised');
  return getDb();
}

module.exports = { getDb, initDb, run, get, all, exec };
