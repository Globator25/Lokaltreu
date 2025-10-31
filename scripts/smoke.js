import fs from 'node:fs';
const logdir = 'artifacts/smoke'; fs.mkdirSync(logdir,{recursive:true});
const r1 = await fetch('http://localhost:4010/stamps/tokens',{method:'POST',headers:{'Idempotency-Key':'a'}});
const r2 = await fetch('http://localhost:4010/stamps/claim',{method:'POST',headers:{'Idempotency-Key':'b'},body:JSON.stringify({qrToken:'t'})});
const r3 = await fetch('http://localhost:4010/referrals/link');
fs.writeFileSync(`${logdir}/smoke.log`, JSON.stringify({r1:r1.status,r2:r2.status,r3:r3.status},null,2));
if (!(r1.status===201 && r2.status===201 && r3.status===403)) process.exit(1);
