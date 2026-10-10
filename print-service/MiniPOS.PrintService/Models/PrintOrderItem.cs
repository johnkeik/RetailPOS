namespace MiniPOS.PrintService.Models;

public sealed record PrintOrderItem(string? ProductCode, string? Ingredients, int Quantity);
