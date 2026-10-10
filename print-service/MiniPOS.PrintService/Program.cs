using MiniPOS.PrintService.Models;
using MiniPOS.PrintService.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.Configure<PrintOptions>(builder.Configuration.GetSection("Printing"));
builder.Services.AddSingleton<ILabelPrinter, DymoLabelPrinter>();
builder.Services.AddSingleton<PrintCoordinator>();

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "MiniPOS.PrintService" }));

app.MapGet("/api/printers", (ILabelPrinter printer) =>
{
    try
    {
        return Results.Ok(new { printers = printer.GetPrinters() });
    }
    catch (Exception ex)
    {
        return Fail(500, "sdk_error", $"Could not query DYMO printers: {ex.Message}");
    }
});

app.MapPost("/api/labels/print", async (PrintOrderRequest? request, PrintCoordinator coordinator, CancellationToken ct) =>
{
    try
    {
        var count = await coordinator.PrintAsync(request, ct);
        return Results.Ok(new
        {
            success = true,
            orderId = request!.OrderId,
            labelsSubmitted = count,
            message = "Print job submitted to the DYMO SDK. Physical output is not confirmed."
        });
    }
    catch (InvalidRequestException ex) { return Fail(400, "invalid_request", ex.Message); }
    catch (PrinterUnavailableException ex) { return Fail(503, "printer_unavailable", ex.Message); }
    catch (TemplateException ex) { return Fail(500, "template_error", ex.Message); }
    catch (PrintFailedException ex) { return Fail(502, "print_failed", ex.Message); }
    catch (OperationCanceledException) { return Fail(499, "cancelled", "Request cancelled before printing started."); }
    catch (Exception ex) { return Fail(500, "sdk_error", ex.Message); }
});

app.Run();

static IResult Fail(int status, string error, string message) =>
    Results.Json(new { success = false, error, message }, statusCode: status);
