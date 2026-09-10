<#
    Stops the local site and the Cloudflare tunnel.
#>

$stopped = @()

Get-Process -Name "WoodOnlineService" -ErrorAction SilentlyContinue | ForEach-Object {
    $_ | Stop-Process -Force
    $stopped += "app"
}

Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue | ForEach-Object {
    $_ | Stop-Process -Force
    $stopped += "tunnel"
}

if ($stopped.Count -gt 0) {
    Write-Host ("Stopped: " + (($stopped | Select-Object -Unique) -join ", ")) -ForegroundColor Cyan
} else {
    Write-Host "Nothing was running." -ForegroundColor Yellow
}
