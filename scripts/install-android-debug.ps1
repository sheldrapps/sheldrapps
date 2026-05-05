param(
  [Parameter(Mandatory = $true)]
  [string]$AppName,
  [string]$DeviceId
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$appPath = Join-Path $repoRoot (Join-Path 'apps' $AppName)
$androidPath = Join-Path $appPath 'android'
$apkPath = Join-Path $androidPath 'app\build\outputs\apk\debug\app-debug.apk'

if (-not (Test-Path $appPath)) {
  throw "App path not found: $appPath"
}

if (-not $DeviceId) {
  $adbLines = adb devices | Select-Object -Skip 1
  $deviceIds = @()
  foreach ($line in $adbLines) {
    $trimmed = $line.Trim()
    if (-not $trimmed) { continue }
    if ($trimmed -match '^(.+?)\s+device$') {
      $deviceIds += $matches[1]
    }
  }

  if ($deviceIds.Count -eq 0) {
    throw 'No Android devices detected (adb devices).'
  }

  if ($deviceIds.Count -gt 1) {
    throw "Multiple devices detected. Re-run with -DeviceId. Devices: $($deviceIds -join ', ')"
  }

  $DeviceId = $deviceIds[0]
}

Write-Host "Target app: $AppName"
Write-Host "Target device: $DeviceId"
Write-Host ''

Write-Host '[1/4] pnpm --filter <app> build'
Push-Location $repoRoot
pnpm --filter $AppName build
Pop-Location

Write-Host '[2/4] npx cap sync android'
Push-Location $appPath
npx cap sync android
Pop-Location

Write-Host '[3/4] .\\gradlew.bat clean :app:assembleDebug'
Push-Location $androidPath
.\gradlew.bat clean :app:assembleDebug
Pop-Location

if (-not (Test-Path $apkPath)) {
  throw "APK not found at: $apkPath"
}

Write-Host '[4/4] adb install -r app-debug.apk'
adb -s $DeviceId install -r $apkPath

Write-Host ''
Write-Host 'Done: install completed.'
