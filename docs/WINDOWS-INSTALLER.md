# Windows Installer Build

## Rebuild After Pulling Changes

From the repository root, run:

```powershell
.\scripts\build-installer-windows.ps1
```

The script resolves Flutter and .NET, restores the POS dependencies, builds the Windows POS for tenant `AromataZoisAgiouDimitriou`, publishes the self-contained print service, copies it beside the POS, creates the zip bundle, and compiles the Inno Setup installer. It stops on a failed build or if a required release file is missing.

To build for a different tenant:

```powershell
.\scripts\build-installer-windows.ps1 -TenantId "your-tenant-id"
```

## Build Machine Requirements

- Windows Developer Mode enabled, so Flutter can create plugin symlinks.
- Visual Studio 2026 with the **Desktop development with C++** workload and Windows SDK.
- Flutter 3.24.5 with the local VS 2026 compatibility changes in `C:\src\flutter`.
- .NET 8 SDK in `C:\src\dotnet8`.
- Inno Setup 6.

The script checks for Flutter 3.24.5 and .NET 8. Override the tool locations with `-FlutterRoot`, `-DotnetRoot`, and `-IsccPath`, or set the matching `FLUTTER_ROOT`, `DOTNET_ROOT`, and `ISCC_PATH` environment variables. The VS 2026 Flutter compatibility changes are local to the SDK and are not included in this repository; a replacement SDK must have equivalent support before building with VS 2026.

## Outputs

- `installer\Output\MiniPOS-Setup.exe`: customer installer. Installs per-machine to Program Files, creates Start menu and desktop shortcuts, offers to launch MiniPOS, and includes the POS and print service.
- `MiniPOS-windows.zip`: manual archive of the same release files; it is not an installer.

DYMO Connect for Desktop and the LabelWriter 550 driver must be installed separately on the customer's PC. They are not included in either output.
