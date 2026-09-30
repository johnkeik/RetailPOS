import 'package:flutter/material.dart';

import '../../../core/firebase/firebase_config.dart';
import '../data/pos_catalog_repository.dart';
import '../data/pos_order_repository.dart';
import '../models/pos_models.dart';
import 'pos_order_completion_dialog.dart';
import 'pos_order_history_dialog.dart';

class PosHomePage extends StatefulWidget {
  const PosHomePage({
    super.key,
    required this.catalogRepository,
    required this.orderRepository,
    required this.employeeId,
    required this.employeeName,
    this.tenantId = kPosTenantId,
    this.onEndSession,
  });

  final PosCatalogRepository catalogRepository;
  final PosOrderRepository orderRepository;
  final String tenantId;
  final String employeeId;
  final String employeeName;
  final VoidCallback? onEndSession;

  @override
  State<PosHomePage> createState() => _PosHomePageState();
}

class _PosHomePageState extends State<PosHomePage> {
  final List<CartLine> _cartLines = <CartLine>[];
  List<String> _categories = const ['All'];
  List<ProductItem> _products = const [];

  String _selectedCategory = 'All';
  String _codeBuffer = '';
  String? _selectedProductId;
  String? _selectedVariantId;
  bool _loadingCatalog = true;
  String? _catalogError;
  bool _submittingOrder = false;

  @override
  void initState() {
    super.initState();
    _loadCatalog();
  }

  Future<void> _loadCatalog() async {
    setState(() {
      _loadingCatalog = true;
      _catalogError = null;
    });

    try {
      final catalog =
          await widget.catalogRepository.loadCatalog(widget.tenantId);
      if (!mounted) {
        return;
      }

      setState(() {
        _categories =
            catalog.categories.isEmpty ? const ['All'] : catalog.categories;
        _products = catalog.products;
        _selectedCategory =
            _categories.contains(_selectedCategory) ? _selectedCategory : 'All';
        _loadingCatalog = false;
        _catalogError = null;
        _syncSelectedFromFilter();
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _loadingCatalog = false;
        _catalogError = 'Αποτυχια φορτωσης καταλογου Firestore.';
        _products = const [];
        _categories = const ['All'];
        _selectedProductId = null;
        _selectedVariantId = null;
      });
    }
  }

  List<ProductItem> get _filteredProducts {
    final byCategory = _selectedCategory == 'All'
        ? _products
        : _products
            .where((item) => item.category == _selectedCategory)
            .toList();

    if (_codeBuffer.isEmpty) {
      return byCategory;
    }

    return byCategory
        .where(
          (item) =>
              item.code.contains(_codeBuffer) ||
              item.name.toLowerCase().contains(_codeBuffer.toLowerCase()) ||
              item.variants
                  .any((variant) => variant.code.contains(_codeBuffer)),
        )
        .toList();
  }

  ProductItem? get _selectedProduct {
    final selected = _products.where((item) => item.id == _selectedProductId);
    if (selected.isNotEmpty) {
      return selected.first;
    }

    if (_filteredProducts.isNotEmpty) {
      return _filteredProducts.first;
    }

    return null;
  }

  List<ProductVariant> get _selectedProductVariants {
    final product = _selectedProduct;
    if (product == null) {
      return const <ProductVariant>[];
    }

    return product.variants;
  }

  ProductVariant? get _selectedVariant {
    final product = _selectedProduct;
    if (product == null) {
      return null;
    }

    final selected =
        product.variants.where((item) => item.id == _selectedVariantId);
    if (selected.isNotEmpty) {
      return selected.first;
    }

    if (product.variants.length == 1) {
      return product.variants.first;
    }

    return null;
  }

  double get _subtotal {
    return _cartLines.fold(
        0, (sum, line) => sum + (line.variant.price * line.quantity));
  }

  double get _tax {
    return _subtotal * 0.24;
  }

  double get _total {
    return _subtotal + _tax;
  }

  String _categoryLabel(String category) {
    return category == 'All' ? 'Ολα' : category;
  }

