import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_core/firebase_core.dart';

// Baked into the build per store, e.g.:
//   flutter build apk --dart-define=POS_TENANT_ID=store007
// One tenant == one store for the current MVP scope (see docs/MVP_SCOPE.md).
const String kPosTenantId = String.fromEnvironment('POS_TENANT_ID', defaultValue: 'store001');

class PosFirebaseConfig {
  const PosFirebaseConfig._();

  static const FirebaseOptions options = FirebaseOptions(
    apiKey: 'demo-api-key',
    appId: '1:1234567890:ios:321abc456def7890',
    messagingSenderId: '1234567890',
    projectId: 'pos-inventorysaas',
    storageBucket: 'pos-inventorysaas.appspot.com',
    authDomain: 'pos-inventorysaas.firebaseapp.com',
  );

  static const bool useEmulators = true;
  static const String emulatorHost = '127.0.0.1';
  static const int firestorePort = 8080;
  static const int functionsPort = 5001;
}

bool _firestoreEmulatorConfigured = false;
bool _functionsEmulatorConfigured = false;

Future<void> initializePosFirebase() async {
  final app = Firebase.apps.isEmpty
      ? await Firebase.initializeApp(options: PosFirebaseConfig.options)
      : Firebase.app();

  if (!PosFirebaseConfig.useEmulators) {
    return;
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