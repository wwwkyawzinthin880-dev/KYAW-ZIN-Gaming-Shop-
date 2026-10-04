const crypto=require("crypto");
const {TTL,makeToken,valid,setCookie,secret}=require("./_auth");

module.exports=async(req,res)=>{
  if(req.method==="POST"){
    if(!secret()) return res.status(503).json({ok:false,error:"OWNER_LOGIN_SECRET is not configured"});
    let body={};
    try{ body=typeof req.body==="object" && req.body ? req.body : JSON.parse(req.body||"{}"); }catch{}
    const password=String(body.password||"");
    const expected=String(process.env.OWNER_LOGIN_SECRET);
    const a=Buffer.from(password), b=Buffer.from(expected);
    const ok=a.length===b.length && crypto.timingSafeEqual(a,b);
    const html=String(req.headers?.accept||"").includes("text/html");
    if(!ok){
      if(html){
        res.statusCode=401;
        res.setHeader("Content-Type","text/html; charset=utf-8");
        return res.end("<!doctype html><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><body style=\"font-family:system-ui;padding:40px;text-align:center\"><h2>PIN မမှန်ပါ</h2><p>Back နှိပ်ပြီး PIN ပြန်ထည့်ပါ။</p></body>");
      }
      return res.status(401).json({ok:false,error:"PIN မမှန်ပါ"});
    }
    setCookie(res,makeToken(),Math.floor(TTL/1000));
    if(html){
      res.statusCode=303;
      res.setHeader("Location","/owner-app/?login=1");
      return res.end();
    }
    return res.status(200).json({ok:true});
  }
  if(req.method==="GET") return res.status(200).json({ok:valid(req)});
  if(req.method==="DELETE"){setCookie(res,"",0);return res.status(200).json({ok:true});}
  return res.status(405).json({ok:false});
};
