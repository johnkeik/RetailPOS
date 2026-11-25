import '../features/pos/auth/pos_device_auth.dart';
import 'package:flutter/material.dart';

import '../core/theme/app_theme.dart';
import '../features/pos/data/cloud_functions_pos_order_repository.dart';
import '../features/pos/data/firestore_pos_catalog_repository.dart';
import '../features/pos/data/pos_catalog_repository.dart';
import '../features/pos/data/pos_order_repository.dart';
import '../features/pos/presentation/employee_session_gate.dart';

class RetailPosApp extends StatelessWidget {
  const RetailPosApp({
    super.key,
    this.catalogRepository,
    this.orderRepository,
    this.deviceAuth,
  });

  final PosCatalogRepository? catalogRepository;
  final PosOrderRepository? orderRepository;
  final PosDeviceAuth? deviceAuth;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ταμειο Λιανικης',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: EmployeeSessionGate(
        auth: deviceAuth,
        catalogRepository: catalogRepository ?? FirestorePosCatalogRepository(),
        orderRepository: orderRepository ?? CloudFunctionsPosOrderRepository(),
      ),
    );
  }
}
