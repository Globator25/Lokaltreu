import fs from 'node:fs';
const body = fs.readFileSync(process.env.PR_BODY_FILE || '.github/PULL_REQUEST_TEMPLATE.md','utf8');
const required = ['Coverage ≥ 80 %','schema_drift = 0','RFC 7807','PLAN_NOT_ALLOWED','GDPR-Checks grün'];
const missing = required.filter(k => !body.includes(k));
if (missing.length) { console.error('PR-Checks fehlen:', missing); process.exit(1); }
