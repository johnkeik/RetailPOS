using MiniPOS.PrintService.Models;
using MiniPOS.PrintService.Services;

namespace MiniPOS.PrintService.Tests;

public class PrintCoordinatorTests
{
    private sealed class FakePrinter : ILabelPrinter
    {
        public readonly List<string> Events = new();
        public int Active, MaxActive;

        public IReadOnlyList<PrinterInfo> GetPrinters() => [];

        public async Task PrintAsync(IReadOnlyList<LabelSpec> labels)
        {
            var active = Interlocked.Increment(ref Active);
            lock (Events) { MaxActive = Math.Max(MaxActive, active); Events.Add($"start:{labels[0].Text}"); }
            await Task.Delay(50);
            lock (Events) Events.Add($"end:{labels[0].Text}");
            Interlocked.Decrement(ref Active);
        }
    }

    private static PrintOrderRequest Order(string code) => new("1", [new(code, "A", 1)]);

    [Fact]
    public async Task ConcurrentRequests_AreSerialized()
    {
        var printer = new FakePrinter();
        var coordinator = new PrintCoordinator(printer);

        await Task.WhenAll(Enumerable.Range(0, 5).Select(i => Task.Run(() => coordinator.PrintAsync(Order($"p{i}")))));

        Assert.Equal(1, printer.MaxActive);
        Assert.Equal(10, printer.Events.Count);
        for (var i = 0; i < printer.Events.Count; i += 2)
            Assert.Equal(printer.Events[i].Replace("start:", ""), printer.Events[i + 1].Replace("end:", ""));
    }

    [Fact]
    public async Task InvalidRequest_ThrowsAndDoesNotReachPrinter()
    {
        var printer = new FakePrinter();
        var coordinator = new PrintCoordinator(printer);

        await Assert.ThrowsAsync<InvalidRequestException>(() => coordinator.PrintAsync(new PrintOrderRequest("1", [])));

        Assert.Empty(printer.Events);
    }

    [Fact]
    public async Task ReturnsLabelCount()
    {
        var coordinator = new PrintCoordinator(new FakePrinter());

        Assert.Equal(2, await coordinator.PrintAsync(Order("542")));
    }
}
