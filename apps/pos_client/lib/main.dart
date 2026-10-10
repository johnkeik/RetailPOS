import 'dart:async';
import 'dart:ui' show AppExitResponse;

import 'package:flutter/material.dart';

import 'app/app.dart';
import 'core/firebase/firebase_config.dart';
import 'core/print_service_launcher.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializePosFirebase();
  unawaited(PrintServiceLauncher.ensureRunning());
  AppLifecycleListener(
    onExitRequested: () async {
      PrintServiceLauncher.stop();
      return AppExitResponse.exit;
    },
    onDetach: PrintServiceLauncher.stop,
  );
  runApp(const RetailPosApp());
}
