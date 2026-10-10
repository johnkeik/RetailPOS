using MiniPOS.PrintService.Models;

namespace MiniPOS.PrintService.Services;

public static class LabelSequence
{
    public const int MaxQuantityPerItem = 50;
    public const int MaxLabelsPerOrder = 500;
    public const int MaxProductCodeLength = 32;
    public const int MaxIngredientsLength = 500;

    /// <summary>Returns an error message, or null when the request is valid.</summary>
    public static string? Validate(PrintOrderRequest? request)
    {
        if (request is null) return "Request body is required.";
        if (string.IsNullOrWhiteSpace(request.OrderId)) return "orderId is required.";
        if (request.Items is null || request.Items.Count == 0) return "items must contain at least one item.";

        long labels = 0;
        for (var i = 0; i < request.Items.Count; i++)
        {
            var item = request.Items[i];
            if (item is null) return $"items[{i}] is null.";
            if (string.IsNullOrWhiteSpace(item.ProductCode)) return $"items[{i}].productCode is required.";
            if (item.ProductCode.Length > MaxProductCodeLength) return $"items[{i}].productCode is longer than {MaxProductCodeLength} characters.";
            if (string.IsNullOrWhiteSpace(item.Ingredients)) return $"items[{i}].ingredients is required.";
            if (item.Ingredients.Length > MaxIngredientsLength) return $"items[{i}].ingredients is longer than {MaxIngredientsLength} characters.";
            if (item.Quantity < 1 || item.Quantity > MaxQuantityPerItem) return $"items[{i}].quantity must be between 1 and {MaxQuantityPerItem}.";
            labels += item.Quantity * 2L;
        }

        return labels > MaxLabelsPerOrder ? $"An order may not exceed {MaxLabelsPerOrder} labels." : null;
    }

    /// <summary>Per unit: CODE then INGREDIENTS, items in request order. Assumes a validated request.</summary>
    public static List<LabelSpec> Build(PrintOrderRequest request)
    {
        var labels = new List<LabelSpec>();
        foreach (var item in request.Items!)
        {
            for (var n = 0; n < item.Quantity; n++)
            {
                labels.Add(new LabelSpec(LabelKind.ProductCode, item.ProductCode!));
                labels.Add(new LabelSpec(LabelKind.Ingredients, item.Ingredients!));
            }
        }
        return labels;
    }

    /// <summary>Greedy word wrap into lines of at most maxChars (a longer single word keeps its own line).</summary>
    public static string WrapText(string text, int maxChars)
    {
        var lines = new List<string>();
        var current = "";
        foreach (var word in text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
        {
            if (current.Length > 0 && current.Length + 1 + word.Length > maxChars)
            {
                lines.Add(current);
                current = word;
            }
            else
            {
                current = current.Length == 0 ? word : current + " " + word;
            }
        }
        if (current.Length > 0) lines.Add(current);
        return string.Join("\n", lines);
    }

    /// <summary>Picks the line length that gives the largest estimated font size inside a width x height (mm) box.</summary>
    public static string WrapToBox(string text, double widthMm, double heightMm)
    {
        const double charWidth = 0.65;  // average bold caps width / font size
        const double lineHeight = 1.2;  // line pitch / font size

        var best = WrapText(text, int.MaxValue);
        var bestSize = -1.0;
        for (var maxChars = 6; maxChars <= 60; maxChars++)
        {
            var wrapped = WrapText(text, maxChars);
            var lines = wrapped.Split('\n');
            var size = Math.Min(widthMm / (charWidth * lines.Max(l => l.Length)), heightMm / (lineHeight * lines.Length));
            if (size > bestSize + 1e-9)
            {
                bestSize = size;
                best = wrapped;
            }
        }
        return best;
    }
}
