const { nanoid } = require('nanoid');
const { run, get } = require('./database');

const CODE_LENGTH = 7;

async function createShortLink({ longUrl, appId, createdBy }) {
  // Reuse existing short link for the same long URL + app owner combination
  const existing = await get(
    'SELECT code FROM short_links WHERE long_url = ? AND created_by = ? LIMIT 1',
    [longUrl, createdBy]
  );
  if (existing) return existing.code;

  let code;
  let attempts = 0;
  do {
    code = nanoid(CODE_LENGTH);
    attempts++;
    if (attempts > 20) throw new Error('Could not generate unique short code');
  } while (await get('SELECT id FROM short_links WHERE code = ?', [code]));

  await run(
    'INSERT INTO short_links (code, long_url, app_id, created_by) VALUES (?, ?, ?, ?)',
    [code, longUrl, appId || null, createdBy || null]
  );
  return code;
}

function getShortLink(code) {
  return get('SELECT * FROM short_links WHERE code = ?', [code]);
}

module.exports = { createShortLink, getShortLink };
