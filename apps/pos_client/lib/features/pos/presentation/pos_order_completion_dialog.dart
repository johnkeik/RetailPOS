import 'dart:async';

import 'package:flutter/material.dart';

class PosOrderCompletionDialog extends StatefulWidget {
  const PosOrderCompletionDialog({super.key, required this.orderId});

  final String orderId;

  @override
  State<PosOrderCompletionDialog> createState() =>
      _PosOrderCompletionDialogState();
}

class _PosOrderCompletionDialogState extends State<PosOrderCompletionDialog> {
  bool _printing = true;

  @override
  void initState() {
    super.initState();
    unawaited(_finishDummyPrint());
  }

  Future<void> _finishDummyPrint() async {
    await Future<void>.delayed(const Duration(seconds: 5));
    if (mounted) setState(() => _printing = false);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Η παραγγελία ολοκληρώθηκε'),
      content: Row(
        children: [
          if (_printing)
            const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 3))
          else
            const Icon(Icons.check_circle, color: Colors.green),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              _printing
                  ? 'Εκτύπωση ετικετών…'
                  : 'Η δοκιμαστική εκτύπωση ολοκληρώθηκε. Αρ. παραγγελίας: ${widget.orderId}',
            ),
          ),
        ],
      ),
      actions: [
        FilledButton(
          onPressed: _printing ? null : () => Navigator.of(context).pop(),
          child: const Text('Συνέχεια'),
        ),
      ],
    );
  }
}
