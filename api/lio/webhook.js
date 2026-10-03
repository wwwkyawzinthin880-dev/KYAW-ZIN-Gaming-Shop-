const crypto = require('crypto');

/**
 * LioGames webhook receiver.
 *
 * Set this server-side environment variable in the deployment:
 *   LIOGAMES_WEBHOOK_SECRET
 *
 * LioGames webhook payloads are HMAC signed. We verify the raw request
 * body before accepting the event. The endpoint intentionally does NOT
 * expose any API secret to the browser.
 */
function hmac(body, secret) {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

function safeEqual(a, b) {
  if (!a || !b) return false;
  const aa = Buffer.from(String(a).trim(), 'utf8');
  const bb = Buffer.from(String(b).trim(), 'utf8');
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function getSignature(req) {
  return (
    req.headers['x-liog-sign'] ||
    req.headers['x-liog-webhook-signature'] ||
    req.headers['x-liog-signature'] ||
    ''
  );
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'POST only' });
  }

  const secret = process.env.LIOGAMES_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({
      ok: false,
      error: 'LioGames webhook secret is not configured'
    });
  }

  try {
    const rawBody = await readRawBody(req);
    const supplied = getSignature(req);
    const expected = hmac(rawBody, secret);

    // Accept an optional "sha256=" prefix if the panel sends it.
    const normalized = String(supplied).replace(/^sha256=/i, '').trim();
    if (!safeEqual(normalized, expected)) {
      return res.status(401).json({ ok: false, error: 'Invalid webhook signature' });
    }

    let event;
    try {
      event = JSON.parse(rawBody || '{}');
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON payload' });
    }

    // Keep the response small and never echo secrets/signatures.
    const orderId =
      event.order_id ??
      event.orderId ??
      event.data?.order_id ??
      event.data?.orderId ??
      null;

    const status =
      event.status ??
      event.order_status ??
      event.data?.status ??
      event.data?.order_status ??
      null;

    console.log('LioGames webhook received', {
      order_id: orderId,
      status,
      event: event.event || event.type || null
    });

    return res.status(200).json({
      ok: true,
      received: true,
      order_id: orderId,
      status
    });
  } catch (err) {
    console.error('LioGames webhook error', err);
    return res.status(500).json({ ok: false, error: 'Webhook processing failed' });
  }
};

// Vercel: preserve the raw request body so HMAC verification is possible.
module.exports.config = {
  api: {
    bodyParser: false
  }
};
