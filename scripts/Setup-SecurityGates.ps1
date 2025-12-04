#requires -Version 7.0
[CmdletBinding()]
param(
    [switch]$SkipValidation
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Info "Creating directory: $Path"
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Set-LfContentIfChanged {
    param(
        [string]$Path,
        [string]$Content
    )

    $normalized = ($Content -replace "`r?`n", "`n")
    if (-not $normalized.EndsWith("`n")) {
        $normalized += "`n"
    }
    $encoding = New-Object System.Text.UTF8Encoding($false)
    if (Test-Path -LiteralPath $Path) {
        $existing = [System.IO.File]::ReadAllText($Path)
        $existingNormalized = ($existing -replace "`r?`n", "`n")
        if ($existingNormalized -eq $normalized) {
            Write-Info "Unchanged: $Path"
            return $false
        }
    }
    else {
        $parent = Split-Path -Path $Path -Parent
        if ($parent) {
            Ensure-Directory -Path $parent
        }
    }
    [System.IO.File]::WriteAllText($Path, $normalized, $encoding)
    Write-Info "Updated: $Path"
    return $true
}

function Update-PackageScripts {
    param(
        [string]$PackagePath,
        [hashtable]$ScriptMap
    )

    $package = Get-Content -LiteralPath $PackagePath -Raw | ConvertFrom-Json
    if (-not $package.scripts) {
        $package | Add-Member -MemberType NoteProperty -Name scripts -Value (@{})
    }
    $modified = $false
    foreach ($entry in $ScriptMap.GetEnumerator()) {
        $current = $package.scripts."$($entry.Key)"
        if ($null -eq $current -or $current -ne $entry.Value) {
            $package.scripts | Add-Member -MemberType NoteProperty -Name $entry.Key -Value $entry.Value -Force
            Write-Info "Set npm script '$($entry.Key)'"
            $modified = $true
        }
    }
    if ($modified) {
        $json = $package | ConvertTo-Json -Depth 10
        Set-LfContentIfChanged -Path $PackagePath -Content $json | Out-Null
    }
    return $modified
}

function Test-ApiHealth {
    param([string]$Uri)
    try {
        $response = Invoke-WebRequest -Uri $Uri -Method Get -TimeoutSec 3 -UseBasicParsing
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

function Wait-ForApi {
    param(
        [string]$Uri,
        [int]$TimeoutSeconds = 60
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-ApiHealth -Uri $Uri) {
            return $true
        }
        Start-Sleep -Seconds 1
    }
    return $false
}

function Start-LocalApi {
    param([string]$RepoRoot)
    $logPath = Join-Path $RepoRoot "security-api.log"
    if (Test-Path -LiteralPath $logPath) {
        Remove-Item -LiteralPath $logPath -Force
    }
    $process = Start-Process -FilePath "node" -ArgumentList @("apps/api/src/dev-server.js", "--port=4010", "--profile=test") -WorkingDirectory $RepoRoot -PassThru -RedirectStandardOutput $logPath -RedirectStandardError $logPath
    Write-Info "Started dev API (PID $($process.Id)) -> $logPath"
    return @{ Process = $process; LogPath = $logPath }
}

function Stop-LocalApi {
    param($Handle)
    if ($null -eq $Handle) {
        return
    }
    $process = $Handle.Process
    if ($process -and -not $process.HasExited) {
        Write-Info "Stopping dev API (PID $($process.Id))"
        try {
            Stop-Process -Id $process.Id -Force -ErrorAction Stop
        }
        catch {
            Write-Warn "Unable to stop API process: $($_.Exception.Message)"
        }
    }
}

function Invoke-NpmScript {
    param(
        [string]$RepoRoot,
        [string]$ScriptName
    )

    Push-Location $RepoRoot
    try {
        & npm run $ScriptName
        if ($LASTEXITCODE -ne 0) {
            throw "npm run $ScriptName failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot ".."))
$repoRootPath = $repoRoot.ProviderPath
$securityDir = Join-Path $repoRootPath "scripts/security"
Ensure-Directory -Path $securityDir
Ensure-Directory -Path (Join-Path $repoRootPath ".github/workflows")

[System.Collections.Generic.List[string]]$filesChanged = @()
function Add-ChangedFile {
    param([string]$Path)
    $resolved = Resolve-Path -LiteralPath $Path -ErrorAction Stop
    $relative = [System.IO.Path]::GetRelativePath($repoRootPath, $resolved.ProviderPath)
    $filesChanged.Add($relative)
}

$antiReplayPath = Join-Path $securityDir "anti-replay.mjs"
$antiReplayContent = @'
#!/usr/bin/env node

import { randomUUID } from 'node:crypto';

const API_BASE = (process.env.API_BASE ?? 'http://localhost:4010').replace(/\/$/, '');
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? process.env.STARTER_TOKEN ?? '';
const REQUESTS = 10;
const endpoint = new URL('/stamps/claim', API_BASE).toString();
const idemKey = process.env.TEST_IDEMPOTENCY_KEY ?? randomUUID();
const body = JSON.stringify({ source: 'security-gates' });

function toBearer(token) {
  if (!token) {
    return null;
  }
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

const AUTH_HEADER = toBearer(AUTH_TOKEN);

function headers() {
  const next = {
    'Content-Type': 'application/json',
    'Idempotency-Key': idemKey,
  };
  if (AUTH_HEADER) {
    next.Authorization = AUTH_HEADER;
  }
  return next;
}

async function fire(index) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers(),
      body,
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    let json;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch (error) {
        json = { parseError: error.message, raw: text };
      }
    }
    return { index, status: response.status, json };
  } catch (error) {
    return { index, error };
  }
}

async function main() {
  console.log(`[anti-replay] Target ${endpoint} using key ${idemKey}`);
  const results = await Promise.all(Array.from({ length: REQUESTS }, (_, idx) => fire(idx)));
  const failures = results.filter((entry) => entry.error);
  if (failures.length > 0) {
    failures.forEach((failure) => console.error(`[anti-replay] Request #${failure.index} failed: ${failure.error.message}`));
    throw new Error('Some requests failed before receiving a response');
  }
  const created = results.filter((entry) => entry.status === 201);
  const conflicts = results.filter((entry) => entry.status === 409);
  if (created.length !== 1) {
    throw new Error(`Expected exactly one 201 but received ${created.length}`);
  }
  if (conflicts.length !== REQUESTS - 1) {
    throw new Error(`Expected ${REQUESTS - 1} conflicts but received ${conflicts.length}`);
  }
  if (created[0].json?.ok !== true) {
    throw new Error(`Unexpected body for 201 response: ${JSON.stringify(created[0].json)}`);
  }
  const invalidConflicts = conflicts.filter((entry) => (entry.json?.type ?? '') !== 'TOKEN_REUSE');
  if (invalidConflicts.length > 0) {
    throw new Error('One or more conflict responses were missing the TOKEN_REUSE type');
  }
  console.log('[anti-replay] Passed with 1x201 and 9x409 TOKEN_REUSE responses');
}

main().catch((error) => {
  console.error('[anti-replay] FAILED', error.message);
  process.exitCode = 1;
});
'@
if (Set-LfContentIfChanged -Path $antiReplayPath -Content $antiReplayContent) { Add-ChangedFile -Path $antiReplayPath }

$deviceProofPath = Join-Path $securityDir "device-proof.mjs"
$deviceProofContent = @'
#!/usr/bin/env node

import { createPrivateKey, randomUUID, sign } from 'node:crypto';

const API_BASE = (process.env.API_BASE ?? 'http://localhost:4010').replace(/\/$/, '');
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';
const DEVICE_ID = process.env.DEVICE_ID ?? 'demo-device';
const DEFAULT_DER_PRIV = 'MC4CAQAwBQYDK2VwBCIEIDLcTpPhxvJ7x+ad/q3N7PIqblgwgtcoW5sfaUmVgNND';
const endpointPath = '/secure-device';
const endpoint = new URL(endpointPath, API_BASE).toString();

function toBearer(token) {
  if (!token) {
    return null;
  }
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

const AUTH_HEADER = toBearer(AUTH_TOKEN);

function loadSigningKey() {
  const source = process.env.DP_PRIV ?? DEFAULT_DER_PRIV;
  try {
    return createPrivateKey({ key: Buffer.from(source, 'base64'), format: 'der', type: 'pkcs8' });
  } catch (error) {
    throw new Error(`Unable to load DP_PRIV: ${error.message}`);
  }
}

const signingKey = loadSigningKey();

async function send(headers) {
  const merged = { ...headers };
  if (AUTH_HEADER && !merged.Authorization) {
    merged.Authorization = AUTH_HEADER;
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: merged,
      body: JSON.stringify({ check: 'device-proof' }),
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    let json;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch (error) {
        json = { parseError: error.message, raw: text };
      }
    }
    return { status: response.status, json };
  } catch (error) {
    throw new Error(`Network error: ${error.message}`);
  }
}

function buildProofHeaders(timestamp = Date.now()) {
  const jti = randomUUID();
  const payload = Buffer.from(`POST|${endpointPath}|${timestamp}|${jti}`);
  const signature = sign(null, payload, signingKey).toString('base64');
  return {
    'Content-Type': 'application/json',
    'X-Device-Id': DEVICE_ID,
    'X-Device-Timestamp': String(timestamp),
    'X-Device-Jti': jti,
    'X-Device-Proof': signature,
  };
}

async function expectProblem(label, headers, expectedStatus, expectedType) {
  const result = await send(headers);
  if (result.status !== expectedStatus) {
    throw new Error(`${label}: expected status ${expectedStatus} but received ${result.status}`);
  }
  const actualType = result.json?.type ?? 'UNKNOWN';
  if (expectedType && actualType !== expectedType) {
    throw new Error(`${label}: expected type ${expectedType} but received ${actualType}`);
  }
  console.log(`[device-proof] ${label} -> ${result.status} (${actualType})`);
}

async function expectSuccess(label, headers) {
  const result = await send(headers);
  if (result.status !== 200) {
    const type = result.json?.type ?? 'UNKNOWN';
    throw new Error(`${label}: expected 200 but received ${result.status} (${type})`);
  }
  if (result.json?.ok !== true) {
    throw new Error(`${label}: response missing ok:true flag`);
  }
  console.log(`[device-proof] ${label} -> 200 OK`);
}

async function main() {
  console.log(`[device-proof] Target ${endpoint} using device ${DEVICE_ID}`);
  await expectProblem('missing proof', { 'Content-Type': 'application/json' }, 401, 'DEVICE_PROOF_REQUIRED');
  const past = Date.now() - 120000;
  await expectProblem('stale timestamp', buildProofHeaders(past), 403, 'DEVICE_PROOF_INVALID_TIME');
  await expectSuccess('valid proof', buildProofHeaders());
}

main().catch((error) => {
  console.error('[device-proof] FAILED', error.message);
  process.exitCode = 1;
});
'@
if (Set-LfContentIfChanged -Path $deviceProofPath -Content $deviceProofContent) { Add-ChangedFile -Path $deviceProofPath }

$planGatePath = Join-Path $securityDir "plan-gate.mjs"
$planGateContent = @'
#!/usr/bin/env node

const API_BASE = (process.env.API_BASE ?? 'http://localhost:4010').replace(/\/$/, '');
const AUTH_TOKEN = process.env.AUTH_TOKEN ?? '';
const STARTER_TOKEN = process.env.STARTER_TOKEN ?? '';
const endpointPath = '/referrals/link';

function toBearer(token) {
  if (!token) {
    return null;
  }
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
}

const defaultAuth = toBearer(AUTH_TOKEN) ?? toBearer(STARTER_TOKEN);

async function fetchTenant(tenant) {
  const url = new URL(endpointPath, API_BASE);
  if (tenant) {
    url.searchParams.set('tenant', tenant);
  }
  const headers = { 'Content-Type': 'application/json' };
  if (tenant === 'starter' && toBearer(STARTER_TOKEN)) {
    headers.Authorization = toBearer(STARTER_TOKEN);
  } else if (defaultAuth) {
    headers.Authorization = defaultAuth;
  }
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    let json;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch (error) {
        json = { parseError: error.message, raw: text };
      }
    }
    return { status: response.status, json };
  } catch (error) {
    throw new Error(`Failed to call ${url.toString()}: ${error.message}`);
  }
}

async function main() {
  console.log(`[plan-gate] Target ${new URL(endpointPath, API_BASE).toString()}`);
  const starter = await fetchTenant('starter');
  if (starter.status !== 403 || (starter.json?.type ?? '') !== 'PLAN_NOT_ALLOWED') {
    throw new Error(`Starter expected 403 PLAN_NOT_ALLOWED but received ${starter.status} ${starter.json?.type ?? 'UNKNOWN'}`);
  }
  console.log('[plan-gate] Starter blocked with PLAN_NOT_ALLOWED');
  for (const tenant of ['plus', 'premium']) {
    const result = await fetchTenant(tenant);
    if (result.status !== 200) {
      const type = result.json?.type ?? 'UNKNOWN';
      throw new Error(`${tenant} expected 200 but received ${result.status} (${type})`);
    }
    if (typeof result.json?.url !== 'string') {
      throw new Error(`${tenant} response missing referral url`);
    }
    console.log(`[plan-gate] ${tenant} received ${result.json.url}`);
  }
}

main().catch((error) => {
  console.error('[plan-gate] FAILED', error.message);
  process.exitCode = 1;
});
'@
if (Set-LfContentIfChanged -Path $planGatePath -Content $planGateContent) { Add-ChangedFile -Path $planGatePath }

$packagePath = Join-Path $repoRootPath "package.json"
$scriptMap = [ordered]@{
    'security:api:start' = 'node apps/api/src/dev-server.js --port=4010 --profile=test'
    'security:api:wait' = 'node -e "(async()=>{const u=process.env.API_BASE||''http://localhost:4010/health'';for(let i=0;i<60;i++){try{const r=await fetch(u);if(r.ok){process.exit(0)}}catch{};await new Promise(r=>setTimeout(r,1000));}process.exit(1)})()"'
    'test:security:anti-replay' = 'node scripts/security/anti-replay.mjs'
    'test:security:device-proof' = 'node scripts/security/device-proof.mjs'
    'test:security:plan-gate' = 'node scripts/security/plan-gate.mjs'
}
if (Update-PackageScripts -PackagePath $packagePath -ScriptMap $scriptMap) { Add-ChangedFile -Path $packagePath }

$workflowPath = Join-Path $repoRootPath ".github/workflows/security-gates.yml"
$workflowContent = @'
name: security-gates
on:
  pull_request:
    branches: [ main ]
  workflow_dispatch: {}
jobs:
  security:
    runs-on: ubuntu-latest
    env:
      API_BASE: ${{ secrets.API_BASE || 'http://localhost:4010' }}
      AUTH_TOKEN: ${{ secrets.AUTH_TOKEN }}
      STARTER_TOKEN: ${{ secrets.STARTER_TOKEN }}
      DP_PRIV: ${{ secrets.DP_PRIV }}
      DP_PUB: ${{ secrets.DP_PUB }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - name: Install
        run: npm ci
      - name: Start API (test profile)
        run: |
          nohup npm run security:api:start > security-api.log 2>&1 &
          echo $! > api.pid
      - name: Wait for API
        run: |
          for i in {1..90}; do
            if curl -fsS "${API_BASE}/health" >/dev/null 2>&1; then exit 0; fi
            sleep 1
          done
          echo "API not healthy in time"; cat security-api.log || true; exit 1
      - name: Anti-Replay
        run: npm run test:security:anti-replay
      - name: Device-Proof
        run: npm run test:security:device-proof
      - name: Plan-Gate
        run: npm run test:security:plan-gate
      - name: Dump API log on failure
        if: failure()
        run: |
          echo "--- security-api.log ---"
          [[ -f security-api.log ]] && tail -n +1 security-api.log || true
      - name: Upload logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: security-gates-logs
          path: |
            security-api.log
            *.json
            scripts/security/*.mjs
'@
if (Set-LfContentIfChanged -Path $workflowPath -Content $workflowContent) { Add-ChangedFile -Path $workflowPath }

if ($filesChanged.Count -eq 0) {
    Write-Info 'No file changes were necessary.'
}

if (-not $SkipValidation) {
    $apiBase = if ([string]::IsNullOrWhiteSpace($env:API_BASE)) { 'http://localhost:4010' } else { $env:API_BASE }
    $healthUri = "{0}/health" -f $apiBase.TrimEnd('/')
    $apiHandle = $null
    $apiStarted = $false
    if (-not (Test-ApiHealth -Uri $healthUri)) {
        Write-Info "API unavailable at $healthUri, starting local stub"
        $apiHandle = Start-LocalApi -RepoRoot $repoRootPath
        $apiStarted = $true
        if (-not (Wait-ForApi -Uri $healthUri -TimeoutSeconds 30)) {
            Stop-LocalApi -Handle $apiHandle
            throw "API did not become healthy within 30 seconds. Check security-api.log."
        }
    }
    try {
        Invoke-NpmScript -RepoRoot $repoRootPath -ScriptName 'test:security:anti-replay'
    }
    finally {
        if ($apiStarted) {
            Stop-LocalApi -Handle $apiHandle
        }
    }
} else {
    Write-Warn 'SkipValidation flag set: remember to run "npm run test:security:anti-replay" manually.'
}

Write-Success 'Security gates assets ready.'
Write-Host "Changed files:" -ForegroundColor Gray
if ($filesChanged.Count -gt 0) {
    $filesChanged | Sort-Object | ForEach-Object { Write-Host " - $_" -ForegroundColor Gray }
} else {
    Write-Host ' - (none)' -ForegroundColor Gray
}

Write-Info 'Next steps:'
Write-Host "  • Ensure GitHub secrets API_BASE, AUTH_TOKEN, STARTER_TOKEN, DP_PRIV, DP_PUB are configured." -ForegroundColor Gray
Write-Host "  • git add scripts/security package.json .github/workflows/security-gates.yml scripts/Setup-SecurityGates.ps1" -ForegroundColor Gray
Write-Host "  • git commit -m ""ci(security): implement anti-replay, device-proof, and plan-gate""" -ForegroundColor Gray
Write-Host "  • git push origin finalize/step4-governance" -ForegroundColor Gray

Write-Info 'Optional: gh workflow run security-gates.yml --ref finalize/step4-governance'
