import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';

class PosFirebaseConfig {
  const PosFirebaseConfig._();

  static const FirebaseOptions webOptions = FirebaseOptions(
    apiKey: 'AIzaSyA5fgbHc2iHMMuQTKqM2sbztAHEqLa0skw',
    appId: '1:675049225203:web:7a89428072bc814671b086',
    messagingSenderId: '675049225203',
    projectId: 'pos-inventorysaas',
    storageBucket: 'pos-inventorysaas.firebasestorage.app',
    authDomain: 'pos-inventorysaas.firebaseapp.com',
  );

  static const FirebaseOptions appleOptions = FirebaseOptions(
    apiKey: 'AIzaSyDAo5L6vOIpK5Wo0BbZTt06WIe_z2tAfnw',
    appId: '1:675049225203:ios:da474e39dde77f8f71b086',
    messagingSenderId: '675049225203',
    projectId: 'pos-inventorysaas',
    storageBucket: 'pos-inventorysaas.firebasestorage.app',
  );

  static FirebaseOptions get options {
    if (kIsWeb) return webOptions;
    if (defaultTargetPlatform == TargetPlatform.iOS ||
        defaultTargetPlatform == TargetPlatform.macOS) {
      return appleOptions;
    }
    return webOptions;
  }

  // Production by default; local dev: --dart-define=POS_USE_EMULATORS=true
  static const bool useEmulators =
      bool.fromEnvironment('POS_USE_EMULATORS', defaultValue: false);
  static const String emulatorHost = '127.0.0.1';
  static const int firestorePort = 8080;
  static const int functionsPort = 5001;
}

bool _firestoreEmulatorConfigured = false;
bool _functionsEmulatorConfigured = false;
bool _authEmulatorConfigured = false;

Future<void> initializePosFirebase() async {
  final app = Firebase.apps.isEmpty
      ? await Firebase.initializeApp(options: PosFirebaseConfig.options)
      : Firebase.app();

  if (!PosFirebaseConfig.useEmulators) {
    return;
  }

  if (!_authEmulatorConfigured) {
    await FirebaseAuth.instanceFor(app: app).useAuthEmulator(
      PosFirebaseConfig.emulatorHost,
      9099,
    );
    _authEmulatorConfigured = true;
  }

  if (!_firestoreEmulatorConfigured) {
    FirebaseFirestore.instanceFor(app: app).useFirestoreEmulator(
      PosFirebaseConfig.emulatorHost,
      PosFirebaseConfig.firestorePort,
    );
    _firestoreEmulatorConfigured = true;
  }

  if (!_functionsEmulatorConfigured) {
    FirebaseFunctions.instanceFor(app: app).useFunctionsEmulator(
      PosFirebaseConfig.emulatorHost,
      PosFirebaseConfig.functionsPort,
    );
    _functionsEmulatorConfigured = true;
  }
}
