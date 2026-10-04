const {download}=require("@vercel/blob");
const {valid}=require("./_auth");
async function readOrders(){
 try{const r=await download("owner-data/orders.json");const d=JSON.parse(await r.text());return Array.isArray(d)?d:[]}
 catch{return []}
}
module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET")return res.status(405).json({ok:false});
 if(!valid(req))return res.status(401).json({ok:false,error:"Unauthorized"});
 const items=await readOrders();
 const today=new Date().toISOString().slice(0,10);
 const day=items.filter(x=>String(x.createdAt||"").slice(0,10)===today);
 const sum=k=>day.reduce((a,x)=>a+Number(x[k]||0),0);
 return res.status(200).json({
  ok:true,sales:sum("customerAmount"),orders:day.length,supplierCost:sum("supplierCost"),
  paymentFee:sum("paymentFee"),profit:sum("profit"),items:day.slice(0,50)
 });
};
