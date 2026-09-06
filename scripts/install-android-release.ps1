param(
  [Parameter(Mandatory = $true)]
  [string]$AppName,
  [string]$DeviceId,
  [switch]$UninstallFirst
)

$ErrorActionPreference = 'Stop'

$debugInstaller = Join-Path $PSScriptRoot 'install-android-debug.ps1'
$arguments = @(
  '-AppName', $AppName,
  '-BuildType', 'Release'
)

if ($DeviceId) {
  $arguments += @('-DeviceId', $DeviceId)
}

if ($UninstallFirst) {
  $arguments += '-UninstallFirst'
}

& powershell -ExecutionPolicy Bypass -File $debugInstaller @arguments
exit $LASTEXITCODE
