using Microsoft.Extensions.Options;
using DymoSDK.Implementations;
using DymoSDK.Interfaces;

namespace MiniPOS.PrintService.Services;

public sealed class PrintOptions
{
    public string PrinterName { get; set; } = "";
    public string Template { get; set; } = "Templates/label.dymo";
    public string ProductCodeObjectName { get; set; } = "TextObject0";
    public double IngredientsBoxWidthMm { get; set; } = 15.6;
    public double IngredientsBoxHeightMm { get; set; } = 10.3;
    public string IngredientsObjectName { get; set; } = "TextObject1";
}

/// <summary>DYMO Connect SDK 1.6.0. Not exercised against hardware; see README.</summary>
public sealed class DymoLabelPrinter(IOptions<PrintOptions> options) : ILabelPrinter
{
    private readonly PrintOptions _options = options.Value;
    private readonly object _initLock = new();
    private bool _initialized;

    public IReadOnlyList<PrinterInfo> GetPrinters()
    {
        EnsureInitialized();
        return DiscoverPrinters()
            .Select(p => new PrinterInfo(p.Name, p.DriverName, p.IsConnected))
            .ToList();
    }

    public async Task PrintAsync(IReadOnlyList<LabelSpec> labels)
    {
        EnsureInitialized();
        var printer = ResolvePrinter();
        var dymoLabels = BuildLabels(labels);

        bool accepted;
        try
        {
            accepted = await DymoPrinter.Instance.PrintLabel(dymoLabels, printer.Name);
        }
        catch (Exception ex)
        {
            throw new PrintFailedException($"DYMO SDK failed while printing: {ex.Message}", ex);
        }

        if (!accepted) throw new PrintFailedException("DYMO SDK reported that the print job was not accepted.");
    }

    private void EnsureInitialized()
    {
        lock (_initLock)
        {
            if (_initialized) return;
            DymoSDK.App.Init();
            _initialized = true;
        }
    }

    // Discovery is not instant after App.Init(); poll for a few seconds before reporting none.
    private static List<IPrinter> DiscoverPrinters()
    {
        var printers = DymoPrinter.Instance.GetPrinters().ToList();
        for (var i = 0; i < 20 && printers.Count == 0; i++)
        {
            Thread.Sleep(250);
            printers = DymoPrinter.Instance.GetPrinters().ToList();
        }
        return printers;
    }

    private IPrinter ResolvePrinter()
    {
        var printers = DiscoverPrinters();
        var name = _options.PrinterName;

        var printer = string.IsNullOrWhiteSpace(name)
            ? printers.FirstOrDefault(p => p.IsConnected)
            : printers.FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));

        if (printer is null)
            throw new PrinterUnavailableException(string.IsNullOrWhiteSpace(name)
                ? "No connected DYMO printer was found."
                : $"DYMO printer '{name}' was not found.");
        if (!printer.IsConnected)
            throw new PrinterUnavailableException($"DYMO printer '{printer.Name}' is not connected.");
        return printer;
    }

    // The 2-up roll prints two labels per row: one design = code label + ingredients label.
    private List<IDymoLabel> BuildLabels(IReadOnlyList<LabelSpec> specs)
    {
        var path = ResolveTemplatePath(_options.Template);
        var result = new List<IDymoLabel>(specs.Count / 2);
        var seen = new HashSet<IDymoLabel>(ReferenceEqualityComparer.Instance);

        for (var i = 0; i + 1 < specs.Count; i += 2)
        {
            var code = specs[i];
            var ingredients = specs[i + 1];
            if (code.Kind != LabelKind.ProductCode || ingredients.Kind != LabelKind.Ingredients)
                throw new PrintFailedException("Unexpected label sequence.");

            // Each row needs its own instance; LabelSharedInstance would make every entry identical.
            var label = (DymoLabel.LabelSharedInstance as DymoLabel)?.GetNewLabelInstance()
                ?? throw new PrintFailedException("DYMO SDK did not provide a DymoLabel factory.");
            if (!seen.Add(label))
                throw new PrintFailedException("DYMO SDK returned a shared label instance; ordered collection printing is not possible.");

            try
            {
                label.LoadLabelFromFilePath(path);
            }
            catch (Exception ex)
            {
                throw new TemplateException($"Template '{path}' could not be loaded: {ex.Message}", ex);
            }

            SetText(label, path, _options.ProductCodeObjectName, code.Text);
            SetText(label, path, _options.IngredientsObjectName, LabelSequence.WrapToBox(ingredients.Text, _options.IngredientsBoxWidthMm, _options.IngredientsBoxHeightMm));
            result.Add(label);
        }
        return result;
    }

    private static void SetText(IDymoLabel label, string path, string objectName, string text)
    {
        var textObjects = label.GetLabelObjects().Where(o => o.Type == TypeObject.TextObject).ToList();
        var textObject = textObjects.FirstOrDefault(o => o.Name == objectName)
            ?? throw new TemplateException(
                $"Template '{path}' has no text object named '{objectName}'. Text objects found: {string.Join(", ", textObjects.Select(o => $"'{o.Name}'"))}.");

        if (!label.UpdateLabelObject(textObject, text))
            throw new TemplateException($"Could not set text object '{objectName}' in template '{path}'.");
    }

    private static string ResolveTemplatePath(string configured)
    {
        var path = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, configured));
        if (!File.Exists(path))
            throw new TemplateException($"Template file not found: {path}. See README for how to create it.");
        return path;
    }
}
