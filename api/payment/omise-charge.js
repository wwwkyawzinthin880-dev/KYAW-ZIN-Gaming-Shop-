const OMISE_BASE = 'https://api.omise.co';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok:false, error: 'POST only' });

  const secret = process.env.OMISE_SECRET_KEY;
  if (!secret) return res.status(500).json({ ok:false, error: 'OMISE_SECRET_KEY is not configured' });

  let data = {};
  try { data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); }
  catch { return res.status(400).json({ ok:false, error:'Invalid JSON' }); }

  const amountThb = Number(data.amount_thb ?? data.amount);
  const orderId = String(data.order_id || '');
  const userId = String(data.user_id || '');
  const serverId = String(data.server_id || '');
  const packageName = String(data.package_name || '');
  const returnUri = String(data.return_uri || '');

  if (!Number.isInteger(amountThb) || amountThb <= 0) return res.status(400).json({ ok:false, error:'amount_thb must be a positive integer' });
  if (!orderId || !userId || !serverId || !packageName) return res.status(400).json({ ok:false, error:'order_id, package_name, user_id and server_id are required' });
  if (returnUri && !returnUri.startsWith('https://')) return res.status(400).json({ ok:false, error:'return_uri must use HTTPS' });

  const amount = amountThb * 100;
  const params = new URLSearchParams();
  params.set('amount', String(amount));
  params.set('currency', 'THB');
  params.set('source[type]', 'promptpay');
  if (returnUri) params.set('return_uri', returnUri);
  params.set('description', 'KYAW ZIN Gaming Shop - ' + orderId);
  params.set('metadata[order_id]', orderId);
  params.set('metadata[package_name]', packageName);
  params.set('metadata[user_id]', userId);
  params.set('metadata[server_id]', serverId);

  const auth = Buffer.from(secret + ':').toString('base64');
  try {
    const r = await fetch(OMISE_BASE + '/charges', {
      method:'POST',
      headers:{Authorization:'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded'},
      body:params.toString()
    });
    const raw = await r.text();
    let out = {};
    try { out = JSON.parse(raw); } catch {}
    if (!r.ok) return res.status(r.status).json({ok:false,error:out.message||'Omise charge creation failed',details:out});
    return res.status(200).json({
      ok:true,
      order_id:orderId,
      charge_id:out.id || null,
      status:out.status || null,
      authorize_uri:out.authorize_uri || null,
      amount_thb:amountThb
    });
  } catch {
    return res.status(502).json({ok:false,error:'Omise request failed'});
  }
};
