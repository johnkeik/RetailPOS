import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class FullscreenToggleButton extends StatefulWidget {
  const FullscreenToggleButton({super.key});

  @override
  State<FullscreenToggleButton> createState() => _FullscreenToggleButtonState();
}

class _FullscreenToggleButtonState extends State<FullscreenToggleButton> {
  bool _isFullscreen = true;

  Future<void> _toggleFullscreen() async {
    try {
      final isFullscreen = await const MethodChannel('pos_client/window')
          .invokeMethod<bool>('toggleFullscreen');
      if (mounted && isFullscreen != null) {
        setState(() => _isFullscreen = isFullscreen);
      }
    } on PlatformException {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Δεν ήταν δυνατή η αλλαγή μεγέθους παραθύρου.'),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    return IconButton.filledTonal(
      tooltip: _isFullscreen
          ? 'Έξοδος από πλήρη οθόνη'
          : 'Ενεργοποίηση πλήρους οθόνης',
      onPressed: _toggleFullscreen,
      icon: Icon(_isFullscreen ? Icons.fullscreen_exit : Icons.fullscreen),
      iconSize: 32,
      constraints: const BoxConstraints.tightFor(width: 56, height: 56),
      style: IconButton.styleFrom(
        backgroundColor: Colors.white,
        foregroundColor: Theme.of(context).colorScheme.primary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
