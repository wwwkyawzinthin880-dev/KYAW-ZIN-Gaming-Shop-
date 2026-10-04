const crypto = require('crypto');

const LIO_BASE = 'https://distribution.liogames.com/api/v1';
const OMISE_BASE = 'https://api.omise.co';

function safeEqualHex(a, b) {
  try {
    const aa = Buffer.from(String(a || '').trim(), 'hex');
    const bb = Buffer.from(String(b || '').trim(), 'hex');
    return aa.length === bb.length && aa.length > 0 && crypto.timingSafeEqual(aa, bb);
  } catch { return false; }
}

function signLio(body, secret) {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const webhookSecret = process.env.OMISE_WEBHOOK_SECRET;
  const omiseSecret = process.env.OMISE_SECRET_KEY;
  const lioKeyId = process.env.LIOGAMES_API_KEY_ID;
  const lioSecret = process.env.LIOGAMES_API_SECRET;

  if (!webhookSecret || !omiseSecret || !lioKeyId || !lioSecret) {
    return res.status(500).json({ error: 'Payment/LioGames environment variables are not configured' });
  }

  const raw = await readRawBody(req);
  const signatureHeader = req.headers['omise-signature'];
  const timestamp = req.headers['omise-signature-timestamp'];
  if (!signatureHeader || !timestamp) return res.status(401).json({ error: 'Missing webhook signature' });
  const decodedSecret = Buffer.from(webhookSecret, 'base64');
  const expected = crypto.createHmac('sha256', decodedSecret).update(String(timestamp) + '.' + raw, 'utf8').digest('hex');
  const signatures = String(signatureHeader).split(',').map(x => x.trim()).filter(Boolean);
  if (!signatures.some(sig => safeEqualHex(sig, expected))) return res.status(401).json({ error: 'Invalid webhook signature' });

  let event;
  try { event = JSON.parse(raw); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  if (event.key !== 'charge.complete') return res.status(200).json({ received: true, ignored: true });

  const chargeId = event.data && event.data.id;
  if (!chargeId) return res.status(400).json({ error: 'Missing charge id' });

  // Verify the event independently with Omise before fulfilling anything.
  const auth = Buffer.from(omiseSecret + ':').toString('base64');
  const chargeRes = await fetch(OMISE_BASE + '/charges/' + encodeURIComponent(chargeId), {
    headers: { Authorization: 'Basic ' + auth }
  });
  if (!chargeRes.ok) return res.status(502).json({ error: 'Could not verify charge with Omise' });
  const charge = await chargeRes.json();

  if (charge.status !== 'successful' || charge.paid !== true) {
    return res.status(200).json({ received: true, fulfilled: false, status: charge.status });
  }
  if (charge.currency && String(charge.currency).toLowerCase() !== 'thb') {
    return res.status(400).json({ error: 'Unexpected charge currency' });
  }

  const meta = charge.metadata || {};
  const required = ['order_id', 'member_code', 'product_id', 'user_id', 'server_id'];
  for (const field of required) {
    if (!meta[field]) return res.status(400).json({ error: 'Missing order metadata: ' + field });
  }

  const payload = {
    member_code: String(meta.member_code),
    product_id: Number(meta.product_id),
    client_ref: String(meta.order_id),
    user_id: String(meta.user_id),
    server_id: String(meta.server_id),
    payment_verified: true
  };
  if (meta.variation_id !== undefined && meta.variation_id !== '') {
    payload.variation_id = Number(meta.variation_id);
  }

  const lioRaw = JSON.stringify(payload);
  const lioRes = await fetch(LIO_BASE + '/order-create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-liog-sign': signLio(lioRaw, lioSecret),
      'X-LIOG-KEY-ID': lioKeyId
    },
    body: lioRaw
  });
  const lioText = await lioRes.text();

  return res.status(lioRes.ok ? 200 : 502).send(lioText);
};
