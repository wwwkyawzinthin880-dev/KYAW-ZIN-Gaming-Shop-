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

  const data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  // Safety gate: the payment gateway/webhook must verify payment before this endpoint is used.
  if (data.payment_verified !== true) {
    return res.status(402).json({ error: 'Payment must be verified before creating a top-up order' });
  }

  for (const field of ['product_id', 'user_id', 'server_id', 'client_ref']) {
    if (!data[field]) return res.status(400).json({ error: field + ' is required' });
  }

  const payload = {
    member_code: memberCode,
    product_id: Number(data.product_id),
    client_ref: String(data.client_ref),
    user_id: String(data.user_id),
    server_id: String(data.server_id)
  };
  if (data.variation_id !== undefined && data.variation_id !== null) payload.variation_id = Number(data.variation_id);

  const raw = JSON.stringify(payload);
  try {
    const r = await fetch(BASE + '/order-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-liog-sign': sign(raw, secret),
        'X-LIOG-KEY-ID': keyId
      },
      body: raw
    });
    const text = await r.text();
    res.status(r.status).send(text);
  } catch {
    res.status(502).json({ error: 'LioGames request failed' });
  }
};
