import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';

import '../../../core/firebase/firebase_config.dart';
import '../data/label_print_service.dart';
import '../data/pos_catalog_repository.dart';
import '../data/pos_order_repository.dart';
import '../models/pos_models.dart';
import 'pos_expense_page.dart';
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
    this.labelPrintService,
  });

  final PosCatalogRepository catalogRepository;
  final PosOrderRepository orderRepository;
  final String tenantId;
  final String employeeId;
  final String employeeName;
  final VoidCallback? onEndSession;
  final LabelPrintService? labelPrintService;

  @override
  State<PosHomePage> createState() => _PosHomePageState();
}

class _PosHomePageState extends State<PosHomePage> {
  late final LabelPrintService _labelPrinter =
      widget.labelPrintService ?? LabelPrintService();
  final List<CartLine> _cartLines = <CartLine>[];
  final TextEditingController _searchController = TextEditingController();
  List<String> _categories = const ['All'];
  List<ProductItem> _products = const [];

  String _selectedCategory = 'All';
  String _codeBuffer = '';
  String? _selectedProductId;
  String? _selectedVariantId;
  bool _useSpecialBottle = false;
  bool _loadingCatalog = true;
  String? _catalogError;
  bool _submittingOrder = false;
  PaymentMethod _selectedPaymentMethod = PaymentMethod.cash;

  @override
  void initState() {
    super.initState();
    _loadCatalog();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
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
        _catalogError = 'Αποτυχία φόρτωσης καταλόγου Firestore.';
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

    final query = _codeBuffer.trim().toLowerCase();
    return byCategory
        .where(
          (item) =>
              item.code.toLowerCase().contains(query) ||
              item.name.toLowerCase().contains(query) ||
              item.variants
                  .any((variant) => variant.code.toLowerCase().contains(query)),
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

    if (product.variants.isNotEmpty) {
      return product.variants.first;
    }

    return null;
  }

  double get _total {
    return _cartLines.fold(
        0.0, (sum, line) => sum + (line.unitPrice * line.quantity));
  }

  String _categoryLabel(String category) {
    return category == 'All' ? 'Όλα' : category;
  }

  Future<void> _confirmEndSession() async {
    if (widget.onEndSession == null) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Αλλαγή υπαλλήλου'),
        content: const Text('Θέλετε να τερματίσετε τη τρέχουσα συνεδρία;'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Άκυρο')),
          FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Τερματισμός')),
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
                    OutlinedButton.styleFrom(minimumSize: const Size(56, 56)),
                onPressed: _showOrderHistory,
                icon: const Icon(Icons.history),
                label: const Text('Ιστορικό'),
              ),
              OutlinedButton.icon(
                style:
                    OutlinedButton.styleFrom(minimumSize: const Size(56, 56)),
                onPressed: _showExpenses,
                icon: const Icon(Icons.receipt_long_outlined),
                label: const Text('Έξοδα'),
              ),
              OutlinedButton.icon(
                style:
                    OutlinedButton.styleFrom(minimumSize: const Size(56, 56)),
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
      _searchController.text = _codeBuffer;
      _syncSelectedFromFilter();
    });
  }

  void _backspaceCode() {
    if (_codeBuffer.isEmpty) {
      return;
    }

    setState(() {
      _codeBuffer = _codeBuffer.substring(0, _codeBuffer.length - 1);
      _searchController.text = _codeBuffer;
      _syncSelectedFromFilter();
    });
  }

  void _clearCode() {
    setState(() {
      _codeBuffer = '';
      _searchController.clear();
      _syncSelectedFromFilter();
    });
  }

