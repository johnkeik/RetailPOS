import 'package:flutter/material.dart';

import 'app/app.dart';
import 'core/firebase/firebase_config.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializePosFirebase();
  runApp(const RetailPosApp());
}
