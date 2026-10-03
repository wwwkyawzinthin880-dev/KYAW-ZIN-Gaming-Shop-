const OMISE_BASE = 'https://api.omise.co';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const secret = process.env.OMISE_SECRET_KEY;
  if (!secret) return res.status(500).json({ error: 'OMISE_SECRET_KEY is not configured' });

  const data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const amount = Number(data.amount);
  const source = String(data.source || '');
  const orderId = String(data.order_id || '');
  const memberCode = String(data.member_code || '');
  const productId = Number(data.product_id);
  const userId = String(data.user_id || '');
  const serverId = String(data.server_id || '');

  if (!Number.isInteger(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be a positive integer in satang' });
  if (!source || !orderId || !memberCode || !productId || !userId || !serverId) {
    return res.status(400).json({ error: 'source, order_id, member_code, product_id, user_id and server_id are required' });
  }

  const params = new URLSearchParams();
  params.set('amount', String(amount));
  params.set('currency', 'THB');
  params.set('source', source);
  params.set('description', 'KYAW ZIN Gaming Shop - ' + orderId);
  params.set('metadata[order_id]', orderId);
  params.set('metadata[member_code]', memberCode);
  params.set('metadata[product_id]', String(productId));
  params.set('metadata[user_id]', userId);
  params.set('metadata[server_id]', serverId);
  if (data.variation_id !== undefined && data.variation_id !== null && data.variation_id !== '') {
    params.set('metadata[variation_id]', String(data.variation_id));
  }
  if (data.return_uri) params.set('return_uri', String(data.return_uri));

  const auth = Buffer.from(secret + ':').toString('base64');
  try {
    const r = await fetch(OMISE_BASE + '/charges', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + auth,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    const text = await r.text();
    res.status(r.status).send(text);
  } catch {
    res.status(502).json({ error: 'Omise request failed' });
  }
};