  Future<void> _confirmEndSession() async {
    if (widget.onEndSession == null) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Αλλαγη υπαλληλου'),
        content: const Text('Θελετε να τερματισετε τη τρεχουσα συνεδρια;'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Ακυρο')),
          FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Τερματισμος')),
        ],
      ),
    );

    if (confirmed == true) {
      widget.onEndSession?.call();
    }
  }

  Widget _buildSessionInfo({
    required Color color,
    required IconData icon,
    required String label,
    required String value,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: color, size: 24),
        const SizedBox(width: 9),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label, style: TextStyle(fontSize: 11, color: color)),
            Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
          ],
        ),
      ],
    );
  }

  Widget _buildSessionBar(ColorScheme colors) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.outline.withOpacity(0.22)),
      ),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 20,
        runSpacing: 12,
        children: [
          Wrap(
            spacing: 28,
            runSpacing: 10,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _buildSessionInfo(
                color: colors.primary,
                icon: Icons.person_outline,
                label: 'ΥΠΑΛΛΗΛΟΣ',
                value: widget.employeeName,
              ),
              _buildSessionInfo(
                color: colors.secondary,
                icon: Icons.store_outlined,
                label: 'ΚΑΤΑΣΤΗΜΑ',
                value: widget.tenantId,
              ),
            ],
          ),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                style:
                    OutlinedButton.styleFrom(minimumSize: const Size(48, 52)),
                onPressed: _showOrderHistory,
                icon: const Icon(Icons.history),
                label: const Text('Ιστορικό'),
              ),
              OutlinedButton.icon(
                style:
                    OutlinedButton.styleFrom(minimumSize: const Size(48, 52)),
                onPressed:
                    widget.onEndSession == null ? null : _confirmEndSession,
                icon: const Icon(Icons.logout),
                label: const Text('Αποσύνδεση'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _appendDigit(String digit) {
    setState(() {
      _codeBuffer += digit;
      _syncSelectedFromFilter();
    });
  }

  void _backspaceCode() {
    if (_codeBuffer.isEmpty) {
      return;
    }

    setState(() {
      _codeBuffer = _codeBuffer.substring(0, _codeBuffer.length - 1);
      _syncSelectedFromFilter();
    });
  }

  void _clearCode() {
    setState(() {
      _codeBuffer = '';
      _syncSelectedFromFilter();
    });
  }

  void _syncSelectedFromFilter() {
    if (_filteredProducts.isEmpty) {
      _selectedProductId = null;
      _selectedVariantId = null;
      return;
    }

    final currentSelectionExists = _selectedProductId != null &&
        _filteredProducts.any((item) => item.id == _selectedProductId);

    if (!currentSelectionExists) {
      _selectedProductId = _filteredProducts.first.id;
    }

    _syncSelectedVariant();
  }

  void _selectProduct(ProductItem product) {
    setState(() {
      _selectedProductId = product.id;
      _syncSelectedVariant();
    });
  }

  void _syncSelectedVariant() {
    final product = _selectedProduct;
    if (product == null) {
      _selectedVariantId = null;
      return;
    }

    final currentExists = _selectedVariantId != null &&
        product.variants.any((variant) => variant.id == _selectedVariantId);

    if (currentExists) {
      return;
    }

    _selectedVariantId =
        product.variants.length == 1 ? product.variants.first.id : null;
  }

  void _selectVariant(ProductVariant variant) {
    setState(() {
      _selectedVariantId = variant.id;
    });
  }

  void _addSelectedToCart() {
    final selected = _selectedProduct;
    final variant = _selectedVariant;
    if (selected == null || variant == null) {
      return;
    }

    setState(() {
      final existingIndex = _cartLines.indexWhere(
        (line) =>
            line.product.id == selected.id && line.variant.id == variant.id,
      );
      if (existingIndex == -1) {
        _cartLines
            .add(CartLine(product: selected, variant: variant, quantity: 1));
      } else {
        final existing = _cartLines[existingIndex];
        _cartLines[existingIndex] = CartLine(
          product: existing.product,
          variant: existing.variant,
          quantity: existing.quantity + 1,
        );
      }

      _codeBuffer = '';
      _syncSelectedFromFilter();
    });
  }

  void _incrementLine(CartLine line) {
    setState(() {
      final index =
          _cartLines.indexWhere((item) => item.product.id == line.product.id);
      if (index == -1) {
        return;
      }

      _cartLines[index] = CartLine(
        product: line.product,
        variant: line.variant,
        quantity: line.quantity + 1,
      );
    });
  }

  void _decrementLine(CartLine line) {
    setState(() {
      final index =
          _cartLines.indexWhere((item) => item.product.id == line.product.id);
      if (index == -1) {
        return;
      }

      final nextQuantity = line.quantity - 1;
      if (nextQuantity <= 0) {
        _cartLines.removeAt(index);
      } else {
        _cartLines[index] = CartLine(
          product: line.product,
          variant: line.variant,
          quantity: nextQuantity,
        );
      }
    });
  }

  Map<ProductVariantType, List<ProductVariant>> get _groupedVariants {
    final variants = _selectedProductVariants;
    return <ProductVariantType, List<ProductVariant>>{
      for (final type in ProductVariantType.values)
        type: variants.where((variant) => variant.type == type).toList(),
    };
  }

  Future<void> _submitOrder() async {
    if (_cartLines.isEmpty || _submittingOrder) {
      return;
    }

    setState(() => _submittingOrder = true);

    try {
      final orderId = await widget.orderRepository.submitOrder(
        tenantId: widget.tenantId,
        employeeId: widget.employeeId,
        lines: _cartLines,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _cartLines.clear();
        _submittingOrder = false;
      });

      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => PosOrderCompletionDialog(orderId: orderId),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() => _submittingOrder = false);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Η πωληση απετυχε. Δοκιμαστε ξανα.')),
      );
    }
  }

  Future<void> _showOrderHistory() async {
    await showDialog<void>(
      context: context,
      builder: (_) => PosOrderHistoryDialog(
        repository: widget.orderRepository,
        tenantId: widget.tenantId,
      ),
    );
  }

  Widget _buildKeypadButton({
    required String label,
    required VoidCallback onTap,
    required double fontSize,
    bool enabled = true,
  }) {
    return OutlinedButton(
      onPressed: enabled ? onTap : null,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(64),
        padding: EdgeInsets.zero,
      ),
      child: Text(label,
          style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w700)),
    );
  }

  Widget _buildKeypadGrid({required double fontSize, required double gap}) {
    final canAddSelectedVariant = _selectedVariant != null;

    Widget buildRow(String left, String center, String right,
        VoidCallback onLeft, VoidCallback onCenter, VoidCallback onRight,
        {bool rightEnabled = true}) {
      return Expanded(
        child: Row(
          children: [
            Expanded(
                child: _buildKeypadButton(
                    label: left, onTap: onLeft, fontSize: fontSize)),
            SizedBox(width: gap),
            Expanded(
                child: _buildKeypadButton(
                    label: center, onTap: onCenter, fontSize: fontSize)),
            SizedBox(width: gap),
            Expanded(
              child: _buildKeypadButton(
                label: right,
                onTap: onRight,
                fontSize: fontSize,
                enabled: rightEnabled,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      children: [
        buildRow('1', '2', '3', () => _appendDigit('1'),
            () => _appendDigit('2'), () => _appendDigit('3')),
        SizedBox(height: gap),
        buildRow('4', '5', '6', () => _appendDigit('4'),
            () => _appendDigit('5'), () => _appendDigit('6')),
        SizedBox(height: gap),
        buildRow('7', '8', '9', () => _appendDigit('7'),
            () => _appendDigit('8'), () => _appendDigit('9')),
        SizedBox(height: gap),
        buildRow('⌫', '0', '→', _backspaceCode, () => _appendDigit('0'),
            _addSelectedToCart,
            rightEnabled: canAddSelectedVariant),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              colors.surface,
              colors.primaryContainer,
            ],
          ),
        ),
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final isLargeTouchscreen = constraints.maxWidth >= 1500;
              final compactTouchscreen =
                  constraints.maxWidth < 1500 || constraints.maxHeight < 800;
              final horizontalGap = isLargeTouchscreen ? 16.0 : 10.0;
              final railWidth = isLargeTouchscreen ? 138.0 : 112.0;
              final keypadHeight = compactTouchscreen ? 290.0 : 390.0;
              final keypadGap = compactTouchscreen ? 8.0 : 10.0;
              final categoryHeight = compactTouchscreen ? 68.0 : 74.0;
              final codeTextSize = compactTouchscreen ? 34.0 : 42.0;
              final keypadTextSize = compactTouchscreen ? 30.0 : 32.0;
              const categoryLabelSize = 13.0;

              return Padding(
                padding: EdgeInsets.all(isLargeTouchscreen ? 16 : 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildSessionBar(colors),
                    const SizedBox(height: 12),
                    Expanded(
                      child: Row(
                        children: [
                          SizedBox(
                            width: railWidth,
                            child: Column(
                              children: [
                                Expanded(
                                  child: ListView.separated(
                                    itemCount: _categories.length,
                                    separatorBuilder: (_, __) => SizedBox(
                                        height: compactTouchscreen ? 8 : 10),
                                    itemBuilder: (context, index) {
                                      final category = _categories[index];
                                      final isSelected =
                                          _selectedCategory == category;
                                      return SizedBox(
                                        height: categoryHeight,
                                        child: FilledButton.tonal(
                                          style: FilledButton.styleFrom(
                                            backgroundColor: isSelected
                                                ? colors.primary
                                                : colors.surface,
                                            foregroundColor: isSelected
                                                ? colors.onPrimary
                                                : colors.onSurface,
                                            shape: RoundedRectangleBorder(
                                                borderRadius:
                                                    BorderRadius.circular(10)),
                                          ),
                                          onPressed: () {
                                            setState(() {
                                              _selectedCategory = category;
                                              _syncSelectedFromFilter();
                                            });
                                          },
                                          child: Text(
                                            _categoryLabel(category),
                                            textAlign: TextAlign.center,
                                            style: const TextStyle(
                                                fontSize: categoryLabelSize,
                                                fontWeight: FontWeight.w700),
                                          ),
                                        ),
                                      );
                                    },
                                  ),
                                ),
                              ],
                            ),
                          ),
                          SizedBox(width: horizontalGap),
                          Expanded(
                            flex: 5,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  child: Row(
                                    children: [
                                      Expanded(
                                        flex: 6,
                                        child: Card(
                                          child: Padding(
                                            padding: const EdgeInsets.all(12),
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.stretch,
                                              children: [
                                                const Text('Προϊόντα',
                                                    style: TextStyle(
                                                        fontSize: 24,
                                                        fontWeight:
                                                            FontWeight.w700)),
                                                const SizedBox(height: 8),
                                                Expanded(
                                                  child: _loadingCatalog
                                                      ? const Center(
                                                          child:
                                                              CircularProgressIndicator())
                                                      : _catalogError != null
                                                          ? Center(
                                                              child: Column(
                                                                mainAxisAlignment:
                                                                    MainAxisAlignment
                                                                        .center,
                                                                children: [
                                                                  Text(
                                                                      _catalogError!),
                                                                  const SizedBox(
                                                                      height:
                                                                          12),
                                                                  FilledButton
                                                                      .tonal(
                                                                    onPressed:
                                                                        _loadCatalog,
                                                                    child: const Text(
                                                                        'Επαναληψη'),
                                                                  ),
                                                                ],
                                                              ),
                                                            )
                                                          : _filteredProducts
                                                                  .isEmpty
                                                              ? const Center(
                                                                  child: Text(
                                                                      'Δεν βρεθηκαν προιοντα.'))
                                                              : ListView
                                                                  .separated(
                                                                  itemCount:
                                                                      _filteredProducts
                                                                          .length,
                                                                  separatorBuilder: (_,
                                                                          __) =>
                                                                      const Divider(
                                                                          height:
                                                                              1),
                                                                  itemBuilder:
                                                                      (context,
                                                                          index) {
                                                                    final product =
                                                                        _filteredProducts[
                                                                            index];
                                                                    final isSelected = product
                                                                            .id ==
                                                                        _selectedProduct
                                                                            ?.id;
                                                                    return ListTile(
                                                                      selected:
                                                                          isSelected,
                                                                      selectedTileColor: colors
                                                                          .primaryContainer
                                                                          .withOpacity(
                                                                              0.4),
                                                                      onTap: () =>
                                                                          _selectProduct(
                                                                              product),
                                                                      title:
                                                                          Row(
                                                                        children: [
                                                                          SizedBox(
                                                                            width:
                                                                                90,
                                                                            child:
                                                                                Text(product.code, style: const TextStyle(fontWeight: FontWeight.w700)),
                                                                          ),
                                                                          Expanded(
                                                                              child: Text(product.name)),
                                                                        ],
                                                                      ),
                                                                    );
                                                                  },
                                                                ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        flex: 4,
                                        child: Card(
                                          child: Padding(
                                            padding: const EdgeInsets.all(12),
                                            child: _selectedProduct == null
                                                ? const Center(
                                                    child:
                                                        Text('Επιλεξτε προιον'))
                                                : Column(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment
                                                            .start,
                                                    children: [
                                                      Row(
                                                        children: [
                                                          const Text(
                                                            'Επιλογές',
                                                            style: TextStyle(
                                                                fontSize: 20,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w700),
                                                          ),
                                                          const SizedBox(
                                                              width: 10),
                                                          if (_selectedVariant ==
                                                              null)
                                                            Expanded(
                                                              child: Text(
                                                                'Επιλέξτε επιλογή',
                                                                style: TextStyle(
                                                                    color: colors
                                                                        .secondary),
                                                              ),
                                                            ),
                                                        ],
                                                      ),
                                                      const SizedBox(
                                                          height: 10),
                                                      Expanded(
                                                        child: ListView(
                                                          children: ProductVariantType
                                                              .values
                                                              .where((type) =>
                                                                  _groupedVariants[
                                                                          type]!
                                                                      .isNotEmpty)
                                                              .map((type) {
                                                            final variants =
                                                                _groupedVariants[
                                                                    type]!;
                                                            return Padding(
                                                              padding:
                                                                  const EdgeInsets
                                                                      .only(
                                                                      bottom:
                                                                          12),
                                                              child: Container(
                                                                padding:
                                                                    const EdgeInsets
                                                                        .all(
                                                                        10),
                                                                decoration:
                                                                    BoxDecoration(
                                                                  color: colors
                                                                      .surface,
                                                                  borderRadius:
                                                                      BorderRadius
                                                                          .circular(
                                                                              12),
                                                                  border: Border.all(
                                                                      color: colors
                                                                          .outline
                                                                          .withOpacity(
                                                                              0.2)),
                                                                ),
                                                                child: Column(
                                                                  crossAxisAlignment:
                                                                      CrossAxisAlignment
                                                                          .start,
                                                                  children: [
                                                                    Text(
                                                                      type.label,
                                                                      style:
                                                                          TextStyle(
                                                                        fontSize:
                                                                            16,
                                                                        fontWeight:
                                                                            FontWeight.w700,
                                                                        color: colors
                                                                            .primary,
                                                                      ),
                                                                    ),
                                                                    const SizedBox(
                                                                        height:
                                                                            8),
                                                                    Wrap(
                                                                      spacing:
                                                                          8,
                                                                      runSpacing:
                                                                          8,
                                                                      children:
                                                                          variants
                                                                              .map((variant) {
                                                                        final isSelected =
                                                                            variant.id ==
                                                                                _selectedVariant?.id;
                                                                        return ChoiceChip(
                                                                          showCheckmark:
                                                                              false,
                                                                          backgroundColor:
                                                                              colors.surface,
                                                                          selectedColor:
                                                                              colors.secondary,
                                                                          side:
                                                                              BorderSide(color: colors.outline.withOpacity(0.35)),
                                                                          label:
                                                                              Text(
                                                                            '${variant.label}  €${variant.price.toStringAsFixed(2)}',
                                                                            style:
                                                                                const TextStyle(fontWeight: FontWeight.w700),
                                                                          ),
                                                                          selected:
                                                                              isSelected,
                                                                          onSelected: (_) =>
                                                                              _selectVariant(variant),
                                                                        );
                                                                      }).toList(),
                                                                    ),
                                                                  ],
                                                                ),
                                                              ),
                                                            );
                                                          }).toList(),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 12),
                                Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            _codeBuffer.isEmpty
                                                ? 'Κωδ. προιοντος'
                                                : _codeBuffer,
                                            style: TextStyle(
                                                fontSize: codeTextSize,
                                                fontWeight: FontWeight.w700),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        OutlinedButton(
                                            style: OutlinedButton.styleFrom(
                                                minimumSize:
                                                    const Size(120, 56)),
                                            onPressed: _clearCode,
                                            child: const Text('Καθαρισμος')),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                SizedBox(
                                  height: keypadHeight,
                                  child: _buildKeypadGrid(
                                      fontSize: keypadTextSize, gap: keypadGap),
                                ),
                              ],
                            ),
                          ),
                          SizedBox(width: horizontalGap),
                          Expanded(
                            flex: 4,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                const Text('Παραγγελία',
                                    style: TextStyle(
                                        fontSize: 30,
                                        fontWeight: FontWeight.w700)),
                                const SizedBox(height: 8),
                                Expanded(
                                  child: Card(
                                    child: _cartLines.isEmpty
                                        ? const Center(
                                            child:
                                                Text('Δεν υπαρχουν ειδη ακομα'))
                                        : ListView.separated(
                                            padding: const EdgeInsets.all(8),
                                            itemCount: _cartLines.length,
                                            separatorBuilder: (_, __) =>
                                                const Divider(height: 1),
                                            itemBuilder: (context, index) {
                                              final line = _cartLines[index];
                                              final lineTotal =
                                                  line.variant.price *
                                                      line.quantity;
                                              return Padding(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        vertical: 8),
                                                child: Row(
                                                  children: [
                                                    Expanded(
                                                      child: Column(
                                                        crossAxisAlignment:
                                                            CrossAxisAlignment
                                                                .start,
                                                        children: [
                                                          Text(
                                                            line.product.name,
                                                            style: const TextStyle(
                                                                fontSize: 18,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w700),
                                                          ),
                                                          const SizedBox(
                                                              height: 4),
                                                          Text(
                                                            '${line.variant.type.label} - ${line.variant.label}',
                                                            style:
                                                                const TextStyle(
                                                                    fontSize:
                                                                        16),
                                                          ),
                                                          const SizedBox(
                                                              height: 2),
                                                          Text(
                                                            '€${line.variant.price.toStringAsFixed(2)}',
                                                            style:
                                                                const TextStyle(
                                                                    fontSize:
                                                                        16),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                    IconButton(
                                                      onPressed: () =>
                                                          _decrementLine(line),
                                                      iconSize: 32,
                                                      style:
                                                          IconButton.styleFrom(
                                                              minimumSize:
                                                                  const Size(
                                                                      52, 52)),
                                                      icon: const Icon(Icons
                                                          .remove_circle_outline),
                                                    ),
                                                    SizedBox(
                                                      width: 36,
                                                      child: Text(
                                                        '${line.quantity}',
                                                        textAlign:
                                                            TextAlign.center,
                                                        style: const TextStyle(
                                                            fontSize: 20,
                                                            fontWeight:
                                                                FontWeight
                                                                    .w700),
                                                      ),
                                                    ),
                                                    IconButton(
                                                      onPressed: () =>
                                                          _incrementLine(line),
                                                      iconSize: 32,
                                                      style:
                                                          IconButton.styleFrom(
                                                              minimumSize:
                                                                  const Size(
                                                                      52, 52)),
                                                      icon: const Icon(Icons
                                                          .add_circle_outline),
                                                    ),
                                                    SizedBox(
                                                      width: 96,
                                                      child: Text(
                                                        '€${lineTotal.toStringAsFixed(2)}',
                                                        textAlign:
                                                            TextAlign.right,
                                                        style: const TextStyle(
                                                            fontSize: 20,
                                                            fontWeight:
                                                                FontWeight
                                                                    .w700),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              );
                                            },
                                          ),
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Card(
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                      children: [
                                        Row(
                                          children: [
                                            const Text('Υποσυνολο',
                                                style: TextStyle(
                                                    fontSize: 17,
                                                    fontWeight:
                                                        FontWeight.w600)),
                                            const Spacer(),
                                            Text(
                                              '€${_subtotal.toStringAsFixed(2)}',
                                              style: const TextStyle(
                                                  fontSize: 18,
                                                  fontWeight: FontWeight.w700),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            const Text('ΦΠΑ (24%)',
                                                style: TextStyle(
                                                    fontSize: 17,
                                                    fontWeight:
                                                        FontWeight.w600)),
                                            const Spacer(),
                                            Text(
                                              '€${_tax.toStringAsFixed(2)}',
                                              style: const TextStyle(
                                                  fontSize: 18,
                                                  fontWeight: FontWeight.w700),
                                            ),
                                          ],
                                        ),
                                        const Divider(height: 20),
                                        Row(
                                          children: [
                                            const Text('Συνολο',
                                                style: TextStyle(
                                                    fontSize: 30,
                                                    fontWeight:
                                                        FontWeight.w800)),
                                            const Spacer(),
                                            Text(
                                              '€${_total.toStringAsFixed(2)}',
                                              style: const TextStyle(
                                                  fontSize: 34,
                                                  fontWeight: FontWeight.w800),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 10),
                                SizedBox(
                                  height: 62,
                                  child: FilledButton(
                                    onPressed:
                                        _cartLines.isEmpty || _submittingOrder
                                            ? null
                                            : _submitOrder,
                                    child: _submittingOrder
                                        ? const Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.center,
                                            children: [
                                              SizedBox(
                                                  width: 24,
                                                  height: 24,
                                                  child:
                                                      CircularProgressIndicator(
                                                          strokeWidth: 3)),
                                              SizedBox(width: 12),
                                              Text('Ολοκλήρωση παραγγελίας…',
                                                  style:
                                                      TextStyle(fontSize: 18)),
                                            ],
                                          )
                                        : const Text('Συνεχεια',
                                            style: TextStyle(
                                                fontSize: 24,
                                                fontWeight: FontWeight.w700)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
