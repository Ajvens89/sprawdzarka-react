# Ustaw sekret Serper.dev (klucz z https://serper.dev/api-key)
param(
  [Parameter(Mandatory = $true)]
  [string]$ApiKey
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$tempFile = Join-Path $env:TEMP "sprawdzarka-serper-key.txt"
Set-Content -Path $tempFile -Value $ApiKey -NoNewline
try {
  & "$env:APPDATA\npm\firebase.cmd" functions:secrets:set SERPER_API_KEY --data-file $tempFile
  & "$env:APPDATA\npm\firebase.cmd" deploy --only functions:priceCheck
  Write-Host "SERPER_API_KEY ustawiony i funkcja priceCheck wdrozona."
} finally {
  Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
}
