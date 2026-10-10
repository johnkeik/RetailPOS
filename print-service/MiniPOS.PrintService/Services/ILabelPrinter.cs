namespace MiniPOS.PrintService.Services;

public enum LabelKind { ProductCode, Ingredients }

public sealed record LabelSpec(LabelKind Kind, string Text);

public sealed record PrinterInfo(string Name, string DriverName, bool IsConnected);

public interface ILabelPrinter
{
    IReadOnlyList<PrinterInfo> GetPrinters();

    /// <summary>Submits all labels, in order, as a single print submission.</summary>
    Task PrintAsync(IReadOnlyList<LabelSpec> labels);
}

public sealed class InvalidRequestException(string message) : Exception(message);

public sealed class PrinterUnavailableException(string message) : Exception(message);

public sealed class TemplateException(string message, Exception? inner = null) : Exception(message, inner);

public sealed class PrintFailedException(string message, Exception? inner = null) : Exception(message, inner);
