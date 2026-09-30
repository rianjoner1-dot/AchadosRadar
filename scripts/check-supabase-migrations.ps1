# Read-only check: compare local Supabase migrations with the linked project.
# Reads only SUPABASE_ACCESS_TOKEN from .env and never prints credential values.
$ErrorActionPreference = 'Stop'
$envFile = Join-Path (Get-Location) '.env'
if (-not (Test-Path -LiteralPath $envFile)) { throw 'Missing local .env file.' }

$token = $null
foreach ($line in Get-Content -LiteralPath $envFile) {
  if ($line -match '^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.*)\s*$') {
    $token = $Matches[1].Trim().Trim('"').Trim("'")
    break
  }
}
if ([string]::IsNullOrWhiteSpace($token)) { throw 'SUPABASE_ACCESS_TOKEN is not configured in .env.' }
$env:SUPABASE_ACCESS_TOKEN = $token
$workdir = (Get-Location).Path
npm exec --yes --package=supabase -- supabase migration list --linked --workdir $workdir
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
