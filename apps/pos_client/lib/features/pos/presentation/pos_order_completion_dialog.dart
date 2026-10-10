import 'package:flutter/material.dart';

import '../data/label_print_service.dart';

class PosOrderCompletionDialog extends StatelessWidget {
  const PosOrderCompletionDialog({
    super.key,
    required this.orderId,
    required this.printFuture,
  });

  final String orderId;
  final Future<LabelPrintResult> printFuture;

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<LabelPrintResult>(
      future: printFuture,
      builder: (context, snapshot) {
        final printing = snapshot.connectionState != ConnectionState.done;
        final result = snapshot.data;
        final failed = result != null && !result.ok;

        return AlertDialog(
          title: const Text('Η παραγγελία ολοκληρώθηκε'),
          content: Row(
            children: [
              if (printing)
                const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 3))
              else if (failed)
                const Icon(Icons.warning_amber, color: Colors.orange)
              else
                const Icon(Icons.check_circle, color: Colors.green),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  printing
                      ? 'Εκτύπωση ετικετών…'
                      : failed
                          ? 'Η παραγγελία καταχωρήθηκε αλλά η εκτύπωση απέτυχε: ${result.message}\nΑρ. παραγγελίας: $orderId\nΜπορείτε να επαναλάβετε την εκτύπωση από το Ιστορικό.'
                          : '${result?.message ?? ''}\nΑρ. παραγγελίας: $orderId',
                ),
              ),
            ],
          ),
          actions: [
            FilledButton(
              onPressed: printing ? null : () => Navigator.of(context).pop(),
              child: const Text('Συνέχεια'),
            ),
          ],
        );
      },
    );
  }
}
