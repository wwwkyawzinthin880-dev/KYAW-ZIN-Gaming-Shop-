const crypto=require("crypto");
const COOKIE="kz_owner_session";
const TTL=8*60*60*1000;
function secret(){return process.env.OWNER_LOGIN_SECRET||""}
function sig(payload){return crypto.createHmac("sha256",secret()).update(payload).digest("base64url")}
function makeToken(){const p=Buffer.from(JSON.stringify({exp:Date.now()+TTL})).toString("base64url");return p+"."+sig(p)}
function valid(req){const h=req.headers.cookie||"";const m=h.match(new RegExp(COOKIE+"=([^;]+)"));if(!m||!secret())return false;const [p,s]=m[1].split(".");if(!p||!s||sig(p)!==s)return false;try{return JSON.parse(Buffer.from(p,"base64url").toString()).exp>Date.now()}catch{return false}}
function setCookie(res,v,maxAge){res.setHeader("Set-Cookie",COOKIE+"="+v+"; Path=/; Max-Age="+maxAge+"; HttpOnly; Secure; SameSite=Strict")}
module.exports=async(req,res)=>{
 if(req.method==="POST"){
  if(!secret())return res.status(503).json({ok:false,error:"OWNER_LOGIN_SECRET is not configured"});
  let body={};try{body=typeof req.body==="object"?req.body:JSON.parse(req.body||"{}")}catch{}
  const password=String(body.password||"");
  const expected=String(process.env.OWNER_LOGIN_SECRET);
  const a=Buffer.from(password),b=Buffer.from(expected);
  const ok=a.length===b.length&&crypto.timingSafeEqual(a,b);
  if(!ok)return res.status(401).json({ok:false,error:"PIN မမှန်ပါ"});
  setCookie(res,makeToken(),Math.floor(TTL/1000));return res.status(200).json({ok:true});
 }
 if(req.method==="GET")return res.status(200).json({ok:valid(req)});
 if(req.method==="DELETE"){setCookie(res,"",0);return res.status(200).json({ok:true});}
 return res.status(405).json({ok:false});
};