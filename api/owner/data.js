const {download,list}=require("@vercel/blob");
const {valid}=require("./_auth");

async function readOrders(){
  try{
    const q=await list({prefix:"owner-data/orders.json",limit:1});
    if(!q.blobs?.length)return [];
    const r=await download(q.blobs[0].url);
    const d=JSON.parse(await r.text());
    return Array.isArray(d)?d:[];
  }catch{return []}
}

const COMPLETE=["paid","completed","delivered","top-up sent","top-up completed"];
const isComplete=x=>COMPLETE.includes(String(x.status||"").trim().toLowerCase());

module.exports=async(req,res)=>{
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="GET")return res.status(405).json({ok:false});
  if(!valid(req))return res.status(401).json({ok:false,error:"Unauthorized"});

  const items=await readOrders();
  const today=new Date().toISOString().slice(0,10);
  const completed=items.filter(isComplete);
  const day=completed.filter(x=>String(x.createdAt||"").slice(0,10)===today);
  const pending=items.filter(x=>!isComplete(x)).slice(0,100);

  const thbAll=completed.filter(x=>String(x.currency||"THB").toUpperCase()==="THB");
  const mmkAll=completed.filter(x=>String(x.currency||"").toUpperCase()==="MMK");
  const thbDay=day.filter(x=>String(x.currency||"THB").toUpperCase()==="THB");
  const mmkDay=day.filter(x=>String(x.currency||"").toUpperCase()==="MMK");
  const sum=(arr,k)=>arr.reduce((a,x)=>a+Number(x[k]||0),0);
  const mmkRate=110;

  const thbSales=sum(thbDay,"customerAmount");
  const mmkSales=sum(mmkDay,"customerAmount");
  const thbSupplier=sum(thbDay,"supplierCost");
  const thbFee=sum(thbDay,"paymentFee");
  const thbProfit=thbSales-thbSupplier-thbFee;

  return res.status(200).json({
    ok:true,
    today:{
      sales:thbSales, orders:day.length, supplierCost:thbSupplier,
      paymentFee:thbFee, profit:thbProfit,
      thb:{sales:thbSales,orders:thbDay.length,supplierCost:thbSupplier,paymentFee:thbFee,profit:thbProfit},
      mmk:{sales:mmkSales,orders:mmkDay.length,rate:mmkRate}
    },
    all:{
      orders:completed.length,
      thbSales:sum(thbAll,"customerAmount"),
      mmkSales:sum(mmkAll,"customerAmount"),
      thbSupplier:sum(thbAll,"supplierCost"),
      thbFee:sum(thbAll,"paymentFee"),
      thbProfit:sum(thbAll,"customerAmount")-sum(thbAll,"supplierCost")-sum(thbAll,"paymentFee")
    },
    items:day.slice(0,100),
    history:completed.slice(0,200),
    pending
  });
};