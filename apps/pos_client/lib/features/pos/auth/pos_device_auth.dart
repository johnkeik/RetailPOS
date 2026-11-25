import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../../../core/firebase/firebase_config.dart';

/// Safe diagnostics: never includes credentials, tokens or backend response bodies.
class PosActivationException implements Exception {
  const PosActivationException(this.stage, this.code);
  final String stage;
  final String code;
  @override
  String toString() => 'POS activation failed: $stage/$code';
}

class PosEmployeeSession {
  const PosEmployeeSession(this.id, this.name);
  final String id;
  final String name;
}

abstract class PosDeviceAuth {
  String? get tenantId;
  Future<bool> restore();
  Future<void> activate(String email, String password);
  Future<PosEmployeeSession> loginEmployee(String code);
  Future<void> lock();
}

/// Only a device credential is stored. Manager passwords are never persisted.
class FirebasePosDeviceAuth implements PosDeviceAuth {
  String? _tenantId;
  @override
  String? get tenantId => _tenantId;
  final _storage = const FlutterSecureStorage();
  FirebaseAuth get _auth => FirebaseAuth.instance;
  String get _key =>
      'pos-device-${PosFirebaseConfig.options.projectId}-${PosFirebaseConfig.useEmulators ? 'emulator' : 'cloud'}';

  Future<Map<String, dynamic>> _call(String name, Map<String, dynamic> data,
      {bool authenticated = true}) async {
    final project = PosFirebaseConfig.options.projectId;
    final uri = PosFirebaseConfig.useEmulators
        ? Uri.http(
            '${PosFirebaseConfig.emulatorHost}:${PosFirebaseConfig.functionsPort}',
            '/$project/us-central1/$name')
        : Uri.https('us-central1-$project.cloudfunctions.net', '/$name');
    final token = authenticated ? await _auth.currentUser?.getIdToken() : null;
    final response = await http
        .post(uri,
            headers: {
              'Content-Type': 'application/json',
              if (token != null) 'Authorization': 'Bearer $token',
            },
            body: jsonEncode({'data': data}))
        .timeout(const Duration(seconds: 30));
    final body = jsonDecode(response.body) as Map<String, dynamic>;
    if (body['error'] != null) {
      final error = body['error'] as Map;
      throw FirebaseAuthException(
        code: error['status'] as String? ?? 'unknown',
        message: error['message'] as String?,
      );
    }
    if (response.statusCode != 200) throw StateError('Service unavailable');
    return Map<String, dynamic>.from(body['result'] as Map);
  }

  @override
  Future<bool> restore() async {
    // Never restore a manager or a previous employee session from SDK persistence.
    await _auth.signOut();
    _tenantId = null;
    final saved = await _storage.read(key: _key);
    if (saved == null) return false;
    try {
      final credential = Map<String, dynamic>.from(jsonDecode(saved) as Map);
      final result =
          await _call('resumePosDevice', credential, authenticated: false);
      await _auth.signInWithCustomToken(result['token'] as String);
      _tenantId = result['tenantId'] as String;
      return true;
    } on FirebaseAuthException catch (error) {
      if (['PERMISSION_DENIED', 'UNAUTHENTICATED', 'INVALID_ARGUMENT']
          .contains(error.code)) {
        await _storage.delete(key: _key);
        return false;
      }
      rethrow;
    }
  }

  @override
  Future<void> activate(String email, String password) async {
    var stage = 'manager-sign-in';
    try {
      await _auth.signInWithEmailAndPassword(
          email: email.trim(), password: password);
      stage = 'device-registration';
      final result = await _call('activatePosDevice', {'name': 'Shop PC'});
      stage = 'manager-sign-out';
      await _auth.signOut();
      stage = 'secure-storage';
      await _storage.write(
          key: _key,
          value: jsonEncode({
            'tenantId': result['tenantId'],
            'deviceId': result['deviceId'],
            'secret': result['secret'],
          }));
      stage = 'device-sign-in';
      await _auth.signInWithCustomToken(result['token'] as String);
      _tenantId = result['tenantId'] as String;
    } catch (error) {
      final code = error is FirebaseAuthException
          ? error.code
          : error is PlatformException
              ? error.code
              : error.runtimeType.toString();
      final failure = PosActivationException(stage, code);
      debugPrint(failure.toString());
      try {
        await _auth.signOut();
      } catch (_) {
        debugPrint('POS activation cleanup sign-out failed.');
      }
      throw failure;
    }
  }

  @override
  Future<PosEmployeeSession> loginEmployee(String code) async {
    final result = await _call(
        'startPosEmployeeSession', {'tenantId': tenantId, 'code': code});
    await _auth.signInWithCustomToken(result['token'] as String);
    return PosEmployeeSession(
        result['employeeId'] as String, result['employeeName'] as String);
  }

  @override
  Future<void> lock() async {
    if (!await restore()) throw StateError('Activation required');
  }
}
