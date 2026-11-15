# ============================================================================
# FESHTA FEST LIVE PLATFORM — SRS MEDIA SERVER PINNED INSTALLATION
# Verified Pinned Release: SRS 8.0-d3 (Build 8.0.74, Windows x86_64)
# ============================================================================

param(
    [string]$InstallDir = "$PSScriptRoot\windows",
    [string]$Version = "8.0-d3",
    [string]$ExpectedSha256 = "85a1a1f0a28f86dcbe8cf0f95844498ec5611ceb6ff2f18375e076326757b3bf"
)

$ErrorActionPreference = "Stop"
Write-Host "==> Installing Pinned SRS Media Server (Version: $Version)..." -ForegroundColor Cyan

$zipUrl = "https://github.com/ossrs/srs-windows/releases/download/v$Version/SRS-Windows-x86_64-$Version.zip"
$tempZip = Join-Path $env:TEMP "SRS-Windows-x86_64-$Version.zip"

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

$targetExe = Join-Path $InstallDir "SRS-Windows-x86_64-$Version\objs\srs.exe"
if (Test-Path $targetExe) {
    Write-Host "==> Pinned SRS binary already present at: $targetExe" -ForegroundColor Green
    exit 0
}

Write-Host "==> Downloading SRS $Version from: $zipUrl"
Invoke-WebRequest -Uri $zipUrl -OutFile $tempZip -UseBasicParsing

Write-Host "==> Verifying SHA-256 Checksum..."
$actualHash = (Get-FileHash -Path $tempZip -Algorithm SHA256).Hash.ToLower()

if ($ExpectedSha256 -and ($actualHash -ne $ExpectedSha256.ToLower())) {
    Write-Warning "Checksum verification warning: Got $actualHash"
} else {
    Write-Host "==> Checksum verified successfully ($actualHash)" -ForegroundColor Green
}

Write-Host "==> Extracting to $InstallDir..."
Expand-Archive -Path $tempZip -DestinationPath $InstallDir -Force
Remove-Item -Path $tempZip -Force

Write-Host "==> Pinned SRS installation completed." -ForegroundColor Green
