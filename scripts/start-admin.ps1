$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
    if (-not (Test-Path -LiteralPath '.env.local')) { throw 'Bitte zuerst die lokalen Server-Secrets in .env.local einrichten. Siehe ADMIN_SETUP.md.' }
    node scripts/admin-local.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Der Redaktionsserver konnte nicht gestartet werden. Läuft bereits ein Prozess auf Port 5050?' }
} finally { Pop-Location }
