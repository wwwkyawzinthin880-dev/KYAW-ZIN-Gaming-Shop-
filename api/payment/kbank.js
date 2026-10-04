const crypto = require('crypto');

const OMISE_BASE = 'https://api.omise.co';
const LIO_BASE = 'https://distribution.liogames.com/api/v1';

function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

async function getVariation(productId, packageName) {
  const r = await fetch(OMISE_BASE.replace('api.omise.co','distribution.liogames.com') + '/api/v1/products/' + encodeURIComponent(productId) + '/variations');
  if (!r.ok) throw new Error('Could not load LioGames variations');
  const j = await r.json();
  const rows = Array.isArray(j) ? j : (j.data || j.variations || []);
  const nums = String(packageName || '').match(/\d+/g) || [];
  const target = nums[0] ? Number(nums[0]) : null;
  if (!target) throw new Error('Could not identify package denomination');
  let best = null;
  for (const v of rows) {
    const text = JSON.stringify(v);
    const vn = Number(v.amount ?? v.denomination ?? v.value ?? v.quantity ?? NaN);
    const name = String(v.name ?? v.title ?? v.label ?? '');
    const nameNums = name.match(/\d+/g) || [];
    const exactName = nameNums.some(n => Number(n) === target);
    const exactValue = vn === target;
    if (exactValue || exactName) {
      best = v;
      break;
    }
  }
  if (!best) throw new Error('No matching LioGames variation for ' + target + ' diamonds');
  const variationId = best.variation_id ?? best.id ?? best.variationId;
  if (!variationId) throw new Error('Variation ID missing');
  return Number(variationId);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const secret = process.env.OMISE_SECRET_KEY;
  const memberCode = process.env.LIOGAMES_MEMBER_CODE;
  if (!secret || !memberCode) return res.status(500).json({ error: 'Payment environment is not configured' });

  const data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const amountThb = Number(data.amount_thb);
  const packageName = String(data.package_name || '');
  const orderId = String(data.order_id || '');
  const userId = String(data.user_id || '');
  const serverId = String(data.server_id || '');
  const productId = Number(data.product_id || 65482);

  if (!Number.isInteger(amountThb) || amountThb < 20) return res.status(400).json({ error: 'Invalid amount' });
  if (!packageName || !orderId || !userId || !serverId) return res.status(400).json({ error: 'package_name, order_id, user_id and server_id are required' });

  let variationId;
  try { variationId = await getVariation(productId, packageName); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  const params = new URLSearchParams();
  params.set('amount', String(amountThb * 100));
  params.set('currency', 'THB');
  params.set('return_uri', String(data.return_uri || 'https://kyaw-zin-gaming-shop.vercel.app/shop.html?payment=return&order=' + encodeURIComponent(orderId)));
  params.set('source[type]', 'mobile_banking_kbank');
  params.set('source[platform_type]', 'WEB');
  params.set('description', 'KYAW ZIN Gaming Shop - ' + orderId);
  params.set('metadata[order_id]', orderId);
  params.set('metadata[member_code]', memberCode);
  params.set('metadata[product_id]', String(productId));
  params.set('metadata[variation_id]', String(variationId));
  params.set('metadata[user_id]', userId);
  params.set('metadata[server_id]', serverId);
  params.set('metadata[package_name]', packageName);

  const auth = Buffer.from(secret + ':').toString('base64');
  try {
    const r = await fetch(OMISE_BASE + '/charges', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    const text = await r.text();
    let out; try { out = JSON.parse(text); } catch { out = { raw: text }; }
    if (!r.ok) return res.status(r.status).json(out);
    return res.status(200).json({
      ok: true,
      order_id: orderId,
      charge_id: out.id,
      status: out.status,
      authorize_uri: out.authorize_uri,
      expires_at: out.expires_at,
      amount_thb: amountThb,
      variation_id: variationId
    });
  } catch {
    return res.status(502).json({ error: 'Omise request failed' });
  }
};
