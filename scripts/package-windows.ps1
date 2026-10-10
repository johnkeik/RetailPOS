param(
  [string]$TenantId = 'AromataZoisAgiouDimitriou'
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

Push-Location "$root\apps\pos_client"
flutter pub get
flutter build windows --release --dart-define=POS_TENANT_ID=$TenantId
Pop-Location

dotnet publish "$root\print-service\MiniPOS.PrintService" -c Release -r win-x64 --self-contained true -o "$root\print-service\publish"

$release = "$root\apps\pos_client\build\windows\x64\runner\Release"
$target = "$release\print-service"
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Copy-Item "$root\print-service\publish" $target -Recurse

$zip = "$root\MiniPOS-windows.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$release\*" -DestinationPath $zip
Write-Host "Done: $zip"
