class PosPromotion {
  const PosPromotion(
      {required this.id,
      required this.name,
      required this.variantTemplateIds,
      required this.groupSize,
      required this.discountPercent,
      this.kind = 'CHEAPEST',
      this.giftVariantTemplateId,
      this.repeat = true,
      this.active = true,
      this.startsAt,
      this.endsAt});
  final String id;
  final String name;
  final List<String> variantTemplateIds;
  final String kind;
  final String? giftVariantTemplateId;
  final int groupSize;
  final int discountPercent;
  final bool repeat;
  final bool active;
  final DateTime? startsAt;
  final DateTime? endsAt;

  bool appliesAt(DateTime now) =>
      active &&
      (startsAt == null || !now.isBefore(startsAt!)) &&
      (endsAt == null || now.isBefore(endsAt!));

  factory PosPromotion.fromMap(String id, Map<String, dynamic> data) =>
      PosPromotion(
        id: id,
        kind: data['kind'] as String? ?? 'CHEAPEST',
        giftVariantTemplateId: data['giftVariantTemplateId'] as String?,
        name: data['name'] as String,
        variantTemplateIds:
            List<String>.from(data['variantTemplateIds'] as List),
        groupSize: (data['groupSize'] as num).toInt(),
        discountPercent: (data['discountPercent'] as num).toInt(),
        repeat: data['repeat'] == true,
        active: data['active'] == true,
        startsAt: data['startsAt'] == null
            ? null
            : DateTime.parse(data['startsAt'] as String),
        endsAt: data['endsAt'] == null
            ? null
            : DateTime.parse(data['endsAt'] as String),
      );
}

class AppliedPosPromotion {
  const AppliedPosPromotion(
      {required this.name,
      required this.discountTotal,
      required this.discountedQuantity});
  final String name;
  final double discountTotal;
  final int discountedQuantity;
}

class CartPricing {
  const CartPricing(
      {required this.subtotal,
      required this.discountTotal,
      required this.total,
      required this.lineDiscounts,
      required this.promotions,
      this.pendingGifts = const []});
  final List<PendingGift> pendingGifts;
  final double subtotal;
  final double discountTotal;
  final double total;
  final List<double> lineDiscounts;
  final List<AppliedPosPromotion> promotions;
}

class PendingGift {
  const PendingGift(this.variantTemplateId, this.quantity);
  final String variantTemplateId;
  final int quantity;
}
