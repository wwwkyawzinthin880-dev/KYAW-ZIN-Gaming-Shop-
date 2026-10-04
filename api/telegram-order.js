const TELEGRAM_BASE = 'https://api.telegram.org';

function json(res,status,data){return res.status(status).json(data);}

module.exports = async (req,res)=>{
  if(req.method!=='POST') return json(res,405,{error:'POST only'});
  const token=process.env.TELEGRAM_BOT_TOKEN;
  const chatId=process.env.TELEGRAM_ADMIN_CHAT_ID;
  if(!token||!chatId) return json(res,500,{error:'Telegram environment variables are not configured'});
  let data;
  try{ data=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{}); }catch{return json(res,400,{error:'Invalid JSON'});}
  const {order_text, file_name, file_type, file_base64, owner_order}=data;
  if(!order_text||!file_base64) return json(res,400,{error:'order_text and slip image are required'});
  if(!String(file_type||'').startsWith('image/')) return json(res,400,{error:'Slip must be an image'});
  try{
    const buffer=Buffer.from(String(file_base64),'base64');
    if(buffer.length>8*1024*1024) return json(res,413,{error:'Slip image is too large (max 8MB)'});
    const caption=String(order_text).slice(0,1000);
    const form=new FormData();
    form.append('chat_id',String(chatId));
    form.append('caption',caption);
    form.append('photo',new Blob([buffer],{type:String(file_type)}),String(file_name||'slip.jpg'));
    const r=await fetch(TELEGRAM_BASE+'/bot'+token+'/sendPhoto',{method:'POST',body:form});
    const out=await r.json().catch(()=>({}));
    if(!r.ok||!out.ok) return json(res,502,{error:'Telegram send failed'});
    if(owner_order && String(owner_order.currency||'')==='MMK'){
      try{
        const {put,list,download}=require('@vercel/blob');
        const key='owner-data/orders.json';
        let items=[];
        const q=await list({prefix:key,limit:1});
        if(q.blobs?.length){const rr=await download(q.blobs[0].url);items=JSON.parse(await rr.text());if(!Array.isArray(items))items=[];}
        const o={id:String(owner_order.id||('KZ'+Date.now())),createdAt:new Date().toISOString(),status:'Payment Pending',packageName:String(owner_order.packageName||''),userId:String(owner_order.uid||''),serverId:String(owner_order.zone||''),customerAmount:Number(owner_order.amountMMK||0),supplierCost:0,paymentFee:0,profit:0,currency:'MMK',source:'WavePay',playerName:String(owner_order.playerName||''),slipFile:String(file_name||'')};
        const idx=items.findIndex(x=>x.id===o.id);if(idx>=0)items[idx]={...items[idx],...o};else items.unshift(o);
        await put(key,JSON.stringify(items.slice(0,500)),{access:'private',addRandomSuffix:false,allowOverwrite:true,contentType:'application/json'});
      }catch(e){}
    }
    return json(res,200,{ok:true,message_id:out.result?.message_id||null});
  }catch(e){return json(res,502,{error:'Telegram request failed'});}
};
