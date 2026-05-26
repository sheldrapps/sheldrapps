param(
  [Parameter(Mandatory = $true)]
  [string]$AppName,
  [string]$DeviceId,
  [switch]$UninstallFirst
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$appDirName = switch ($AppName) {
  'pdf-cover-changer' { 'pdf-cover-maker' }
  default { $AppName }
}
$appPath = Join-Path $repoRoot (Join-Path 'apps' $appDirName)
$androidPath = Join-Path $appPath 'android'
$apkPath = Join-Path $androidPath 'app\build\outputs\apk\debug\app-debug.apk'

function Resolve-AppId {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  switch ($Name) {
    'epub-cover-changer' { return 'com.sheldrapps.epubcoverchanger' }
    'pdf-cover-changer' { return 'com.sheldrapps.pdfcovermaker' }
    'cover-creator-for-kindle' { return 'com.sheldrapps.covercreatorforkindle' }
    default { throw "Unsupported AppName for uninstall flow: $Name" }
  }
}

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "Step failed: $Name (exit code $LASTEXITCODE)"
  }
}

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

if ($UninstallFirst) {
  $resolvedAppId = Resolve-AppId -Name $AppName
  Write-Host '[0/5] adb uninstall (if installed)'
  $installedPackages = adb -s $DeviceId shell pm list packages $resolvedAppId
  if ($installedPackages -match "package:$resolvedAppId") {
    Invoke-Step -Name 'adb uninstall' -Action { adb -s $DeviceId uninstall $resolvedAppId }
  }
  else {
    Write-Host "Package not installed, skipping uninstall: $resolvedAppId"
  }
}

Write-Host '[1/4] pnpm --filter <app> build'
Push-Location $repoRoot
Invoke-Step -Name 'pnpm build' -Action { pnpm --filter $AppName build }
Pop-Location

Write-Host '[2/4] npx cap sync android'
Push-Location $appPath
Invoke-Step -Name 'cap sync android' -Action { npx cap sync android }
Pop-Location

Write-Host '[3/4] .\\gradlew.bat clean :app:assembleDebug'
Push-Location $androidPath
Invoke-Step -Name 'gradlew assembleDebug' -Action { .\gradlew.bat clean :app:assembleDebug }
Pop-Location

if (-not (Test-Path $apkPath)) {
  throw "APK not found at: $apkPath"
}

Write-Host '[4/4] adb install -r app-debug.apk'
Invoke-Step -Name 'adb install' -Action { adb -s $DeviceId install -r $apkPath }

Write-Host ''
Write-Host 'Done: install completed.'