  void _syncSelectedFromFilter() {
    if (_filteredProducts.isEmpty) {
      _selectedProductId = null;
      _selectedVariantId = null;
      _useSpecialBottle = false;
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
      _useSpecialBottle = false;
      _syncSelectedVariant();
    });
  }

  void _syncSelectedVariant() {
    final product = _selectedProduct;
    if (product == null || product.variants.isEmpty) {
      _selectedVariantId = null;
      _useSpecialBottle = false;
      return;
    }

    final currentExists = _selectedVariantId != null &&
        product.variants.any((variant) => variant.id == _selectedVariantId);

    if (!currentExists) {
      _selectedVariantId = product.variants.first.id;
    }

    final currentVariant = product.variants.firstWhere(
      (v) => v.id == _selectedVariantId,
      orElse: () => product.variants.first,
    );

    if (!currentVariant.hasSpecialBottle) {
      _useSpecialBottle = false;
    }
  }

  void _selectVariant(ProductVariant variant) {
    setState(() {
      _selectedVariantId = variant.id;
      if (!variant.hasSpecialBottle) {
        _useSpecialBottle = false;
      }
    });
  }

  void _addSelectedToCart() {
    final selected = _selectedProduct;
    final variant = _selectedVariant;
    if (selected == null || variant == null) {
      return;
    }

    final useSpecial = _useSpecialBottle && variant.hasSpecialBottle;

    setState(() {
      final existingIndex = _cartLines.indexWhere(
        (line) =>
            line.product.id == selected.id &&
            line.variant.id == variant.id &&
            line.useSpecialBottle == useSpecial,
      );
      if (existingIndex == -1) {
        _cartLines.add(
          CartLine(
            product: selected,
            variant: variant,
            quantity: 1,
            useSpecialBottle: useSpecial,
          ),
        );
      } else {
        final existing = _cartLines[existingIndex];
        _cartLines[existingIndex] = CartLine(
          product: existing.product,
          variant: existing.variant,
          quantity: existing.quantity + 1,
          useSpecialBottle: existing.useSpecialBottle,
        );
      }

      _useSpecialBottle = false;
    });
  }

  void _incrementLine(CartLine line) {
    setState(() {
      final index = _cartLines.indexWhere(
        (item) =>
            item.product.id == line.product.id &&
            item.variant.id == line.variant.id &&
            item.useSpecialBottle == line.useSpecialBottle,
      );
      if (index == -1) {
        return;
      }

      _cartLines[index] = CartLine(
        product: line.product,
        variant: line.variant,
        quantity: line.quantity + 1,
        useSpecialBottle: line.useSpecialBottle,
      );
    });
  }

  void _decrementLine(CartLine line) {
    setState(() {
      final index = _cartLines.indexWhere(
        (item) =>
            item.product.id == line.product.id &&
            item.variant.id == line.variant.id &&
            item.useSpecialBottle == line.useSpecialBottle,
      );
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
          useSpecialBottle: line.useSpecialBottle,
        );
      }
    });
  }

  Widget _paymentMethodOption({
    required PaymentMethod method,
    required String label,
    required IconData icon,
  }) {
    final isSelected = _selectedPaymentMethod == method;
    final colors = Theme.of(context).colorScheme;

    return Expanded(
      child: Semantics(
        button: true,
        selected: isSelected,
        label: label,
        onTap: _submittingOrder
            ? null
            : () => setState(() => _selectedPaymentMethod = method),
        child: ExcludeSemantics(
          child: Material(
            key: ValueKey('payment-${method.name}'),
            color: isSelected ? colors.secondary : Colors.transparent,
            child: InkWell(
              onTap: _submittingOrder
                  ? null
                  : () => setState(() => _selectedPaymentMethod = method),
              child: SizedBox.expand(
                child: Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.max,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        icon,
                        size: 20,
                        color: isSelected ? colors.onSecondary : colors.onSurface,
                      ),
                      const SizedBox(width: 8),
                      Flexible(child: Text(
                        label,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: isSelected ? colors.onSecondary : colors.onSurface,
                        ),
                      )),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
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
        paymentMethod: _selectedPaymentMethod,
      );

      if (!mounted) {
        return;
      }

      final printItems = _cartLines.map((line) => line.toPrintItem()).toList();
      final printFuture =
          _labelPrinter.printItems(orderId: orderId, items: printItems);

      setState(() {
        _cartLines.clear();
        _submittingOrder = false;
      });

      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => PosOrderCompletionDialog(
          orderId: orderId,
          printFuture: printFuture,
        ),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() => _submittingOrder = false);

      await showDialog<void>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          icon: const Icon(Icons.error_outline, color: Colors.red),
          title: const Text('Δεν ολοκληρώθηκε η παραγγελία'),
          content: SingleChildScrollView(
            child: Text(_orderFailureMessage(error)),
          ),
          actions: [
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Εντάξει'),
            ),
          ],
        ),
      );
    }
  }

  String _orderFailureMessage(Object error) {
    if (error is FirebaseFunctionsException) {
      switch (error.code) {
        case 'failed-precondition':
          return error.message ??
              'Δεν υπάρχει επαρκές απόθεμα για τα προϊόντα της παραγγελίας.';
        case 'unauthenticated':
          return 'Η σύνδεσή σας έληξε. Συνδεθείτε ξανά και δοκιμάστε.';
        case 'permission-denied':
          return 'Δεν έχετε δικαίωμα να καταχωρήσετε αυτή την παραγγελία.';
        case 'unavailable':
          return 'Δεν ήταν δυνατή η σύνδεση με τον server. Ελέγξτε τη σύνδεσή σας.';
        case 'invalid-argument':
          return 'Τα στοιχεία της παραγγελίας δεν είναι έγκυρα. Ελέγξτε το καλάθι και δοκιμάστε ξανά.';
      }

      final message = error.message?.trim();
      return message == null || message.isEmpty
          ? 'Σφάλμα διακομιστή (${error.code}).'
          : 'Σφάλμα διακομιστή (${error.code}): $message';
    }

    return 'Παρουσιάστηκε σφάλμα (${error.runtimeType}) κατά την καταχώρηση. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.';
  }

  Future<void> _showExpenses() async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PosExpensePage(
          repository: widget.orderRepository,
          tenantId: widget.tenantId,
          employeeId: widget.employeeId,
          employeeName: widget.employeeName,
        ),
      ),
    );
    if (saved == true && mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Το έξοδο καταχωρήθηκε.')));
    }
  }

  Future<void> _showOrderHistory() async {
    await showDialog<void>(
      context: context,
      builder: (_) => PosOrderHistoryDialog(
        repository: widget.orderRepository,
        tenantId: widget.tenantId,
        employeeId: widget.employeeId,
        labelPrinter: _labelPrinter,
        products: _products,
      ),
    );
  }

  Widget _buildKeypadButton({
    required String label,
    required VoidCallback onTap,
    required double fontSize,
    bool enabled = true,
  }) {
    return FilledButton.tonal(
      onPressed: enabled ? onTap : null,
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        padding: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: fontSize, fontWeight: FontWeight.w800),
      ),
    );
  }

  Widget _buildKeypadGrid({required double fontSize, required double gap}) {
    Widget buildRow(
      String left,
      String center,
      String right,
      VoidCallback onLeft,
      VoidCallback onCenter,
      VoidCallback onRight,
    ) {
      return Expanded(
        child: Row(
          children: [
            Expanded(
              child: _buildKeypadButton(
                  label: left, onTap: onLeft, fontSize: fontSize),
            ),
            SizedBox(width: gap),
            Expanded(
              child: _buildKeypadButton(
                  label: center, onTap: onCenter, fontSize: fontSize),
            ),
            SizedBox(width: gap),
            Expanded(
              child: _buildKeypadButton(
                  label: right, onTap: onRight, fontSize: fontSize),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.35),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withOpacity(0.18),
        ),
      ),
      child: Column(
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
          buildRow('⌫', '0', 'C', _backspaceCode, () => _appendDigit('0'),
              _clearCode),
        ],
      ),
    );
  }

  Widget _buildVariantListItem({
    required ProductVariant variant,
    required bool isSelected,
    required ColorScheme colors,
  }) {
    final isBulk = variant.type == ProductVariantType.bulk;
    final hasSpecial = variant.hasSpecialBottle;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _selectVariant(variant),
        borderRadius: BorderRadius.circular(10),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          constraints: const BoxConstraints(minHeight: 72),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: isSelected
                ? colors.primaryContainer.withOpacity(0.55)
                : colors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected
                  ? colors.primary
                  : colors.outline.withOpacity(0.2),
              width: isSelected ? 2.0 : 1.0,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: colors.primary.withOpacity(0.12),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            children: [
              // Selection Indicator
              Icon(
                isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
                color: isSelected ? colors.primary : colors.outline.withOpacity(0.5),
                size: 20,
              ),
              const SizedBox(width: 10),

              // Size & Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isBulk
                      ? const Color(0xFFE0F2FE)
                      : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  isBulk ? 'ΧΥΜΑ' : 'ΣΥΣΚ.',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: isBulk
                        ? const Color(0xFF0369A1)
                        : const Color(0xFF475569),
                  ),
                ),
              ),
              const SizedBox(width: 10),

              // Name, Size, Recipe & Special
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      variant.name,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: isSelected ? colors.primary : colors.onSurface,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 1),
                    Wrap(
                      spacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          variant.label,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: colors.onSurfaceVariant,
                          ),
                        ),
                        if (isBulk && variant.recipeSummary.isNotEmpty)
                          Text(
                            '• ${variant.recipeSummary}',
                            style: TextStyle(
                              fontSize: 11,
                              color: colors.onSurfaceVariant.withOpacity(0.85),
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          )
                        else if (hasSpecial)
                          Text(
                            '• ✨ Special (+€${variant.specialBottleExtraPrice?.toStringAsFixed(0)})',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.amber.shade800,
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ],
                ),
              ),

              // Price
              Text(
                '€${variant.price.toStringAsFixed(2)}',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: isSelected ? colors.primary : colors.onSurface,
                ),
              ),
            ],
          ),
        ),
      ),
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
              colors.primaryContainer.withOpacity(0.15),
            ],
          ),
        ),
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final isWideScreen = constraints.maxWidth >= 1300;
              final railWidth = isWideScreen ? 120.0 : 100.0;
              final horizontalGap = isWideScreen ? 14.0 : 10.0;
              const categoryLabelSize = 13.0;

              final selectedProd = _selectedProduct;
              final selectedVar = _selectedVariant;
              final variants = _selectedProductVariants;

              final double effectiveAddPrice = selectedVar == null
                  ? 0.0
                  : (selectedVar.price +
                      ((_useSpecialBottle && selectedVar.hasSpecialBottle)
                          ? (selectedVar.specialBottleExtraPrice ?? 0.0)
                          : 0.0));

              return Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _buildSessionBar(colors),
                    const SizedBox(height: 10),
                    Expanded(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // ── COLUMN 1: CATEGORIES RAIL ───────────────────────
                          SizedBox(
                            width: railWidth,
                            child: ListView.separated(
                              itemCount: _categories.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (context, index) {
                                final category = _categories[index];
                                final isSelected =
                                    _selectedCategory == category;
                                return SizedBox(
                                  height: 64,
                                  child: FilledButton.tonal(
                                    style: FilledButton.styleFrom(
                                      backgroundColor: isSelected
                                          ? colors.primary
                                          : colors.surface,
                                      foregroundColor: isSelected
                                          ? colors.onPrimary
                                          : colors.onSurface,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                        side: BorderSide(
                                          color: isSelected
                                              ? colors.primary
                                              : colors.outline.withOpacity(0.2),
                                        ),
                                      ),
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
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
                          SizedBox(width: horizontalGap),

                          // ── COLUMN 2: PRODUCTS BROWSER & FAST SEARCH ────────
                          Expanded(
                            flex: 5,
                            child: Card(
                              margin: EdgeInsets.zero,
                              child: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    const Text(
                                      'Προϊόντα',
                                      style: TextStyle(
                                        fontSize: 20,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 8),
                                    TextField(
                                      controller: _searchController,
                                      decoration: InputDecoration(
                                        hintText: 'Κωδικός ή όνομα...',
                                        prefixIcon:
                                            const Icon(Icons.search, size: 20),
                                        suffixIcon: _codeBuffer.isNotEmpty
                                            ? IconButton(
                                                tooltip: 'Καθαρισμός αναζήτησης',
                                                icon: const Icon(Icons.clear,
                                                    size: 24),
                                                onPressed: _clearCode,
                                              )
                                            : null,
                                        constraints: const BoxConstraints(minHeight: 64),
                                        contentPadding:
                                            const EdgeInsets.symmetric(
                                                horizontal: 12, vertical: 16),
                                        border: OutlineInputBorder(
                                          borderRadius:
                                              BorderRadius.circular(8),
                                        ),
                                      ),
                                      onChanged: (val) {
                                        setState(() {
                                          _codeBuffer = val;
                                          _syncSelectedFromFilter();
                                        });
                                      },
                                    ),
                                    const SizedBox(height: 8),
                                    Expanded(
                                      child: _loadingCatalog
                                          ? const Center(
                                              child: CircularProgressIndicator())
                                          : _catalogError != null
                                              ? Center(
                                                  child: Column(
                                                    mainAxisSize:
                                                        MainAxisSize.min,
                                                    children: [
                                                      Text(_catalogError!),
                                                      const SizedBox(
                                                          height: 10),
                                                      FilledButton.tonal(
                                                        onPressed: _loadCatalog,
                                                        child: const Text(
                                                            'Επανάληψη'),
                                                      ),
                                                    ],
                                                  ),
                                                )
                                              : _filteredProducts.isEmpty
                                                  ? const Center(
                                                      child: Text(
                                                          'Δεν βρέθηκαν προϊόντα.'))
                                                  : ListView.separated(
                                                      itemCount:
                                                          _filteredProducts
                                                              .length,
                                                      separatorBuilder:
                                                          (_, __) =>
                                                              const Divider(
                                                                  height: 1),
                                                      itemBuilder:
                                                          (context, index) {
                                                        final product =
                                                            _filteredProducts[
                                                                index];
                                                        final isSelected =
                                                            product.id ==
                                                                selectedProd
                                                                    ?.id;
                                                        return ListTile(
                                                          dense: false,
                                                          minVerticalPadding: 12,
                                                          selected: isSelected,
                                                          selectedTileColor: colors
                                                              .primaryContainer
                                                              .withOpacity(
                                                                  0.35),
                                                          shape:
                                                              RoundedRectangleBorder(
                                                            borderRadius:
                                                                BorderRadius
                                                                    .circular(
                                                                        8),
                                                          ),
                                                          onTap: () =>
                                                              _selectProduct(
                                                                  product),
                                                          title: Text(
                                                            product.name,
                                                            style: TextStyle(
                                                              fontWeight:
                                                                  isSelected
                                                                      ? FontWeight
                                                                          .w800
                                                                      : FontWeight
                                                                          .w600,
                                                            ),
                                                          ),
                                                          subtitle: Text(
                                                            '${product.code} · ${product.variants.length} παραλλαγές',
                                                            style: TextStyle(
                                                              color: colors
                                                                  .onSurfaceVariant,
                                                              fontSize: 12,
                                                            ),
                                                          ),
                                                          trailing: isSelected
                                                              ? Icon(
                                                                  Icons
                                                                      .chevron_right,
                                                                  color: colors
                                                                      .primary)
                                                              : null,
                                                        );
                                                      },
                                                    ),
                                    ),
                                    const SizedBox(height: 8),
                                    // ── Permanent Touch Keypad ───────────────
                                    SizedBox(
                                      height: 272,
                                      child: _buildKeypadGrid(
                                        fontSize: 24,
                                        gap: 8,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          SizedBox(width: horizontalGap),

                          // ── COLUMN 3: DEDICATED VARIANTS & RECIPE HUB ────────
                          Expanded(
                            flex: 4,
                            child: Card(
                              margin: EdgeInsets.zero,
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: selectedProd == null
                                    ? const Center(
                                        child: Text(
                                          'Επιλέξτε προϊόν για εμφάνιση παραλλαγών',
                                          style: TextStyle(fontSize: 16),
                                        ),
                                      )
                                    : Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.stretch,
                                        children: [
                                          // Product Header in Variants Hub
                                          Container(
                                            padding: const EdgeInsets.all(12),
                                            decoration: BoxDecoration(
                                              color: colors.surfaceContainerHighest
                                                  .withOpacity(0.35),
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                            child: Row(
                                              children: [
                                                Expanded(
                                                  child: Column(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment
                                                            .start,
                                                    children: [
                                                      Text(
                                                        selectedProd.name,
                                                        style: const TextStyle(
                                                          fontSize: 20,
                                                          fontWeight:
                                                              FontWeight.w800,
                                                        ),
                                                        maxLines: 1,
                                                        overflow: TextOverflow
                                                            .ellipsis,
                                                      ),
                                                      const SizedBox(height: 2),
                                                      Text(
                                                        'Κωδικός: ${selectedProd.code} · ${selectedProd.category}',
                                                        style: TextStyle(
                                                          fontSize: 12,
                                                          color: colors
                                                              .onSurfaceVariant,
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                Container(
                                                  padding: const EdgeInsets
                                                      .symmetric(
                                                      horizontal: 8,
                                                      vertical: 4),
                                                  decoration: BoxDecoration(
                                                    color: colors.primary,
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            6),
                                                  ),
                                                  child: Text(
                                                    '${variants.length} επιλογές',
                                                    style: TextStyle(
                                                      color: colors.onPrimary,
                                                      fontSize: 12,
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(height: 12),

                                          // Section Title
                                          Row(
                                            children: [
                                              const Expanded(
                                                child: Text(
                                                  'Παραλλαγές',
                                                  style: TextStyle(
                                                    fontSize: 16,
                                                    fontWeight: FontWeight.w700,
                                                  ),
                                                ),
                                              ),
                                              Text(
                                                '${variants.length} επιλογές',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  color: colors.secondary,
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 8),

                                          // Variants Touch List
                                          Expanded(
                                            child: variants.isEmpty
                                                ? const Center(
                                                    child: Text(
                                                        'Δεν υπάρχουν συνδεδεμένες παραλλαγές.'))
                                                : ListView.separated(
                                                    itemCount: variants.length,
                                                    separatorBuilder: (_, __) =>
                                                        const SizedBox(height: 6),
                                                    itemBuilder:
                                                        (context, index) {
                                                      final v = variants[index];
                                                      final isSelected = v.id ==
                                                          selectedVar?.id;
                                                      return _buildVariantListItem(
                                                        variant: v,
                                                        isSelected: isSelected,
                                                        colors: colors,
                                                      );
                                                    },
                                                  ),
                                          ),

                                          // Special Bottle Toggle (if supported)
                                          if (selectedVar != null &&
                                              selectedVar.hasSpecialBottle) ...[
                                            const SizedBox(height: 8),
                                            InkWell(
                                              onTap: () {
                                                setState(() =>
                                                    _useSpecialBottle =
                                                        !_useSpecialBottle);
                                              },
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                              child: AnimatedContainer(
                                                duration: const Duration(
                                                    milliseconds: 150),
                                                constraints: const BoxConstraints(minHeight: 72),
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        horizontal: 12,
                                                        vertical: 8),
                                                decoration: BoxDecoration(
                                                  color: _useSpecialBottle
                                                      ? Colors.amber.shade100
                                                      : Colors.amber.shade50,
                                                  borderRadius:
                                                      BorderRadius.circular(10),
                                                  border: Border.all(
                                                    color: _useSpecialBottle
                                                        ? Colors.amber.shade700
                                                        : Colors.amber.shade300,
                                                    width: _useSpecialBottle
                                                        ? 2.0
                                                        : 1.0,
                                                  ),
                                                ),
                                                child: Row(
                                                  children: [
                                                    Icon(
                                                      Icons.auto_awesome,
                                                      color:
                                                          Colors.amber.shade800,
                                                      size: 24,
                                                    ),
                                                    const SizedBox(width: 10),
                                                    Expanded(
                                                      child: Column(
                                                        crossAxisAlignment:
                                                            CrossAxisAlignment
                                                                .start,
                                                        children: [
                                                          Text(
                                                            'Special Μπουκάλι (+€${selectedVar.specialBottleExtraPrice?.toStringAsFixed(2)})',
                                                            style: TextStyle(
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w700,
                                                              color: Colors
                                                                  .amber
                                                                  .shade900,
                                                              fontSize: 14,
                                                            ),
                                                          ),
                                                          Text(
                                                            'Χρήση ειδικού μπουκαλιού πολυτελείας αντί του απλού',
                                                            style: TextStyle(
                                                              fontSize: 11,
                                                              color: Colors
                                                                  .amber
                                                                  .shade900
                                                                  .withOpacity(
                                                                      0.8),
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                    Switch(
                                                      value: _useSpecialBottle,
                                                      activeColor:
                                                          Colors.amber.shade900,
                                                      onChanged: (val) {
                                                        setState(() =>
                                                            _useSpecialBottle =
                                                                val);
                                                      },
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            ),
                                          ],

                                          const SizedBox(height: 10),

                                          // Primary Add to Cart Action Button
                                          SizedBox(
                                            height: 64,
                                            child: FilledButton(
                                              style: FilledButton.styleFrom(
                                                shape: RoundedRectangleBorder(
                                                  borderRadius:
                                                      BorderRadius.circular(10),
                                                ),
                                              ),
                                              onPressed: selectedVar == null
                                                  ? null
                                                  : _addSelectedToCart,
                                              child: Row(
                                                mainAxisAlignment:
                                                    MainAxisAlignment.center,
                                                children: [
                                                  const Icon(
                                                      Icons.add_shopping_cart,
                                                      size: 20),
                                                  const SizedBox(width: 8),
                                                  Flexible(
                                                    child: Text(
                                                      selectedVar == null
                                                          ? 'Επιλέξτε παραλλαγή'
                                                          : 'Προσθήκη — €${effectiveAddPrice.toStringAsFixed(2)}',
                                                      style: const TextStyle(
                                                        fontSize: 16,
                                                        fontWeight:
                                                            FontWeight.w700,
                                                      ),
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                              ),
                            ),
                          ),
                          SizedBox(width: horizontalGap),

                          // ── COLUMN 4: ORDER / CART & CHECKOUT ────────────────
                          Expanded(
                            flex: 4,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 4,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    const Text(
                                      'Παραγγελία',
                                      style: TextStyle(
                                        fontSize: 24,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    if (_cartLines.isNotEmpty)
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: colors.primary,
                                          borderRadius:
                                              BorderRadius.circular(12),
                                        ),
                                        child: Text(
                                          '${_cartLines.length}',
                                          style: TextStyle(
                                            color: colors.onPrimary,
                                            fontWeight: FontWeight.w700,
                                            fontSize: 12,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Expanded(
                                  child: Card(
                                    margin: EdgeInsets.zero,
                                    child: _cartLines.isEmpty
                                        ? const Center(
                                            child: Text(
                                              'Το καλάθι είναι άδειο',
                                              style: TextStyle(fontSize: 16),
                                            ),
                                          )
                                        : ListView.separated(
                                            padding: const EdgeInsets.all(8),
                                            itemCount: _cartLines.length,
                                            separatorBuilder: (_, __) =>
                                                const Divider(height: 1),
                                            itemBuilder: (context, index) {
                                              final line = _cartLines[index];
                                              final lineTotal = line.total;

                                              return Padding(
                                                padding: const EdgeInsets.symmetric(vertical: 12),
                                                child: Column(
                                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                                  children: [
                                                    Text(line.product.name,
                                                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                                                    const SizedBox(height: 4),
                                                    Text(
                                                      '${line.variant.name} (${line.variant.label}) · €${line.unitPrice.toStringAsFixed(2)}',
                                                      style: TextStyle(fontSize: 13, color: colors.onSurfaceVariant),
                                                    ),
                                                    if (line.useSpecialBottle)
                                                      Text(
                                                        '✨ Special Μπουκάλι (+€${line.variant.specialBottleExtraPrice?.toStringAsFixed(2)})',
                                                        style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
                                                      ),
                                                    const SizedBox(height: 8),
                                                    Row(
                                                      children: [
                                                        IconButton.outlined(
                                                          tooltip: line.quantity == 1 ? 'Αφαίρεση προϊόντος' : 'Μείωση ποσότητας',
                                                          onPressed: () => _decrementLine(line),
                                                          icon: Icon(line.quantity == 1 ? Icons.delete_outline : Icons.remove,
                                                            color: line.quantity == 1 ? colors.error : null),
                                                        ),
                                                        SizedBox(width: 36,
                                                          child: Text('${line.quantity}', textAlign: TextAlign.center,
                                                            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800))),
                                                        IconButton.outlined(
                                                          tooltip: 'Αύξηση ποσότητας',
                                                          onPressed: () => _incrementLine(line),
                                                          icon: const Icon(Icons.add),
                                                        ),
                                                        const SizedBox(width: 8),
                                                        Expanded(
                                                          child: Text('€${lineTotal.toStringAsFixed(2)}',
                                                            textAlign: TextAlign.right,
                                                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                                                        ),
                                                      ],
                                                    ),
                                                  ],
                                                ),
                                              );
                                            },
                                          ),
                                  ),
                                ),
                                const SizedBox(height: 8),

                                // Totals Card
                                Card(
                                  margin: EdgeInsets.zero,
                                  child: Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Column(
                                      children: [
                                        Wrap(
                                          alignment: WrapAlignment.spaceBetween,
                                          crossAxisAlignment: WrapCrossAlignment.center,
                                          spacing: 12,
                                          runSpacing: 4,
                                          children: [
                                            const Text(
                                              'ΣΥΝΟΛΟ',
                                              style: TextStyle(
                                                fontSize: 22,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                            Text(
                                              '€${_total.toStringAsFixed(2)}',
                                              style: TextStyle(
                                                fontSize: 26,
                                                fontWeight: FontWeight.w900,
                                                color: colors.primary,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 8),

                                SizedBox(
                                  height: 64,
                                  child: DecoratedBox(
                                    position: DecorationPosition.foreground,
                                    decoration: BoxDecoration(
                                      border: Border.all(color: colors.outline),
                                      borderRadius: BorderRadius.circular(28),
                                    ),
                                    child: ClipRRect(
                                      borderRadius: BorderRadius.circular(28),
                                      child: Row(
                                        children: [
                                          _paymentMethodOption(
                                            method: PaymentMethod.card,
                                            label: 'Κάρτα',
                                            icon: Icons.credit_card,
                                          ),
                                          Container(
                                            width: 1,
                                            color: colors.outline,
                                          ),
                                          _paymentMethodOption(
                                            method: PaymentMethod.cash,
                                            label: 'Μετρητά',
                                            icon: Icons.payments_outlined,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 8),

                                // Complete Sale Button
                                SizedBox(
                                  height: 64,
                                  child: FilledButton(
                                    style: FilledButton.styleFrom(
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
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
                                                width: 22,
                                                height: 22,
                                                child:
                                                    CircularProgressIndicator(
                                                  strokeWidth: 2.5,
                                                  color: Colors.white,
                                                ),
                                              ),
                                              SizedBox(width: 12),
                                              Text(
                                                'Ολοκλήρωση παραγγελίας…',
                                                style: TextStyle(fontSize: 16),
                                              ),
                                            ],
                                          )
                                        : Text(
                                            'Ολοκλήρωση Πώλησης (€${_total.toStringAsFixed(2)})',
                                            style: const TextStyle(
                                              fontSize: 18,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
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
