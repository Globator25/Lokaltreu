$ErrorActionPreference = 'Stop'

BeforeAll {
  $repo = Split-Path -Parent $PSCommandPath
  while (-not (Test-Path (Join-Path $repo 'scripts'))) {
    $repo = Split-Path -Parent $repo
    if (-not $repo) { throw "Cannot locate repo root from $PSCommandPath" }
  }
  Set-StrictMode -Version Latest
}

Describe 'verify-bom-and-uid.ps1' {
  It 'fails on BOM in repo subset' {
    $tmp = New-Item -ItemType Directory -Force -Path (Join-Path $env:TEMP ("obs-test-" + [guid]::NewGuid()))
    Push-Location $tmp.FullName
    try {
      $bomPath = Join-Path $tmp.FullName 'bad.yaml'
      # Write file with UTF8 BOM
      [IO.File]::WriteAllBytes($bomPath, (,[byte[]](0xEF,0xBB,0xBF) + [Text.Encoding]::UTF8.GetBytes("a: 1`n")))
      $ps = Start-Process pwsh -NoNewWindow -PassThru -Wait -ArgumentList @('-NoProfile','-File', (Join-Path $repo 'scripts/verify-bom-and-uid.ps1'))
      $ps.ExitCode | Should -Be 1
    } finally { Pop-Location; Remove-Item $tmp.FullName -Recurse -Force }
  }

  It 'fails on duplicate UID in NDJSON under dashboards path' {
    $tmp = New-Item -ItemType Directory -Force -Path (Join-Path $env:TEMP ("obs-test-" + [guid]::NewGuid()))
    Push-Location $tmp.FullName
    try {
      $dash = 'apps/obs/grafana/provisioning/dashboards/lokaltreu'
      New-Item -ItemType Directory -Force -Path $dash | Out-Null
      $nd = @'{"uid":"dup-1"}','{"uid":"dup-1"}','{"uid":"ok-2"}'
      Set-Content -Path (Join-Path $dash 'test.ndjson') -Value $nd -Encoding utf8NoBOM
      $ps = Start-Process pwsh -NoNewWindow -PassThru -Wait -ArgumentList @('-NoProfile','-File', (Join-Path $repo 'scripts/verify-bom-and-uid.ps1'))
      $ps.ExitCode | Should -Be 1
    } finally { Pop-Location; Remove-Item $tmp.FullName -Recurse -Force }
  }
}

Describe 'Health scripts (no-throw smoke)' {
  It 'Test-Grafana.ps1 runs with mocked web request' {
    Mock -CommandName Invoke-WebRequest -MockWith { [pscustomobject]@{ StatusCode = 200; Content = '{"status":"ok"}' } }
    . (Join-Path $repo 'apps/obs/tools/Test-Grafana.ps1') -App 'dummy-app'
  }
  It 'Test-Tempo.ps1 runs with mocked web request' {
    Mock -CommandName Invoke-WebRequest -MockWith { [pscustomobject]@{ StatusCode = 200; Content = '{"status":"ready"}' } }
    . (Join-Path $repo 'apps/obs/tools/Test-Tempo.ps1') -App 'dummy-app'
  }
  It 'Test-Loki.ps1 runs with mocked web request' {
    Mock -CommandName Invoke-WebRequest -MockWith { [pscustomobject]@{ StatusCode = 200; Content = '{"status":"ready"}' } }
    . (Join-Path $repo 'apps/obs/tools/Test-Loki.ps1') -App 'dummy-app'
  }
}

Describe 'Health scripts IPv4/Proxy behavior' {
  It 'Tempo: skips public on no A record and tries proxy' {
    Mock -CommandName Resolve-DnsName -MockWith { throw "no A" }
    Mock -CommandName Invoke-WebRequest -ParameterFilter { $Uri -like 'http://localhost:3200/*' } -MockWith { [pscustomobject]@{ StatusCode=200; Content='ok' } }
    . (Join-Path $repo 'apps/obs/tools/Test-Tempo.ps1') -App 'dummy-app'
  }
  It 'Loki: prefers IPv4 public via curl.exe when present' {
    # Simulate IPv4 present and curl.exe available by mocking Get-Command to return an object with Source
    Mock -CommandName Resolve-DnsName -MockWith { @{ IPAddress='127.0.0.1' } }
    Mock -CommandName Get-Command -MockWith { [pscustomobject]@{ Source = 'curl.exe' } }
    # Prevent actual curl, then let Invoke-WebRequest succeed
    Mock -CommandName Invoke-WebRequest -MockWith { [pscustomobject]@{ StatusCode=200; Content='ok' } }
    . (Join-Path $repo 'apps/obs/tools/Test-Loki.ps1') -App 'dummy-app'
  }
}
