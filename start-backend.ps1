$env:PYTHONIOENCODING = "utf-8"
$root = $PSScriptRoot

if (Test-Path "$root\venv\Scripts\Activate.ps1") {
    & "$root\venv\Scripts\Activate.ps1"
}

Set-Location "$root\backend"
python -m uvicorn app.main:app --reload --port 8001
