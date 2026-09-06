param(
  [Parameter(Mandatory = $true)]
  [string]$AppName,
  [string]$DeviceId,
  [ValidateSet('Debug', 'Release')]
  [string]$BuildType = 'Debug',
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
$buildTypeLower = $BuildType.ToLowerInvariant()
$apkDirectory = Join-Path $androidPath (Join-Path 'app\build\outputs\apk' $buildTypeLower)
$apkPath = Join-Path $apkDirectory "app-$buildTypeLower.apk"

function Resolve-AppId {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  switch ($Name) {
    'epub-cover-changer' { return 'com.sheldrapps.epubcoverchanger' }
    'pdf-cover-maker' { return 'com.sheldrapps.pdfcovermaker' }
    'pdf-cover-changer' { return 'com.sheldrapps.pdfcovermaker' }
    'cover-creator-for-kindle' { return 'com.sheldrapps.covercreatorforkindle' }
    'epub-fixer' { return 'com.sheldrapps.epubfixer' }
    'epub-merger-and-splitter' { return 'com.sheldrapps.epubmergersplitter' }
    'pdf-merger-and-splitter' { return 'com.sheldrapps.pdfmergerandsplitter' }
    'just-one-step' { return 'com.sheldrapps.justonestep' }
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
  $installedPackages = adb -s $DeviceId shell pm list packages --user 0 $resolvedAppId
  if ($installedPackages -match "package:$resolvedAppId") {
    $uninstallOutput = & adb -s $DeviceId shell pm uninstall --user 0 $resolvedAppId 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw "adb uninstall failed for $resolvedAppId (exit code $LASTEXITCODE): $uninstallOutput"
    }

    if ($uninstallOutput -match 'Success') {
      Write-Host "Uninstalled for user 0: $resolvedAppId"
    }
    elseif ($uninstallOutput -match 'SecurityException') {
      Write-Warning "Uninstall skipped by Android for ${resolvedAppId}: $uninstallOutput"
    }
    else {
      Write-Host $uninstallOutput
    }
  }
  else {
    Write-Host "Package not installed, skipping uninstall: $resolvedAppId"
  }
}

Write-Host '[1/4] pnpm --filter <app> build'
Push-Location $repoRoot
Invoke-Step -Name 'pnpm build' -Action { pnpm --filter $AppName build }
Pop-Location

Write-Host '[2/4] pnpm exec cap sync android'
Push-Location $appPath
Invoke-Step -Name 'cap sync android' -Action { pnpm exec cap sync android }
Write-Host '[2.5/4] node scripts/patch-cordova-flatdir.cjs'
Push-Location $repoRoot
Invoke-Step -Name 'patch cordova flatDir' -Action { node scripts/patch-cordova-flatdir.cjs }
Pop-Location
Pop-Location

Write-Host "[3/4] .\\gradlew.bat clean :app:assemble$BuildType"
Push-Location $androidPath
Invoke-Step -Name "gradlew assemble$BuildType" -Action { .\gradlew.bat clean ":app:assemble$BuildType" }
Pop-Location

if (-not (Test-Path $apkPath)) {
  if ($BuildType -eq 'Release') {
    $releaseCandidates = @(Get-ChildItem -Path $apkDirectory -Filter 'app-release*.apk' -File -ErrorAction SilentlyContinue)
    if ($releaseCandidates.Count -eq 1) {
      $apkPath = $releaseCandidates[0].FullName
    }
  }
}

if (-not (Test-Path $apkPath)) {
  throw "APK not found at: $apkPath"
}

Write-Host "[4/4] adb install -r $([System.IO.Path]::GetFileName($apkPath))"
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$installOutput = @(& adb -s $DeviceId install --no-streaming -r $apkPath 2>&1)
$installExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorActionPreference
$installOutputText = $installOutput -join [Environment]::NewLine

if ($installExitCode -ne 0 -and $BuildType -eq 'Release' -and $installOutputText -match 'INSTALL_FAILED_UPDATE_INCOMPATIBLE') {
  Write-Warning 'The installed APK has a different signing key. Uninstalling it and retrying the release installation.'
  $resolvedAppId = Resolve-AppId -Name $AppName
  Invoke-Step -Name 'adb uninstall after signing mismatch' -Action { adb -s $DeviceId uninstall $resolvedAppId }
  Invoke-Step -Name 'adb install release APK after uninstall' -Action { adb -s $DeviceId install --no-streaming $apkPath }
}
elseif ($installExitCode -ne 0) {
  throw "Step failed: adb install (exit code $installExitCode): $installOutputText"
}

Write-Host ''
Write-Host "Done: $BuildType install completed."
