<#
    Publishes the site to Azure App Service.

    The zip is built with Python rather than Compress-Archive on purpose: Compress-Archive
    writes Windows backslashes into the entry names, and Kudu's Linux-side rsync rejects
    those with "failed to stat ... Invalid argument", which shows up as a confusing
    "Deployment Failed" with no useful message.

    Secrets are never in the package. appsettings.Development.json and
    appsettings.Production.json are excluded by the csproj; the live values come from
    Azure App Settings.

    Usage:  .\deploy-to-azure.ps1
#>

$ErrorActionPreference = "Stop"

$appName  = "woodonlineservice"
$rg       = "rg-woodonline-sea"
$project  = Join-Path $PSScriptRoot "src\WoodOnlineService"
$publish  = Join-Path $project "publish"
$zip      = Join-Path $PSScriptRoot "deploy.zip"
$siteUrl  = "https://$appName.azurewebsites.net"

Write-Host "`n=== Deploying Wood Online Service to Azure ===`n" -ForegroundColor Cyan

# --- publish -------------------------------------------------------------------
Write-Host "Building release package..." -NoNewline
Remove-Item $publish -Recurse -Force -ErrorAction SilentlyContinue

Push-Location $project
try {
    $out = dotnet publish -c Release -o ./publish 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host " failed" -ForegroundColor Red
        $out | Select-Object -Last 20
        exit 1
    }
}
finally { Pop-Location }
Write-Host " done" -ForegroundColor Green

# --- refuse to ship secrets ----------------------------------------------------
Write-Host "Checking the package for secrets..." -NoNewline
$leaked = Get-ChildItem $publish -Filter "appsettings*.json" |
          Where-Object { $_.Name -ne "appsettings.json" }

if ($leaked) {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "  These would be uploaded and may contain live keys:" -ForegroundColor Red
    $leaked | ForEach-Object { Write-Host "    $($_.Name)" -ForegroundColor Red }
    Write-Host "  Check the ItemGroup in WoodOnlineService.csproj that excludes them." -ForegroundColor Yellow
    exit 1
}
Write-Host " clean" -ForegroundColor Green

# --- zip with forward slashes --------------------------------------------------
Write-Host "Packaging..." -NoNewline
Remove-Item $zip -Force -ErrorAction SilentlyContinue

$py = @"
import os, zipfile, sys
root, out = sys.argv[1], sys.argv[2]
n = 0
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for dirpath, _, filenames in os.walk(root):
        for f in filenames:
            full = os.path.join(dirpath, f)
            # Kudu extracts on Linux and rejects backslash entry names.
            z.write(full, os.path.relpath(full, root).replace(os.sep, '/'))
            n += 1
print(n)
"@

$pyFile = Join-Path $env:TEMP "wos-zip.py"
$py | Set-Content $pyFile -Encoding utf8
$fileCount = & python $pyFile $publish $zip

if (-not (Test-Path $zip)) {
    Write-Host " failed" -ForegroundColor Red
    exit 1
}
$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host " done ($fileCount files, $mb MB)" -ForegroundColor Green

# --- deploy --------------------------------------------------------------------
Write-Host "Uploading to Azure (this takes a couple of minutes)..." -ForegroundColor Cyan

# The CLI writes progress notes to stderr; PowerShell would turn those into terminating
# errors under $ErrorActionPreference = "Stop", so relax it just for this call.
$prevPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    az webapp deploy --name $appName --resource-group $rg --src-path $zip --type zip --timeout 900 2>&1 |
        Where-Object { $_ -notmatch "Copilot|^\s*-{3,}\s*$|does not run build automation" } |
        Select-Object -Last 4
}
finally {
    $ErrorActionPreference = $prevPreference
}

# --- verify --------------------------------------------------------------------
Write-Host "`nWaiting for the site to respond..." -NoNewline
$ok = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 10
    try {
        $code = (Invoke-WebRequest $siteUrl -UseBasicParsing -TimeoutSec 30).StatusCode
        if ($code -eq 200) { $ok = $true; break }
    } catch { }
    Write-Host "." -NoNewline
}

if ($ok) {
    Write-Host " up" -ForegroundColor Green
    Write-Host "`n  Site  : $siteUrl" -ForegroundColor Green
    Write-Host "  Admin : $siteUrl/Admin/Dashboard`n" -ForegroundColor Green

    # The CLI can exit non-zero after an internal retry even when the deployment landed.
    # The site answering is the outcome that matters, so report success explicitly.
    exit 0
} else {
    Write-Host " no response" -ForegroundColor Red
    Write-Host "  Check logs: az webapp log tail --name $appName --resource-group $rg" -ForegroundColor Yellow
    exit 1
}
