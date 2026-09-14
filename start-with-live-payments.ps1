<#
    Runs the site locally with REAL Cashfree payments.

    Cashfree has to reach this machine from the public internet to deliver the payment
    webhook, so this script opens a Cloudflare tunnel first, writes the resulting public
    URL into appsettings.Development.json, and only then starts the app.

    The tunnel URL is different on every run, which is why the config is rewritten each time.

    WARNING: this is Live mode. Every payment moves real money. Refund test payments from
    the Cashfree dashboard (the gateway fee is not refundable). For free testing, run the
    app normally with "Mode": "Simulated".

    Usage:  .\start-with-live-payments.ps1
    Stop:   Ctrl+C, then .\stop-local.ps1
#>

$ErrorActionPreference = "Stop"

$root       = $PSScriptRoot
$project    = Join-Path $root "src\WoodOnlineService"
$cloudflared = Join-Path $root "tools\cloudflared.exe"
$configPath = Join-Path $project "appsettings.Development.json"
$tunnelLog  = Join-Path $env:TEMP "wos-tunnel.log"
$appUrl     = "http://localhost:5199"

if (-not (Test-Path $cloudflared)) {
    Write-Host "cloudflared not found at $cloudflared" -ForegroundColor Red
    Write-Host "Download it once with:" -ForegroundColor Yellow
    Write-Host '  Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "tools\cloudflared.exe"'
    exit 1
}

Write-Host "`n=== Wood Online Service - local run with LIVE payments ===`n" -ForegroundColor Cyan

# --- clean up anything still running from a previous session -------------------
Get-Process -Name "WoodOnlineService" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "cloudflared"       -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# --- open the tunnel ----------------------------------------------------------
Write-Host "Opening public tunnel..." -NoNewline
Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue

Start-Process -FilePath $cloudflared `
    -ArgumentList "tunnel", "--url", $appUrl, "--no-autoupdate" `
    -RedirectStandardError $tunnelLog -WindowStyle Hidden

$publicUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $tunnelLog) {
        $match = Select-String -Path $tunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" |
                 Select-Object -First 1
        if ($match) { $publicUrl = $match.Matches[0].Value; break }
    }
}

if (-not $publicUrl) {
    Write-Host " failed" -ForegroundColor Red
    Write-Host "Could not obtain a tunnel URL. Last lines of the log:" -ForegroundColor Yellow
    if (Test-Path $tunnelLog) { Get-Content $tunnelLog -Tail 15 }
    exit 1
}

Write-Host " done" -ForegroundColor Green
Write-Host "  Public URL: $publicUrl`n" -ForegroundColor Green

# --- point the app at the tunnel ----------------------------------------------
Write-Host "Updating appsettings.Development.json..." -NoNewline

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$config.Cashfree.SiteBaseUrl  = $publicUrl
$config.SiteSettings.SiteBaseUrl = $publicUrl

if ($config.Cashfree.Mode -ne "Live") {
    Write-Host "`n  Mode is '$($config.Cashfree.Mode)'. Switching to Live." -ForegroundColor Yellow
    $config.Cashfree.Mode = "Live"
}

$config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding utf8
Write-Host " done" -ForegroundColor Green

if ([string]::IsNullOrWhiteSpace($config.Cashfree.ClientId)) {
    Write-Host "`n  Cashfree keys are missing from appsettings.Development.json." -ForegroundColor Red
    Write-Host "  Add ClientId and ClientSecret, then run this script again." -ForegroundColor Red
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
    exit 1
}

# --- start the app ------------------------------------------------------------
Write-Host "`nStarting the application...`n" -ForegroundColor Cyan
Write-Host "  Local  : $appUrl"
Write-Host "  Public : $publicUrl"
Write-Host "  Admin  : $appUrl/Admin/Dashboard"
Write-Host ""
Write-Host "  LIVE MODE - payments charge real money. Refund test payments from Cashfree." -ForegroundColor Yellow
Write-Host "  Keep this window open; closing it drops the tunnel and payments stop confirming." -ForegroundColor Yellow
Write-Host ""

Push-Location $project
try {
    $env:ASPNETCORE_ENVIRONMENT = "Development"
    $env:ASPNETCORE_URLS = $appUrl
    dotnet run --no-launch-profile
}
finally {
    Pop-Location
    Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "`nTunnel closed." -ForegroundColor Cyan
}
