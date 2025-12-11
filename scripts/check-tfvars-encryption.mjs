#!/usr/bin/env node
/**
 * Ensures no plain *.tfvars files under infra/terraform are tracked.
 * Only *.enc.tfvars are allowed to reach the repo per SOPS policy.
 */
import { spawnSync } from 'node:child_process';

const gitList = spawnSync('git', ['ls-files', '--', 'infra/terraform/**/*.tfvars'], {
  encoding: 'utf8'
});

if (gitList.status !== 0) {
  console.error('[sops-guard] git ls-files failed:', gitList.stderr.trim());
  process.exit(gitList.status ?? 1);
}

const files = gitList.stdout
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const sensitiveRegex = /(backend|secrets)\.tfvars$/;
const offenders = files.filter((file) => {
  if (!sensitiveRegex.test(file)) {
    return false;
  }
  return !file.endsWith('.enc.tfvars');
});

if (offenders.length > 0) {
  console.error('[sops-guard] Plaintext tfvars detected:');
  offenders.forEach((file) => console.error(` - ${file}`));
  console.error('[sops-guard] Encrypt these files with sops/age before committing.');
  process.exit(1);
}

console.log('[sops-guard] OK – no plaintext tfvars tracked.');
