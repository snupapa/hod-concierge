if (-not (Test-Path (Join-Path $PSScriptRoot "package.json"))) {
  Write-Host "package.json was not found in this folder." -ForegroundColor Yellow
  exit 1
}

Write-Host "Starting House of Deb dev server on http://localhost:5173" -ForegroundColor Green
Write-Host "Open the same URL with your local IP on other devices, for example http://192.168.1.95:5173" -ForegroundColor Cyan

corepack yarn dev
