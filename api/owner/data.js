const {download,list}=require("@vercel/blob");
const {valid}=require("./_auth");
async function readOrders(){
 try{const q=await list({prefix:"owner-data/orders.json",limit:1}); if(!q.blobs?.length)return []; const r=await download(q.blobs[0].url);const d=JSON.parse(await r.text());return Array.isArray(d)?d:[]}
 catch{return []}
}
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET")return res.status(405).json({ok:false});
 if(!valid(req))return res.status(401).json({ok:false,error:"Unauthorized"});
 const items=await readOrders();
 const today=new Date().toISOString().slice(0,10);
 const day=items.filter(x=>String(x.createdAt||"").slice(0,10)===today && ['paid','completed','delivered','top-up sent','top-up completed'].includes(String(x.status||'').toLowerCase()));
 const pending=items.filter(x=>!['paid','completed','delivered','top-up sent','top-up completed'].includes(String(x.status||'').toLowerCase())).slice(0,50);
 const thb=day.filter(x=>String(x.currency||'THB')==='THB');
 const mmk=day.filter(x=>String(x.currency||'')==='MMK');
 const sum=(arr,k)=>arr.reduce((a,x)=>a+Number(x[k]||0),0);
 const mmkRate=110;
 const thbSales=sum(thb,'customerAmount'), mmkSales=sum(mmk,'customerAmount');
 const thbSupplier=sum(thb,'supplierCost'), thbFee=sum(thb,'paymentFee');
 const thbProfit=thbSales-thbSupplier-thbFee;
 return res.status(200).json({
  ok:true,sales:thbSales,orders:day.length,supplierCost:thbSupplier,
  paymentFee:thbFee,profit:thbProfit,
  thb:{sales:thbSales,orders:thb.length,supplierCost:thbSupplier,paymentFee:thbFee,profit:thbProfit},
  mmk:{sales:mmkSales,orders:mmk.length,rate:mmkRate},
  items:day.slice(0,50),pending
 });
};
