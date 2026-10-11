param(
  [string]$TenantId = 'AromataZoisAgiouDimitriou'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$env:CMAKE_POLICY_VERSION_MINIMUM = '3.5'

Push-Location "$root\apps\pos_client"
flutter pub get
if ($LASTEXITCODE -ne 0) {
  Pop-Location
  throw "flutter pub get failed with exit code $LASTEXITCODE"
}
flutter build windows --release --dart-define=POS_TENANT_ID=$TenantId
if ($LASTEXITCODE -ne 0) {
  Pop-Location
  throw "flutter build windows failed with exit code $LASTEXITCODE"
}
Pop-Location

dotnet publish "$root\print-service\MiniPOS.PrintService" -c Release -r win-x64 --self-contained true -o "$root\print-service\publish"
if ($LASTEXITCODE -ne 0) {
  throw "dotnet publish failed with exit code $LASTEXITCODE"
}

$release = "$root\apps\pos_client\build\windows\x64\runner\Release"
$target = "$release\print-service"
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Copy-Item "$root\print-service\publish" $target -Recurse

$zip = "$root\MiniPOS-windows.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$release\*" -DestinationPath $zip
Write-Host "Done: $zip"
