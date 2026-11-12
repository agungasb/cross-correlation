<#
.SYNOPSIS
    Automated Production Deployment Script for MT5 Execution Gateway on Windows VPS.
.DESCRIPTION
    1. Verifies Python 3 installation & dependencies.
    2. Installs MetaTrader5 and required packages.
    3. Verifies terminal64.exe installation path.
    4. Downloads NSSM (Non-Sucking Service Manager) and configures the bridge as an
       auto-starting Windows Service with automatic crash recovery.
    5. Configures Windows Firewall for port 8000.
#>

param(
    [string]$ServiceName = "MT5ExecutionGateway",
    [int]$Port = 8000,
    [string]$InstallDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  MT5 QUANTITATIVE EXECUTION GATEWAY - WINDOWS VPS SETUP   " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Verify Admin Privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Warning "Please run this PowerShell script as Administrator!"
    Exit 1
}

# 2. Check Python 3
Write-Host "`n[1/5] Checking Python installation..." -ForegroundColor Yellow
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Error "Python 3 is not found in PATH! Please install Python 3.10+ (x64) and check 'Add Python to PATH'."
    Exit 1
}
$pythonVer = & python --version
Write-Host "  Found: $pythonVer" -ForegroundColor Green

# 3. Install Requirements
Write-Host "`n[2/5] Installing Python packages from requirements.txt..." -ForegroundColor Yellow
Set-Location -Path $InstallDir
& python -m pip install --upgrade pip
& python -m pip install -r "$InstallDir\requirements.txt"
Write-Host "  Python packages installed successfully." -ForegroundColor Green

# 4. Check MT5 Terminal Presence
Write-Host "`n[3/5] Checking MetaTrader 5 Terminal presence..." -ForegroundColor Yellow
$commonPaths = @(
    "C:\Program Files\MetaTrader 5\terminal64.exe",
    "C:\Program Files (x86)\MetaTrader 5\terminal64.exe",
    "C:\Program Files\IC Markets MetaTrader 5\terminal64.exe",
    "C:\Program Files\Pepperstone MetaTrader 5\terminal64.exe"
)

$foundTerminal = $false
foreach ($p in $commonPaths) {
    if (Test-Path $p) {
        Write-Host "  Found MT5 Terminal at: $p" -ForegroundColor Green
        $foundTerminal = $true
        break
    }
}
if (-not $foundTerminal) {
    Write-Warning "  Could not find terminal64.exe at default paths."
    Write-Warning "  Please ensure MT5 is installed and specify MT5_PATH in mt5_bridge\.env"
}

# 5. Setup Windows Service with NSSM
Write-Host "`n[4/5] Setting up auto-start Windows Service with NSSM..." -ForegroundColor Yellow
$nssmDir = "$InstallDir\nssm"
$nssmExe = "$nssmDir\nssm.exe"

if (-not (Test-Path $nssmExe)) {
    Write-Host "  Downloading NSSM utility..." -ForegroundColor Gray
    New-Item -ItemType Directory -Force -Path $nssmDir | Out-Null
    $zipPath = "$nssmDir\nssm.zip"
    Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath "$nssmDir\extracted" -Force
    Copy-Item "$nssmDir\extracted\nssm-2.24\win64\nssm.exe" -Destination $nssmExe
    Remove-Item -Recurse -Force "$nssmDir\extracted", $zipPath
}

# Check if service already exists
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "  Stopping existing service $ServiceName..." -ForegroundColor Gray
    & $nssmExe stop $ServiceName 2>$null
    & $nssmExe remove $ServiceName confirm
}

# Install service
Write-Host "  Registering $ServiceName as Windows Service..." -ForegroundColor Green
$pythonPath = (Get-Command python).Source
$parentDir = Split-Path $InstallDir -Parent
& $nssmExe install $ServiceName $pythonPath "-m" "mt5_bridge.server"
& $nssmExe set $ServiceName AppDirectory $parentDir
& $nssmExe set $ServiceName AppStdout "$InstallDir\gateway_stdout.log"
& $nssmExe set $ServiceName AppStderr "$InstallDir\gateway_stderr.log"
& $nssmExe set $ServiceName Start SERVICE_AUTO_START

# Auto-recovery: restart on failure after 5000ms
& $nssmExe set $ServiceName AppRestartDelay 5000

# 6. Windows Firewall Rule
Write-Host "`n[5/5] Configuring Windows Firewall for port $Port..." -ForegroundColor Yellow
$ruleName = "MT5_Execution_Bridge_$Port"
Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow | Out-Null
Write-Host "  Firewall rule created for port $Port." -ForegroundColor Green

# Start the service
Write-Host "`nStarting service $ServiceName..." -ForegroundColor Cyan
& $nssmExe start $ServiceName

Start-Sleep -Seconds 2
$svc = Get-Service -Name $ServiceName
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  SETUP COMPLETE! Service Status: $($svc.Status)" -ForegroundColor Green
Write-Host "  Endpoint: http://localhost:$Port/health" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
