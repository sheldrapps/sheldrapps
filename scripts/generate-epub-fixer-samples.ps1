param(
  [string]$SourcePath = 'C:\Users\sheld\Downloads\el-principito.epub',
  [string]$OutputDir = 'C:\apps\sheldrapps\artifacts\epub-fixer-samples'
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $scriptDir 'generate-epub-fixer-samples.cjs') $SourcePath $OutputDir
