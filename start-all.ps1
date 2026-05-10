# $PSScriptRoot boş kalırsa (doğrudan çalıştırıldığında) scriptin bulunduğu dizini kullan
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

# Backend — PYTHONIOENCODING=utf-8 ile Türkçe log desteği, venv varsa otomatik aktif
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$root\backend'; `
     `$env:PYTHONIOENCODING = 'utf-8'; `
     if (Test-Path '$root\venv\Scripts\Activate.ps1') { & '$root\venv\Scripts\Activate.ps1' }; `
     python -m uvicorn app.main:app --reload --port 8001"

Start-Sleep -Seconds 2

# Frontend — node_modules yoksa önce kur
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$root\frontend'; `
     if (-not (Test-Path 'node_modules')) { npm install }; `
     npm run dev"

Write-Host ""
Write-Host "Piyasa Nabzi AI baslatiliyor..." -ForegroundColor Cyan
Write-Host "  Backend  -> http://localhost:8001" -ForegroundColor Green
Write-Host "  Frontend -> http://localhost:5173" -ForegroundColor Green
Write-Host "  API Docs -> http://localhost:8001/docs" -ForegroundColor Yellow
