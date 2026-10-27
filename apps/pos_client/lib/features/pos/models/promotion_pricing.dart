import 'pos_models.dart';
import 'promotion_models.dart';
export 'promotion_models.dart';

class _Bucket {
  _Bucket(this.variant, this.cents);
  final String variant;
  final int cents;
  final lines = <int>[];
}

class _Move {
  _Move(this.promotion, this.used, this.discounted, this.discount);
  final int promotion;
  final List<int> used;
  final int discounted;
  final int discount;
}

class _Plan {
  const _Plan(this.score, [this.move, this.next]);
  final int score;
  final _Move? move;
  final _Plan? next;
}

// Keep this allocation algorithm in parity with promotion-allocation.ts.
// Equal-price units share a bucket; independent offer components are solved separately.
CartPricing priceCart(List<CartLine> lines, List<PosPromotion> promotions,
    {DateTime? now}) {
  final time = now ?? DateTime.now();
  final active = promotions.where((p) => p.appliesAt(time)).toList()
    ..sort((a, b) => a.id.compareTo(b.id));
  final buckets = <_Bucket>[];
  for (var line = 0; line < lines.length; line++) {
    final item = lines[line];
    final cents = (item.unitPrice * 100).round();
    var index = buckets
        .indexWhere((b) => b.variant == item.variant.id && b.cents == cents);
    if (index < 0) {
      index = buckets.length;
      buckets.add(_Bucket(item.variant.id, cents));
    }
    buckets[index].lines.addAll(List.filled(item.quantity, line));
  }
  final eligible = active
      .map((p) => [
            for (var i = 0; i < buckets.length; i++)
              if (p.variantTemplateIds.contains(buckets[i].variant)) i
          ])
      .toList();
  final gifts = active
      .map((p) => [
            for (var i = 0; i < buckets.length; i++)
              if (p.kind == 'GIFT_VARIANT' &&
                  buckets[i].variant == p.giftVariantTemplateId)
                i
          ])
      .toList();
  final involved = [
    for (var i = 0; i < active.length; i++) [...eligible[i], ...gifts[i]]
  ];
  final remaining = buckets.map((b) => b.lines.length).toList();
  final moves = <_Move>[];
  final seen = <int>{};
  int ascending(int a, int b) => buckets[a].cents == buckets[b].cents
      ? a.compareTo(b)
      : buckets[a].cents.compareTo(buckets[b].cents);
  int descending(int a, int b) => buckets[a].cents == buckets[b].cents
      ? a.compareTo(b)
      : buckets[b].cents.compareTo(buckets[a].cents);
  for (var start = 0; start < active.length; start++) {
    if (seen.contains(start)) continue;
    final component = [start];
    seen.add(start);
    for (var at = 0; at < component.length; at++) {
      final current = component[at];
      for (var other = 0; other < active.length; other++) {
        if (!seen.contains(other) &&
            involved[current].any(involved[other].contains)) {
          seen.add(other);
          component.add(other);
        }
      }
    }
    component.sort();
    if (component.length == 1) {
      final p = active[start];
      final units = [
        for (final i in eligible[start]) ...List.filled(remaining[i], i)
      ]..sort(descending);
      final giftUnits = [
        for (final i in gifts[start]) ...List.filled(remaining[i], i)
      ]..sort(descending);
      final isGift = p.kind == 'GIFT_VARIANT';
      final unitGroups = isGift
          ? [units]
          : units
              .map((i) => buckets[i].variant)
              .toSet()
              .map((variant) =>
                  units.where((i) => buckets[i].variant == variant).toList())
              .toList();
      final candidates = <_Move>[];
      for (final groupUnits in unitGroups) {
        var count = groupUnits.length ~/ p.groupSize;
        if (isGift && count > giftUnits.length) count = giftUnits.length;
        for (var group = 0; group < count; group++) {
          final used = List.filled(buckets.length, 0);
          for (final i in groupUnits.sublist(
              group * p.groupSize, (group + 1) * p.groupSize)) {
            used[i]++;
          }
          final discounted = isGift
              ? giftUnits[group]
              : groupUnits[(group + 1) * p.groupSize - 1];
          if (isGift) used[discounted]++;
          final discount = (buckets[discounted].cents *
                  (isGift ? 100 : p.discountPercent) /
                  100)
              .round();
          if (discount > 0) {
            candidates.add(_Move(start, used, discounted, discount));
          }
        }
      }
      final selected = p.repeat || candidates.isEmpty
          ? candidates
          : [
              candidates.reduce(
                  (best, move) => move.discount > best.discount ? move : best)
            ];
      for (final move in selected) {
        moves.add(move);
        for (var i = 0; i < move.used.length; i++) {
          remaining[i] -= move.used[i];
        }
      }
      continue;
    }
    final indices = component.expand((i) => involved[i]).toSet().toList()
      ..sort();
    final memo = <String, _Plan>{};
    _Plan solve(List<int> counts, List<bool> once) {
      final key =
          '${indices.map((i) => counts[i]).join(',')}/${once.map((v) => v ? '1' : '0').join()}';
      final cached = memo[key];
      if (cached != null) return cached;
      var best = const _Plan(0);
      for (var local = 0; local < component.length; local++) {
        final pi = component[local];
        final p = active[pi];
        if (once[local]) continue;
        final choices = eligible[pi].where((i) => counts[i] > 0).toList();
        if (choices.fold<int>(0, (sum, i) => sum + counts[i]) < p.groupSize) {
          continue;
        }
        final giftChoices = gifts[pi].where((i) => counts[i] > 0).toList();
        if (p.kind == 'GIFT_VARIANT' && giftChoices.isEmpty) continue;
        final used = List.filled(counts.length, 0);
        void visit(int at, int needed) {
          if (needed == 0) {
            if (p.kind != 'GIFT_VARIANT' &&
                choices
                        .where((i) => used[i] > 0)
                        .map((i) => buckets[i].variant)
                        .toSet()
                        .length >
                    1) return;
            final purchased = choices.where((i) => used[i] > 0).toList()
              ..sort(ascending);
            final targets =
                p.kind == 'GIFT_VARIANT' ? giftChoices : [purchased.first];
            for (final discounted in targets) {
              final discount = (buckets[discounted].cents *
                      (p.kind == 'GIFT_VARIANT' ? 100 : p.discountPercent) /
                      100)
                  .round();
              if (discount <= 0) continue;
              if (p.kind == 'GIFT_VARIANT') used[discounted]++;
              final nextCounts = [
                for (var i = 0; i < counts.length; i++) counts[i] - used[i]
              ];
              final nextOnce = [...once];
              if (!p.repeat) nextOnce[local] = true;
              final next = solve(nextCounts, nextOnce);
              if (discount + next.score > best.score) {
                best = _Plan(discount + next.score,
                    _Move(pi, [...used], discounted, discount), next);
              }
              if (p.kind == 'GIFT_VARIANT') used[discounted]--;
            }
            return;
          }
          if (at >= choices.length ||
              choices.skip(at).fold<int>(0, (sum, i) => sum + counts[i]) <
                  needed) return;
          final i = choices[at];
          for (var q = counts[i] < needed ? counts[i] : needed; q >= 0; q--) {
            used[i] = q;
            visit(at + 1, needed - q);
          }
          used[i] = 0;
        }

        visit(0, p.groupSize);
      }
      memo[key] = best;
      return best;
    }

    _Plan? plan = solve([...remaining], List.filled(component.length, false));
    while (plan?.move != null) {
      final move = plan!.move!;
      moves.add(move);
      for (var i = 0; i < move.used.length; i++) {
        remaining[i] -= move.used[i];
      }
      plan = plan.next;
    }
  }
  final discounts = List.filled(lines.length, 0);
  final offsets = List.filled(buckets.length, 0);
  final totals = List.filled(active.length, 0);
  final quantities = List.filled(active.length, 0);
  for (final move in moves) {
    final b = move.discounted;
    discounts[buckets[b].lines[offsets[b]]] += move.discount;
    for (var i = 0; i < move.used.length; i++) {
      offsets[i] += move.used[i];
    }
    totals[move.promotion] += move.discount;
    quantities[move.promotion]++;
  }
  final pending = <PendingGift>[];
  for (var i = 0; i < active.length; i++) {
    final p = active[i];
    if (p.kind != 'GIFT_VARIANT' ||
        p.giftVariantTemplateId == null ||
        (!p.repeat && quantities[i] > 0)) continue;
    final available = eligible[i].fold<int>(0, (sum, b) => sum + remaining[b]);
    var quantity = available ~/ p.groupSize;
    if (!p.repeat && quantity > 1) quantity = 1;
    if (quantity > 0) {
      pending.add(PendingGift(p.giftVariantTemplateId!, quantity));
    }
  }
  final subtotal = lines.fold<int>(
      0, (sum, l) => sum + (l.unitPrice * 100).round() * l.quantity);
  final discount = discounts.fold<int>(0, (sum, value) => sum + value);
  return CartPricing(
      subtotal: subtotal / 100,
      discountTotal: discount / 100,
      total: (subtotal - discount) / 100,
      lineDiscounts: discounts.map((cents) => cents / 100).toList(),
      promotions: [
        for (var i = 0; i < active.length; i++)
          if (quantities[i] > 0)
            AppliedPosPromotion(
                name: active[i].name,
                discountTotal: totals[i] / 100,
                discountedQuantity: quantities[i])
      ],
      pendingGifts: pending);
}
