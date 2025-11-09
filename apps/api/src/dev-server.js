const http = require("http");
const url = require("url");
const seen = new Set();
function problem(res, code, type){res.writeHead(code,{"Content-Type":"application/problem+json"});res.end(JSON.stringify({type}));}
const server = http.createServer((req,res)=>{
  const { pathname, query } = url.parse(req.url, true);
  if(req.method==="POST" && pathname==="/stamps/claim"){
    const idem=req.headers["idempotency-key"]; if(!idem) return problem(res,400,"MISSING_IDEMPOTENCY_KEY");
    if(seen.has(idem)) return problem(res,409,"TOKEN_REUSE");
    seen.add(idem); res.writeHead(201,{"Content-Type":"application/json"}); return res.end(JSON.stringify({ok:true}));
  }
  if(req.method==="GET" && pathname==="/secure/ping"){ return problem(res,401,"DEVICE_PROOF_REQUIRED"); }
  if(req.method==="GET" && pathname==="/referrals/link"){
    const t=query?.tenant||"starter"; if(t==="starter") return problem(res,403,"PLAN_NOT_ALLOWED");
    res.writeHead(200,{"Content-Type":"application/json"}); return res.end(JSON.stringify({url:"https://example"}));
  }
  return problem(res,404,"NOT_FOUND");
});
server.listen(process.env.PORT||3000,()=>console.log("Stub API :3000"));
