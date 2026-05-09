Set-Location "$PSScriptRoot\frontend"

if (-not (Test-Path "node_modules")) {
    Write-Host "node_modules bulunamadi, npm install calistiriliyor..." -ForegroundColor Yellow
    npm install
}

npm run dev
