import '../models/pos_models.dart';

abstract class PosCatalogRepository {
  Future<PosCatalog> loadCatalog(String tenantId);
}