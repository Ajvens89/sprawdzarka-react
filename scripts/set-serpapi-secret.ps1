# Ustaw sekret SerpApi (wklej klucz z https://serpapi.com/manage-api-key)
param(
  [Parameter(Mandatory = $true)]
  [string]$ApiKey
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$tempFile = Join-Path $env:TEMP "sprawdzarka-serpapi-key.txt"
Set-Content -Path $tempFile -Value $ApiKey -NoNewline
try {
  firebase functions:secrets:set SERPAPI_KEY --data-file $tempFile
  firebase deploy --only functions:priceCheck
  Write-Host "SERPAPI_KEY ustawiony i funkcja priceCheck wdrozona."
} finally {
  Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
}
