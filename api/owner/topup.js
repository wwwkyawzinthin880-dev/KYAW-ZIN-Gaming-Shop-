const crypto=require('crypto');
const {put,download,list}=require('@vercel/blob');
const BASE='https://distribution.liogames.com/api/v1';
const KEY='owner-data/orders.json';

function sign(body,secret){return crypto.createHmac('sha256',secret).update(body,'utf8').digest('hex');}
async function readOrders(){
  try{const q=await list({prefix:KEY,limit:1});if(!q.blobs?.length)return [];
    const r=await download(q.blobs[0].url);const d=JSON.parse(await r.text());return Array.isArray(d)?d:[];
  }catch{return []}
}
async function saveOrders(items){await put(KEY,JSON.stringify(items.slice(0,500)),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});}
async function getVariation(productId,packageName){
  const r=await fetch(BASE+'/products/'+encodeURIComponent(productId)+'/variations');
  if(!r.ok)throw new Error('LioGames variations မရပါ');
  const j=await r.json();const rows=Array.isArray(j)?j:(j.data||j.variations||[]);
  const nums=String(packageName||'').match(/\d+/g)||[];const target=nums[0]?Number(nums[0]):null;
  if(!target)throw new Error('Package denomination မတွေ့ပါ');
  const best=rows.find(v=>{
    const vn=Number(v.amount??v.denomination??v.value??v.quantity??NaN);
    const ns=String(v.name??v.title??v.label??'').match(/\d+/g)||[];
    return vn===target||ns.some(n=>Number(n)===target);
  });
  if(!best)throw new Error('LioGames variation မတွေ့ပါ: '+target);
  return {variationId:Number(best.variation_id??best.id??best.variationId),supplierCost:Number(best.price??best.cost??best.sell_price??best.amount_thb??best.retail_price??0)};
}
module.exports=async(req,res)=>{
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST only'});
  const {valid}=require('./_auth');if(!valid(req))return res.status(401).json({ok:false,error:'Unauthorized'});
  const keyId=process.env.LIOGAMES_API_KEY_ID,secret=process.env.LIOGAMES_API_SECRET,memberCode=process.env.LIOGAMES_MEMBER_CODE;
  if(!keyId||!secret||!memberCode)return res.status(500).json({ok:false,error:'LioGames environment variables are not configured'});
  let data={};try{data=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{})}catch{return res.status(400).json({ok:false,error:'Invalid JSON'})}
  const orderId=String(data.order_id||'');if(!orderId)return res.status(400).json({ok:false,error:'order_id is required'});
  const items=await readOrders();const idx=items.findIndex(x=>String(x.id)===orderId);if(idx<0)return res.status(404).json({ok:false,error:'Order not found'});
  const order=items[idx];
  if(order.supplierOrderId||order.status==='Top-up Sent')return res.status(409).json({ok:false,error:'This order was already sent to supplier'});
  if(!['paid','Payment Confirmed','Payment Pending'].includes(String(order.status)))return res.status(400).json({ok:false,error:'Order is not eligible for top-up'});
  if(data.payment_confirmed!==true)return res.status(402).json({ok:false,error:'Confirm payment before top-up'});
  const productId=Number(process.env.LIOGAMES_PRODUCT_ID||65482);
  const v=await getVariation(productId,order.packageName);
  const payload={member_code:memberCode,product_id:productId,variation_id:v.variationId,client_ref:orderId,user_id:String(order.userId),server_id:String(order.serverId)};
  const raw=JSON.stringify(payload);
  try{
    const r=await fetch(BASE+'/order-create',{method:'POST',headers:{'Content-Type':'application/json','x-liog-sign':sign(raw,secret),'X-LIOG-KEY-ID':keyId},body:raw});
    const body=await r.text();let out={};try{out=JSON.parse(body)}catch{}
    if(!r.ok)return res.status(502).json({ok:false,error:'LioGames order failed',details:out||body});
    const supplierOrderId=out.order_id||out.id||out.data?.order_id||out.data?.id||null;
    items[idx]={...order,status:'Top-up Sent',supplierCost:v.supplierCost,supplierOrderId,topupResponse:out,topupAt:new Date().toISOString()};
    await saveOrders(items);
    return res.status(200).json({ok:true,order_id:orderId,supplier_order_id:supplierOrderId,status:'Top-up Sent',supplier_cost:v.supplierCost});
  }catch(e){return res.status(502).json({ok:false,error:'LioGames request failed'});}
};