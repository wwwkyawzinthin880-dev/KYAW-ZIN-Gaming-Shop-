module.exports=async(req,res)=>{
 res.setHeader("Cache-Control","no-store");
 if(req.method!=="GET")return res.status(405).json({ok:false});
 const c=req.headers.cookie||"";
 if(!c.includes("kz_owner_session="))return res.status(401).json({ok:false,error:"Unauthorized"});
 // Order database integration will plug into this protected endpoint.
 return res.status(200).json({ok:true,sales:0,orders:0,supplierCost:0,paymentFee:0,profit:0,items:[]});
};