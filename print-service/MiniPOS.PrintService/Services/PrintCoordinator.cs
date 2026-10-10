using MiniPOS.PrintService.Models;

namespace MiniPOS.PrintService.Services;

public sealed class PrintCoordinator(ILabelPrinter printer)
{
    private readonly SemaphoreSlim _gate = new(1, 1);

    /// <returns>Number of labels submitted.</returns>
    public async Task<int> PrintAsync(PrintOrderRequest? request, CancellationToken ct = default)
    {
        var error = LabelSequence.Validate(request);
        if (error is not null) throw new InvalidRequestException(error);

        var labels = LabelSequence.Build(request!);

        await _gate.WaitAsync(ct);
        try
        {
            await printer.PrintAsync(labels);
        }
        finally
        {
            _gate.Release();
        }
        return labels.Count;
    }
}
