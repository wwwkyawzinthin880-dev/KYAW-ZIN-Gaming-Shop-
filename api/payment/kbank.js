const OMISE_BASE='https://api.omise.co';
const LIO_BASE='https://distribution.liogames.com/api/v1';

async function getVariation(productId,packageName){
  const r=await fetch(LIO_BASE+'/products/'+encodeURIComponent(productId)+'/variations');
  if(!r.ok) throw new Error('Could not load LioGames variations');
  const j=await r.json();
  const rows=Array.isArray(j)?j:(j.data||j.variations||[]);
  const nums=String(packageName||'').match(/\d+/g)||[];
  const target=nums[0]?Number(nums[0]):null;
  if(!target) throw new Error('Could not identify package denomination');
  const best=rows.find(v=>{
    const vn=Number(v.amount??v.denomination??v.value??v.quantity??NaN);
    const nameNums=String(v.name??v.title??v.label??'').match(/\d+/g)||[];
    return vn===target || nameNums.some(n=>Number(n)===target);
  });
  if(!best) throw new Error('No matching LioGames variation for '+target+' diamonds');
  const variationId=best.variation_id??best.id??best.variationId;
  const supplierCost=Number(best.price??best.cost??best.sell_price??best.amount_thb??best.retail_price??0);
  if(!variationId) throw new Error('Variation ID missing');
  return {variationId:Number(variationId),supplierCost:Number.isFinite(supplierCost)?supplierCost:0};
}

module.exports=async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','https://wwwkyawzinthin880-dev.github.io');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if(req.method==='OPTIONS')return res.status(204).end();
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const secret=process.env.OMISE_SECRET_KEY, memberCode=process.env.LIOGAMES_MEMBER_CODE;
  if(!secret||!memberCode)return res.status(500).json({error:'Payment environment is not configured'});
  let data={}; try{data=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{})}catch{return res.status(400).json({error:'Invalid JSON'})}
  const requestedAmount=Number(data.amount_thb), packageName=String(data.package_name||''), orderId=String(data.order_id||''), userId=String(data.user_id||''), serverId=String(data.server_id||'');
  const productId=65482;
  const priceMap={55:35,86:46,165:85,172:90,257:125,275:135,344:175,447:220,514:247,565:270,620:300,706:330,730:355,822:395,981:465,1130:540,1271:600,1412:660,2195:995,3688:1670,5532:2500,9288:4150};
  const m=packageName.match(/^Dia\s+(\d+)/i);
  if(!m||!priceMap[Number(m[1])])return res.status(400).json({error:'K PLUS auto-payment is currently enabled for Diamond packages only'});
  const amountThb=priceMap[Number(m[1])];
  if(requestedAmount!==amountThb)return res.status(400).json({error:'Price mismatch'});
  if(!packageName||!orderId||!userId||!serverId)return res.status(400).json({error:'package_name, order_id, user_id and server_id are required'});
  let variation;
  try{variation=await getVariation(productId,packageName)}catch(e){return res.status(400).json({error:e.message})}
  const params=new URLSearchParams();
  params.set('amount',String(amountThb*100)); params.set('currency','THB');
  params.set('return_uri',String(data.return_uri||'https://kyaw-zin-gaming-shop-vp14.vercel.app/shop.html?payment=return&order='+encodeURIComponent(orderId)));
  params.set('source[type]','mobile_banking_kbank'); params.set('source[platform_type]','WEB');
  params.set('webhook_endpoints[0]',String(process.env.PUBLIC_BASE_URL||'https://kyaw-zin-gaming-shop-vp14.vercel.app')+'/api/payment/omise-webhook');
  params.set('description','KYAW ZIN Gaming Shop - '+orderId);
  params.set('metadata[order_id]',orderId); params.set('metadata[member_code]',memberCode); params.set('metadata[product_id]',String(productId));
  params.set('metadata[variation_id]',String(variation.variationId)); params.set('metadata[supplier_cost]',String(variation.supplierCost));
  params.set('metadata[user_id]',userId); params.set('metadata[server_id]',serverId); params.set('metadata[package_name]',packageName);
  const auth=Buffer.from(secret+':').toString('base64');
  try{
    const r=await fetch(OMISE_BASE+'/charges',{method:'POST',headers:{Authorization:'Basic '+auth,'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()});
    const out=await r.json().catch(()=>({}));
    if(!r.ok)return res.status(r.status).json(out);
    return res.status(200).json({ok:true,order_id:orderId,charge_id:out.id,status:out.status,authorize_uri:out.authorize_uri,expires_at:out.expires_at,amount_thb:amountThb,variation_id:variation.variationId,supplier_cost:variation.supplierCost});
  }catch{return res.status(502).json({error:'Omise request failed'})}
};