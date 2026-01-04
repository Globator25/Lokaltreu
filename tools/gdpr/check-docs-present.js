const fs = require('fs');

const path = 'docs/compliance/step-18-device-onboarding.md';

if (!fs.existsSync(path)) {
  console.error(`GDPR doc missing: ${path}`);
  process.exit(1);
}

console.log('GDPR docs present');
