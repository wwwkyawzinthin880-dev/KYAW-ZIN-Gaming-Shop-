const crypto=require("crypto");
const COOKIE="kz_owner_session";
const TTL=8*60*60*1000;
function secret(){return process.env.OWNER_LOGIN_SECRET||""}
function sig(payload){return crypto.createHmac("sha256",secret()).update(payload).digest("base64url")}
function makeToken(){const p=Buffer.from(JSON.stringify({exp:Date.now()+TTL})).toString("base64url");return p+"."+sig(p)}
function valid(req){
 const h=req.headers.cookie||""; const m=h.match(new RegExp(COOKIE+"=([^;]+)"));
 if(!m||!secret())return false;
 const [p,s]=m[1].split("."); if(!p||!s)return false;
 const a=Buffer.from(s),b=Buffer.from(sig(p)); if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;
 try{return JSON.parse(Buffer.from(p,"base64url").toString()).exp>Date.now()}catch{return false}
}
function setCookie(res,v,maxAge){res.setHeader("Set-Cookie",COOKIE+"="+v+"; Path=/; Max-Age="+maxAge+"; HttpOnly; Secure; SameSite=Strict")}
module.exports={TTL,makeToken,valid,setCookie,secret};
