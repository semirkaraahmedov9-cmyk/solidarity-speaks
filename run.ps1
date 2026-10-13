# Стартира „Солидарността говори!“ на този компютър.
# Стартиране от PowerShell, в папката на проекта:
#   powershell -ExecutionPolicy Bypass -File .\run.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$python = ".\.venv\Scripts\python.exe"
$port = 8000

# Проверка дали виртуалната среда е създадена
if (-not (Test-Path $python)) {
    Write-Host "The virtual environment is missing. Run these two commands first:" -ForegroundColor Yellow
    Write-Host "  python -m venv .venv"
    Write-Host "  .\.venv\Scripts\python.exe -m pip install -r requirements.txt"
    exit 1
}

# Python да пише кирилица правилно в конзолата
$env:PYTHONUTF8 = "1"

# Проверка дали приложението вече не работи (напр. в друг прозорец със стария код)
if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "The app is already running (port $port is in use)." -ForegroundColor Yellow
    Write-Host "Close the other PowerShell window where it runs (or press Ctrl+C there), then run this again."
    Write-Host "If you cannot find that window, restart the computer."
    exit 1
}

# Ако гласовете още не са изтеглени, ги изтегляме
if (-not (Get-ChildItem voices -Filter *.onnx)) {
    Write-Host "Downloading voices (about 190 MB, only the first time)..."
    & $python scripts\download_voices.py
    if ($LASTEXITCODE -ne 0) { exit 1 }
}

# Адресът на компютъра в домашната мрежа (за отваряне от телефон)
$ip = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -First 1 -ExpandProperty IPAddress

Write-Host ""
Write-Host "Solidarity Speaks! is starting..." -ForegroundColor Green
Write-Host "  On this computer, open:   http://localhost:$port"
if ($ip) {
    Write-Host "  On a phone (same Wi-Fi):  http://${ip}:$port"
}
Write-Host "  To stop the app, press Ctrl+C in this window."
Write-Host ""

# 0.0.0.0 = приемаме връзки и от други устройства в мрежата (телефона)
& $python -m uvicorn app.main:app --host 0.0.0.0 --port $port
