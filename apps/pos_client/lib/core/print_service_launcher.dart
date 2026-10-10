import 'dart:io';

import 'package:http/http.dart' as http;

import '../features/pos/data/label_print_service.dart';

// Starts print-service\MiniPOS.PrintService.exe (shipped next to the POS exe) unless one already answers.
class PrintServiceLauncher {
  PrintServiceLauncher._();

  static Process? _process;

  static Future<void> ensureRunning() async {
    if (!Platform.isWindows || _process != null || await _isHealthy()) return;

    final exeDir = File(Platform.resolvedExecutable).parent.path;
    final service = File('$exeDir\\print-service\\MiniPOS.PrintService.exe');
    if (!await service.exists()) return;

    try {
      final process = await Process.start(
        service.path,
        const [],
        workingDirectory: service.parent.path,
      );
      // Unread pipes would eventually block the service.
      process.stdout.drain<void>();
      process.stderr.drain<void>();
      _process = process;
    } catch (_) {
      // Printing then reports "service not found"; the POS keeps working.
    }
  }

  static void stop() {
    _process?.kill();
    _process = null;
  }

  static Future<bool> _isHealthy() async {
    try {
      final response = await http
          .get(Uri.parse('$kPrintServiceUrl/health'))
          .timeout(const Duration(seconds: 2));
      return response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
