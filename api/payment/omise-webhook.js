const crypto=require('crypto');
const LIO='https://distribution.liogames.com/api/v1';
const OMISE='https://api.omise.co';
const {put,download,list}=require('@vercel/blob');
const sign=(s,k)=>crypto.createHmac('sha256',k).update(s,'utf8').digest('hex');
async function orders(){try{const q=await list({prefix:'owner-data/orders.json',limit:1});if(!q.blobs?.length)return[];const r=await download(q.blobs[0].url);const x=JSON.parse(await r.text());return Array.isArray(x)?x:[]}catch{return[]}}
async function save(x){await put('owner-data/orders.json',JSON.stringify(x.slice(0,500)),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'})}
async function variation(pid,name){const r=await fetch(LIO+'/products/'+pid+'/variations');if(!r.ok)throw Error('LioGames variations unavailable');const j=await r.json(),a=Array.isArray(j)?j:(j.data||j.variations||[]),n=(String(name).match(/\d+/)||[])[0];const v=a.find(x=>Number(x.amount??x.denomination??x.value??x.quantity)===Number(n)||(String(x.name??x.title??'').match(/\d+/g)||[]).some(z=>Number(z)===Number(n)));if(!v)throw Error('LioGames variation not found');return{variationId:Number(v.variation_id??v.id),supplierCost:Number(v.price??v.cost??0)}}
module.exports=async(req,res)=>{
 if(req.method!=='POST')return res.status(405).json({error:'POST only'});
 const omise=process.env.OMISE_SECRET_KEY,lio=process.env.LIOGAMES_SECRET_KEY,member=process.env.LIOGAMES_MEMBER_CODE;
 if(!omise||!lio||!member)return res.status(500).json({error:'Payment/LioGames environment variables are not configured'});
 let body=typeof req.body==='string'?req.body:JSON.stringify(req.body||{}),event;try{event=JSON.parse(body)}catch{return res.status(400).json({error:'Invalid JSON'})}
 if(event.key!=='charge.complete')return res.status(200).json({received:true,ignored:true});
 const id=event.data?.id;if(!id)return res.status(400).json({error:'Missing charge id'});
 const auth=Buffer.from(omise+':').toString('base64'),cr=await fetch(OMISE+'/charges/'+encodeURIComponent(id),{headers:{Authorization:'Basic '+auth}});
 if(!cr.ok)return res.status(502).json({error:'Could not verify charge'});
 const charge=await cr.json();if(charge.status!=='successful'||charge.paid!==true)return res.status(200).json({received:true,fulfilled:false,status:charge.status});
 const m=charge.metadata||{},oid=String(m.order_id||''),uid=String(m.user_id||''),sid=String(m.server_id||''),pkg=String(m.package_name||'');
 if(!oid||!uid||!sid||!pkg)return res.status(400).json({error:'Missing order metadata'});
 const old=await orders(),found=old.find(x=>String(x.id)===oid);if(found?.supplierOrderId)return res.status(200).json({received:true,fulfilled:true,duplicate:true});
 let v;try{v=await variation(Number(process.env.LIOGAMES_PRODUCT_ID||65482),pkg)}catch(e){return res.status(502).json({error:e.message})}
 const payload={member_code:member,product_id:Number(process.env.LIOGAMES_PRODUCT_ID||65482),variation_id:v.variationId,client_ref:oid,user_id:uid,server_id:sid},raw=JSON.stringify(payload);
 const lr=await fetch(LIO+'/order-create',{method:'POST',headers:{'Content-Type':'application/json','x-liog-sign':sign(raw,lio)},body:raw}),txt=await lr.text();let out={};try{out=JSON.parse(txt)}catch{}
 if(!lr.ok)return res.status(502).json({error:'LioGames order failed',details:out});
 const supplierOrderId=out.order_id||out.id||out.data?.order_id||out.data?.id,amount=Number(charge.amount||0)/100,fee=Number(charge.fee||0)/100;
 const order={...(found||{}),id:oid,createdAt:found?.createdAt||new Date().toISOString(),status:'Top-up Sent',packageName:pkg,userId:uid,serverId:sid,customerAmount:amount,supplierCost:v.supplierCost,paymentFee:fee,profit:amount-v.supplierCost-fee,currency:'THB',supplierOrderId,chargeId:id,topupResponse:out,topupAt:new Date().toISOString()};
 const idx=old.findIndex(x=>String(x.id)===oid);if(idx>=0)old[idx]=order;else old.unshift(order);await save(old);
 return res.status(200).json({received:true,fulfilled:true,order_id:oid,supplier_order_id:supplierOrderId,status:'Top-up Sent'});
};