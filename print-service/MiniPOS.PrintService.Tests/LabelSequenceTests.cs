using MiniPOS.PrintService.Models;
using MiniPOS.PrintService.Services;

namespace MiniPOS.PrintService.Tests;

public class LabelSequenceTests
{
    private static PrintOrderRequest Order(params PrintOrderItem[] items) => new PrintOrderRequest("1024", items.ToList());

    private static string[] Describe(IEnumerable<LabelSpec> labels) =>
        labels.Select(l => $"{(l.Kind == LabelKind.ProductCode ? "CODE" : "ING")}:{l.Text}").ToArray();

    [Fact]
    public void SingleProductQuantityOne_ProducesTwoLabels()
    {
        var labels = LabelSequence.Build(Order(new PrintOrderItem("542", "VANILLA", 1)));

        Assert.Equal(["CODE:542", "ING:VANILLA"], Describe(labels));
    }

    [Fact]
    public void MultipleProducts_PreserveOrderAndInterleaveCodeWithIngredients()
    {
        var labels = LabelSequence.Build(Order(
            new PrintOrderItem("542", "A", 2),
            new PrintOrderItem("316", "B", 1),
            new PrintOrderItem("423", "C", 3)));

        Assert.Equal(12, labels.Count);
        Assert.Equal(
        [
            "CODE:542", "ING:A", "CODE:542", "ING:A",
            "CODE:316", "ING:B",
            "CODE:423", "ING:C", "CODE:423", "ING:C", "CODE:423", "ING:C",
        ], Describe(labels));
    }

    [Fact]
    public void GreekText_PassesThroughUnchanged()
    {
        const string text = "ΣΜΕΟΥΡΟ, ΜΑΝΤΑΡΙΝΙ, ΑΝΘΗ ΠΟΡΤΟΚΑΛΙΑΣ, ΜΟΣΧΟ, ΚΑΡΥΔΑ άέή";

        var labels = LabelSequence.Build(Order(new PrintOrderItem("542", text, 1)));

        Assert.Equal(text, labels[1].Text);
    }

    [Fact]
    public void ValidRequest_HasNoError() =>
        Assert.Null(LabelSequence.Validate(Order(new PrintOrderItem("542", "A", 1))));

    [Fact]
    public void NullRequest_IsRejected() => Assert.NotNull(LabelSequence.Validate(null));

    [Fact]
    public void MissingOrderId_IsRejected() =>
        Assert.NotNull(LabelSequence.Validate(new PrintOrderRequest(" ", [new PrintOrderItem("542", "A", 1)])));

    [Fact]
    public void EmptyOrder_IsRejected()
    {
        Assert.NotNull(LabelSequence.Validate(Order()));
        Assert.NotNull(LabelSequence.Validate(new PrintOrderRequest("1", null)));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(LabelSequence.MaxQuantityPerItem + 1)]
    public void InvalidQuantity_IsRejected(int quantity) =>
        Assert.NotNull(LabelSequence.Validate(Order(new PrintOrderItem("542", "A", quantity))));

    [Theory]
    [InlineData(null, "A")]
    [InlineData("", "A")]
    [InlineData("542", null)]
    [InlineData("542", "  ")]
    public void MissingTextFields_AreRejected(string? code, string? ingredients) =>
        Assert.NotNull(LabelSequence.Validate(Order(new PrintOrderItem(code, ingredients, 1))));

    [Fact]
    public void TooManyLabels_IsRejected()
    {
        var items = Enumerable.Range(0, 6).Select(i => new PrintOrderItem($"{i}", "A", LabelSequence.MaxQuantityPerItem)).ToArray();

        Assert.NotNull(LabelSequence.Validate(Order(items)));
    }

    [Fact]
    public void WrapText_BreaksOnWordsWithinLimit()
    {
        var wrapped = LabelSequence.WrapText("ΣΜΕΟΥΡΟ, ΜΑΝΤΑΡΙΝΙ, ΑΝΘΗ ΠΟΡΤΟΚΑΛΙΑΣ, ΒΑΝΙΛΙΑ", 16);

        Assert.Equal("ΣΜΕΟΥΡΟ,\nΜΑΝΤΑΡΙΝΙ, ΑΝΘΗ\nΠΟΡΤΟΚΑΛΙΑΣ,\nΒΑΝΙΛΙΑ", wrapped);
    }

    [Fact]
    public void WrapToBox_KeepsAllWordsAndSplitsLongText()
    {
        const string text = "Λωτός, περγαμόντο, φύλλο βιολέτας βέτιβερ, λευκό αχλάδι, νότες ξύλων, σανδαλοξυλο, κεχριμπάρι, ξύλο κασμήρι, έλαιο κυπριόλης βενζόη, σπόρος τόνκα, μόσχος, Λευκόμελο";

        var wrapped = LabelSequence.WrapToBox(text, 15.6, 10.3);

        Assert.True(wrapped.Split('\n').Length > 3);
        Assert.Equal(text, wrapped.Replace('\n', ' '));
    }

    [Fact]
    public void WrapToBox_ShortWordStaysOnOneLine() =>
        Assert.Equal("ELIXIR", LabelSequence.WrapToBox("ELIXIR", 15.6, 10.3));
}
