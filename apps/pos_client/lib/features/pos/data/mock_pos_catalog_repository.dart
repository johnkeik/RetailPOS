import '../models/pos_models.dart';
import 'mock_pos_data.dart';
import 'pos_catalog_repository.dart';

class MockPosCatalogRepository implements PosCatalogRepository {
  const MockPosCatalogRepository();

  @override
  Future<PosCatalog> loadCatalog(String tenantId) async {
    return const PosCatalog(
      categories: kPosCategories,
      products: kMockProducts,
    );
  }
}