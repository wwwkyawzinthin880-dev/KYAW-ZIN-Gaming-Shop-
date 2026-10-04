const {put,download,list}=require("@vercel/blob");
const {valid}=require("./_auth");
const KEY="owner-data/orders.json";
async function readOrders(){
 try{const q=await list({prefix:KEY,limit:1}); if(!q.blobs?.length)return []; const r=await download(q.blobs[0].url);const t=await r.text();const d=JSON.parse(t);return Array.isArray(d)?d:[]}
 catch{return []}
}
async function saveOrders(items){
 await put(KEY,JSON.stringify(items),{access:"private",addRandomSuffix:false,allowOverwrite:true,contentType:"application/json"});
}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET"&&req.method!=="POST")return res.status(405).json({ok:false});
 if(!valid(req))return res.status(401).json({ok:false,error:"Unauthorized"});
 if(req.method==="GET"){
  const items=await readOrders(); return res.status(200).json({ok:true,items});
 }
 let body={};try{body=typeof req.body==="object"?req.body:JSON.parse(req.body||"{}")}catch{return res.status(400).json({ok:false,error:"Invalid JSON"})}
 const item={
  id:String(body.id||("KZ"+Date.now())),
  createdAt:body.createdAt||new Date().toISOString(),
  status:String(body.status||"paid"),
  packageName:String(body.packageName||""),
  userId:String(body.userId||""),
  serverId:String(body.serverId||""),
  customerAmount:num(body.customerAmount),
  supplierCost:num(body.supplierCost),
  paymentFee:num(body.paymentFee),
  profit:num(body.profit),
  currency:String(body.currency||"THB"),
  source:String(body.source||"KPLUS")
 };
 const items=await readOrders();
 const idx=items.findIndex(x=>x.id===item.id);
 if(idx>=0)items[idx]={...items[idx],...item}; else items.unshift(item);
 await saveOrders(items.slice(0,500));
 return res.status(200).json({ok:true,item});
};
