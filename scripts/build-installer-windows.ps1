param(
  [string]$TenantId = 'AromataZoisAgiouDimitriou',
  [string]$FlutterRoot = $env:FLUTTER_ROOT,
  [string]$DotnetRoot = $env:DOTNET_ROOT,
  [string]$IsccPath = $env:ISCC_PATH
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if (-not $FlutterRoot) {
  $FlutterRoot = @('C:\src\flutter', "$env:LOCALAPPDATA\flutter") |
    Where-Object { Test-Path (Join-Path $_ 'bin\flutter.bat') } |
    Select-Object -First 1
}
if (-not $FlutterRoot -or -not (Test-Path (Join-Path $FlutterRoot 'bin\flutter.bat'))) {
  throw 'Flutter SDK not found. Set FLUTTER_ROOT to the Flutter 3.24.5 SDK.'
}

if (-not $DotnetRoot) {
  $DotnetRoot = @('C:\src\dotnet8', "$env:ProgramFiles\dotnet") |
    Where-Object { Test-Path (Join-Path $_ 'dotnet.exe') } |
    Select-Object -First 1
}
if (-not $DotnetRoot -or -not (Test-Path (Join-Path $DotnetRoot 'dotnet.exe'))) {
  throw 'The .NET SDK was not found. Set DOTNET_ROOT to an installation containing .NET 8.'
}

if (-not $IsccPath) {
  $IsccPath = @(
    "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
    'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
    'C:\Program Files\Inno Setup 6\ISCC.exe'
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}
if (-not $IsccPath -or -not (Test-Path $IsccPath)) {
  throw 'Inno Setup compiler not found. Set ISCC_PATH to ISCC.exe.'
}

$env:DOTNET_ROOT = $DotnetRoot
$env:Path = "$(Join-Path $FlutterRoot 'bin');$DotnetRoot;$env:Path"

$flutterVersion = (& (Join-Path $FlutterRoot 'bin\flutter.bat') --version 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $flutterVersion -notmatch 'Flutter 3\.24\.5\b') {
  throw "Flutter 3.24.5 is required for this project build. Detected:`n$flutterVersion"
}

$dotnetSdks = (& (Join-Path $DotnetRoot 'dotnet.exe') --list-sdks 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $dotnetSdks -notmatch '(?m)^8\.\d+\.\d+') {
  throw "The .NET 8 SDK is required. Detected SDKs:`n$dotnetSdks"
}

Write-Host "Using $($flutterVersion.Trim().Split("`n")[0])"
Write-Host "Using .NET SDK 8 from $DotnetRoot"
& (Join-Path $PSScriptRoot 'package-windows.ps1') -TenantId $TenantId
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
  throw "Windows package build failed with exit code $LASTEXITCODE"
}

$release = Join-Path $root 'apps\pos_client\build\windows\x64\runner\Release'
foreach ($requiredFile in @(
    (Join-Path $release 'pos_client.exe'),
    (Join-Path $release 'print-service\MiniPOS.PrintService.exe'),
    (Join-Path $release 'print-service\Templates\label.dymo')
  )) {
  if (-not (Test-Path $requiredFile)) {
    throw "Required release file missing: $requiredFile"
  }
}

$issPath = Join-Path $root 'installer\MiniPOS.iss'
& $IsccPath $issPath
if ($LASTEXITCODE -ne 0) {
  throw "Inno Setup compilation failed with exit code $LASTEXITCODE"
}

$setupPath = Join-Path $root 'installer\Output\MiniPOS-Setup.exe'
if (-not (Test-Path $setupPath)) {
  throw "Installer was not created: $setupPath"
}

$setup = Get-Item $setupPath
Write-Host "Installer: $($setup.FullName)"
Write-Host "Size: $([math]::Round($setup.Length / 1MB, 2)) MiB ($($setup.Length) bytes)"