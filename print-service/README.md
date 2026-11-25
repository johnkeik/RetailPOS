# MiniPOS print service

Local .NET 8 Windows HTTP adapter for DYMO Connect SDK 1.6.0 and a LabelWriter 550. Flutter starts the bundled process when no local service answers its health check. See [Windows packaging](../docs/OPERATIONS.md#windows-packaging) for installation/release setup.

## API

Default base URL: `http://localhost:5050`. No API authentication is implemented; keep the configured localhost binding.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Process health, without printer verification |
| GET | `/api/printers` | SDK printer names, drivers and connection state |
| POST | `/api/labels/print` | Submit labels or reprint |

```json
{ "orderId": "demo-001", "items": [{ "productCode": "DEMO-001", "ingredients": "ΒΑΝΙΛΙΑ", "quantity": 2 }] }
```

Each unit produces one code label and one ingredients label on a 2-up row. Jobs are serialized; item/unit order is preserved. Ingredients are word-wrapped without case conversion. Successful responses include `success`, `orderId` and `labelsSubmitted`; this confirms SDK submission, not physical output. Error responses contain `success: false`, `error` and `message` (400 invalid request, 503 unavailable printer, 500 template/SDK error, 502 submission failure).

Limits: 1–50 units per line, 500 labels per job, code length 32 and ingredients length 500. Flutter skips items with blank ingredients. Printing happens after saved checkout, with no automatic retry or sale rollback.

## Configuration and template

`MiniPOS.PrintService/appsettings.json` configures the localhost binding, optional exact printer name (blank selects a connected printer), template path and object names. The checked-in `Templates/label.dymo` is copied to build/publish output. Default code/ingredients objects are `TextObject0`/`TextObject1`; ingredients wrapping uses a 15.6 × 10.3 mm box. Match any replacement template to these settings.

## Build and verification

From `print-service/`:

```sh
dotnet test MiniPOS.PrintService.Tests
dotnet publish MiniPOS.PrintService -c Release -r win-x64 --self-contained true -o ./publish
```

Tests link hardware-free sequence/coordinator logic and use a fake printer. See dated [review evidence](../docs/SAAS_READINESS.md#verification) for execution status. The SDK adapter source marks hardware integration as unexercised.

On a prepared Windows PC, install DYMO Connect/drivers separately, verify discovery and a test print, then check Greek text fit, 2-up roll behavior, multi-item ordering, concurrent jobs and reprinting after failure. A self-contained publish bundles the runtime; clean-PC prerequisites and physical output still require acceptance testing.
