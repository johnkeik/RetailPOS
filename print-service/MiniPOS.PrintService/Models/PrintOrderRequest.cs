namespace MiniPOS.PrintService.Models;

public sealed record PrintOrderRequest(string? OrderId, List<PrintOrderItem>? Items);
