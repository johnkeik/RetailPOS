import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/pos_models.dart';

// Local MiniPOS.PrintService; override per machine with --dart-define=POS_PRINT_SERVICE_URL=...
const String kPrintServiceUrl = String.fromEnvironment(
  'POS_PRINT_SERVICE_URL',
  defaultValue: 'http://localhost:5050',
);

class LabelPrintItem {
  const LabelPrintItem({
    required this.productCode,
    required this.ingredients,
    required this.quantity,
  });

  final String productCode;
  final String ingredients;
  final int quantity;

  Map<String, Object> toJson() => {
        'productCode': productCode,
        'ingredients': ingredients,
        'quantity': quantity,
      };
}

class LabelPrintResult {
  const LabelPrintResult({required this.ok, required this.message});

  final bool ok;
  final String message;
}

class LabelPrintService {
  LabelPrintService({http.Client? client, String? baseUrl})
      : _client = client ?? http.Client(),
        _baseUrl = baseUrl ?? kPrintServiceUrl;

  final http.Client _client;
  final String _baseUrl;

  /// Never throws; products without ingredients (e.g. room fragrances) get no labels.
  Future<LabelPrintResult> printItems({
    required String orderId,
    required List<LabelPrintItem> items,
  }) async {
    final printable =
        items.where((item) => item.ingredients.trim().isNotEmpty).toList();
    final skipped = items.length - printable.length;
    final skippedNote =
        skipped > 0 ? ' ($skipped προϊόντα χωρίς συστατικά δεν εκτυπώθηκαν)' : '';

    if (printable.isEmpty) {
      return LabelPrintResult(
        ok: items.isEmpty || skipped > 0,
        message: 'Δεν υπάρχουν ετικέτες για εκτύπωση.',
      );
    }

    try {
      final response = await _client
          .post(
            Uri.parse('$_baseUrl/api/labels/print'),
            headers: {'Content-Type': 'application/json; charset=utf-8'},
            body: jsonEncode({
              'orderId': orderId,
              'items': printable.map((item) => item.toJson()).toList(),
            }),
          )
          .timeout(const Duration(seconds: 30));

      final body = _decode(response.bodyBytes);
      if (response.statusCode == 200) {
        final count = body['labelsSubmitted'];
        return LabelPrintResult(
          ok: true,
          message: 'Στάλθηκαν ${count ?? ''} ετικέτες στον εκτυπωτή.$skippedNote',
        );
      }

      return LabelPrintResult(
        ok: false,
        message: body['message'] as String? ??
            'Η υπηρεσία εκτύπωσης επέστρεψε σφάλμα (${response.statusCode}).',
      );
    } on TimeoutException {
      return const LabelPrintResult(
          ok: false, message: 'Η υπηρεσία εκτύπωσης δεν απάντησε εγκαίρως.');
    } catch (_) {
      return const LabelPrintResult(
        ok: false,
        message:
            'Δεν βρέθηκε η υπηρεσία εκτύπωσης. Ελέγξτε ότι το MiniPOS.PrintService τρέχει.',
      );
    }
  }

  static Map<String, dynamic> _decode(List<int> bytes) {
    try {
      final decoded = jsonDecode(utf8.decode(bytes));
      return decoded is Map<String, dynamic> ? decoded : const {};
    } catch (_) {
      return const {};
    }
  }
}

extension CartLinePrintItem on CartLine {
  LabelPrintItem toPrintItem() => LabelPrintItem(
        productCode: product.code,
        ingredients: product.ingredients,
        quantity: quantity,
      );
}
