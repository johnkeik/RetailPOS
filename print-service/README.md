# MiniPOS.PrintService

Local ASP.NET Core Minimal API that prints Mini POS perfume labels on a DYMO LabelWriter 550 through the official DYMO Connect .NET SDK (`DYMO.Connect.SDK` 1.6.0 + `.Windows` packages).

```
Flutter Mini POS -> HTTP/JSON -> MiniPOS.PrintService (localhost:5050) -> DYMO Connect SDK -> LabelWriter 550 (USB)
```

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Service is up (works without a printer). |
| GET | `/api/printers` | Printers seen by the SDK: `name`, `driverName`, `isConnected`. |
| POST | `/api/labels/print` | Print (or reprint) the given items. |

```json
{ "orderId": "1024", "items": [ { "productCode": "542", "ingredients": "ΣΜΕΟΥΡΟ, ΒΑΝΙΛΙΑ", "quantity": 2 } ] }
```

Per unit it prints a product-code label and an ingredients label (one 2-up row), items in request order (542 CODE, 542 ING, 542 CODE, 542 ING, 316 CODE, ...). Text is passed through unchanged (no case conversion) - send ingredients already in uppercase.

Success: `{ "success": true, "orderId": "1024", "labelsSubmitted": 6, "message": "..." }`. `labelsSubmitted` counts physical labels (2 per unit) handed to the SDK/driver, not physically printed.

Errors are `{ "success": false, "error": <code>, "message": ... }`:
`400 invalid_request`, `503 printer_unavailable`, `500 template_error`, `502 print_failed`, `500 sdk_error`.

Limits: quantity 1-50 per item, max 500 labels per order, product code <= 32 chars, ingredients <= 500 chars.

Print requests are serialized with a `SemaphoreSlim`, so two orders never interleave. There is no retry; the POS decides what to resend.

## Configuration (`appsettings.json`)

- `Kestrel:Endpoints:Http:Url` - `http://localhost:5050` (localhost only; no LAN exposure, no auth yet).
- `Printing:PrinterName` - exact DYMO printer name; empty = first connected DYMO printer.
- `Printing:Template` - path relative to the executable (default `Templates/label.dymo`).
- `Printing:ProductCodeObjectName` / `IngredientsObjectName` - names of the two text objects in the template (default `TextObject0` = code, `TextObject1` = ingredients, the names DYMO Connect assigns).

## Creating the template (required, not included)

The customer's roll is 2-up (`LW 13x25mm 2up`): the printer prints two labels side by side per row, and DYMO Connect shows both as one design. So one design per product unit prints both labels at once, which also guarantees the pair stays together.

In DYMO Connect, with the 2-up roll selected, create one design with two text objects, one in each label position:

1. Code position: text object named **ProductCode**; large, bold italic, centered horizontally and vertically.
2. Ingredients position: text object named **Ingredients**; bold, centered, multi-line, with Auto fit on.
3. Save as `MiniPOS.PrintService/Templates/label.dymo`.

If the objects have other names, the `template_error` response lists the names found; set them in `Printing:ProductCodeObjectName` / `IngredientsObjectName`.

`Templates/*.dymo` is copied to build and publish output.

## Shipping with the POS (single exe for the user)

The POS starts the service itself (`lib/core/print_service_launcher.dart`): on launch, if nothing answers on `/health`, it runs `print-service\MiniPOS.PrintService.exe` from its own folder, and stops it on exit. The service is built as a windowed app, so no console appears.

Layout on the customer PC:

```
pos_client.exe  (+ Flutter files)
print-service\MiniPOS.PrintService.exe  (+ the whole publish output, incl. Templates\label.dymo)
```

Build: `flutter build windows`, then copy the `publish` folder to `build\windows\x64\runner\Release\print-service`. If the service folder is missing, the POS still works and printing reports "service not found". Console logs are no longer visible; run the exe by hand to see them.

## Build, test, publish

```
dotnet test MiniPOS.PrintService.Tests
dotnet publish MiniPOS.PrintService -c Release -r win-x64 --self-contained true -o ./publish
```

Run `publish\MiniPOS.PrintService.exe` next to the POS as a normal background process.

Tests cover label expansion, order preservation, Greek passthrough, validation and serialization using a fake printer; they do not touch the DYMO SDK and run on any OS.

## Verified SDK API (from 1.6.0 package metadata and the official sample)

`DymoSDK.App.Init()`, `DymoPrinter.Instance.GetPrinters()` (sync, `IPrinter`: `Name`, `DriverName`, `IsConnected`), `DymoLabel.LabelSharedInstance` / `GetNewLabelInstance()`, `LoadLabelFromFilePath`, `GetLabelObjects()` (`Name`, `Type == TypeObject.TextObject`), `UpdateLabelObject(obj, text)` (returns bool), `DymoPrinter.Instance.PrintLabel(IEnumerable<IDymoLabel>, printerName, ...)` returning `Task<bool>`. The collection overload is used so one order is one submission in the given order.

## Customer PC requirements

- Windows 10/11 x64.
- DYMO Connect for Desktop (installs the LabelWriter 550 driver and the DYMO services the SDK talks to). Install it and confirm it prints a test label from DYMO Connect itself. The SDK package ships its own managed/native assets, but not the printer driver.
- No .NET install needed (self-contained publish). Not verified: whether any extra runtime (e.g. VC++ redistributable) is needed; check on a clean PC.

## Hardware verification still required

Nothing here has been run against a DYMO printer. To check:

1. `GET /api/printers` lists the 550 with `isConnected: true` (discovery may be asynchronous in the SDK; retry if empty right after start).
2. `DymoSDK.App.Init()` works from the ASP.NET Core host thread.
3. `GetNewLabelInstance()` returns independent instances (the service fails with `print_failed` if it returns the same object).
4. Print the 3-item example (12 labels) and confirm the physical order and that text fits.
5. Confirm LabelWriter 550 label-roll behaviour (the 550 may refuse non-DYMO rolls).
6. Test two simultaneous POSTs; labels must not interleave.
