const crypto = require('crypto');

const BASE = 'https://distribution.liogames.com/api/v1';

function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const keyId = process.env.LIOGAMES_API_KEY_ID;
  const secret = process.env.LIOGAMES_API_SECRET;
  const memberCode = process.env.LIOGAMES_MEMBER_CODE;
  if (!keyId || !secret || !memberCode) return res.status(500).json({ error: 'LioGames environment variables are not configured' });

  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  let data;
  try { data = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  if (!data.user_id || !data.server_id) {
    return res.status(400).json({ error: 'user_id and server_id are required' });
  }

  const raw = JSON.stringify({
    member_code: memberCode,
    game: 'mobile-legends',
    user_id: String(data.user_id),
    server_id: String(data.server_id)
  });
  const headers = {
    'Content-Type': 'application/json',
    'x-liog-sign': sign(raw, secret),
    'X-LIOG-KEY-ID': keyId
  };

  try {
    const r = await fetch(BASE + '/username-check', { method: 'POST', headers, body: raw });
    const text = await r.text();
    res.status(r.status).send(text);
  } catch (e) {
    res.status(502).json({ error: 'LioGames request failed' });
  }
};
