import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../data/label_print_service.dart';
import '../data/pos_catalog_repository.dart';
import '../data/pos_order_repository.dart';
import '../models/order_tabs.dart';
import '../models/pos_models.dart';
import '../models/promotion_pricing.dart';
import 'on_screen_keyboard.dart';
import 'pos_expense_page.dart';
import 'pos_order_completion_dialog.dart';
import 'pos_order_history_dialog.dart';
import 'pos_window_controls.dart';

class PosHomePage extends StatefulWidget {
  const PosHomePage({
    super.key,
    required this.catalogRepository,
    required this.orderRepository,
    required this.employeeId,
    required this.employeeName,
    required this.tenantId,
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
  late final OrderTabsStore _tabsStore = OrderTabsStore(widget.tenantId);
  final List<OrderTab> _tabs = [OrderTab(number: 1)];
  int _activeTabIndex = 0;

  /// Saving starts only after saved tabs were restored, so an early save
  /// cannot overwrite them with the initial empty tab.
  bool _tabsRestored = false;

  OrderTab get _activeTab => _tabs[_activeTabIndex];
  List<CartLine> get _cartLines => _activeTab.lines;
  final TextEditingController _searchController = TextEditingController();
  List<String> _categories = const ['All'];
  String _giftVariantName(String id) {
    for (final product in _products) {
      for (final variant in product.variants) {
        if (variant.id == id) return variant.name;
      }
    }
    return 'παραλλαγή δώρου';
  }

  List<ProductItem> _products = const [];
  List<PosPromotion> _promotions = const [];

  String _selectedCategory = 'All';
  String _codeBuffer = '';
  String? _selectedProductId;
  String? _selectedVariantId;
  bool _useSpecialBottle = false;
  bool _loadingCatalog = true;
  String? _catalogError;
  bool _submittingOrder = false;
  double _lastDisplayedTotal = 0;
  PaymentMethod get _selectedPaymentMethod => _activeTab.paymentMethod;
  set _selectedPaymentMethod(PaymentMethod method) {
    _activeTab.paymentMethod = method;
    _saveTabs();
  }

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

      var droppedCount = 0;
      if (!_tabsRestored) {
        final restored = await _tabsStore.restore(catalog.products);
        if (!mounted) return;
        if (restored != null) {
          _tabs
            ..clear()
            ..addAll(restored.tabs);
          _activeTabIndex = restored.activeIndex;
          droppedCount += restored.droppedCount;
        }
        _tabsRestored = true;
      }

      setState(() {
        _categories =
            catalog.categories.isEmpty ? const ['All'] : catalog.categories;
        _products = catalog.products;
        _promotions = catalog.promotions;
        droppedCount += rebindOrderTabs(_tabs, _products).length;
        _selectedCategory =
            _categories.contains(_selectedCategory) ? _selectedCategory : 'All';
        _loadingCatalog = false;
        _catalogError = null;
        _syncSelectedFromFilter();
      });
      _saveTabs();
      if (droppedCount > 0) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(droppedCount == 1
              ? 'Αφαιρέθηκε 1 είδος από ανοιχτές παραγγελίες, γιατί δεν είναι πλέον διαθέσιμο.'
              : 'Αφαιρέθηκαν $droppedCount είδη από ανοιχτές παραγγελίες, γιατί δεν είναι πλέον διαθέσιμα.'),
        ));
      }
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

  CartPricing get _pricing => priceCart(_cartLines, _promotions);

  String _categoryLabel(String category) {
    return category == 'All' ? 'Όλα' : category;
  }

  void _saveTabs() {
    if (!_tabsRestored) return;
    // Fire-and-forget: a failed write must never block a sale.
    _tabsStore.save(_tabs, _activeTabIndex).catchError((Object error) {
      debugPrint('Could not save order tabs: $error');
    });
  }

  void _addTab() {
    if (_submittingOrder || _tabs.length >= maxOrderTabs) return;
    setState(() {
      _tabs.add(OrderTab(number: nextOrderTabNumber(_tabs)));
      _activeTabIndex = _tabs.length - 1;
    });
    _saveTabs();
  }

  void _switchTab(int index) {
    if (_submittingOrder || index == _activeTabIndex) return;
    setState(() => _activeTabIndex = index);
    _saveTabs();
  }

  /// Removes [tab], keeping at least one (empty) tab open.
  void _removeTab(OrderTab tab) {
    final index = _tabs.indexOf(tab);
    if (index == -1) return;
    _tabs.removeAt(index);
    if (_tabs.isEmpty) {
      _tabs.add(OrderTab(number: 1));
    }
    if (_activeTabIndex > index || _activeTabIndex >= _tabs.length) {
      _activeTabIndex = (_activeTabIndex - 1).clamp(0, _tabs.length - 1);
    }
  }

  Future<void> _closeTab(OrderTab tab) async {
    if (_submittingOrder) return;
    if (tab.lines.isNotEmpty) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text('Κλείσιμο Παραγγελίας ${tab.number}'),
          content: Text(
              'Η παραγγελία έχει ${tab.itemCount} τεμάχια. Θέλετε να την κλείσετε χωρίς ολοκλήρωση;'),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Άκυρο')),
            FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('Κλείσιμο')),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
    }
    setState(() => _removeTab(tab));
    _saveTabs();
  }

  Future<void> _confirmEndSession() async {
    if (widget.onEndSession == null) {
      return;
    }

    final openTabs = _tabs.where((tab) => tab.lines.isNotEmpty).length;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Αλλαγή υπαλλήλου'),
        content: Text(openTabs == 0
            ? 'Θέλετε να τερματίσετε τη τρέχουσα συνεδρία;'
            : 'Θέλετε να τερματίσετε τη τρέχουσα συνεδρία;\n\n'
                '${openTabs == 1 ? 'Υπάρχει 1 ανοιχτή παραγγελία' : 'Υπάρχουν $openTabs ανοιχτές παραγγελίες'}. '
                'Θα παραμείνουν αποθηκευμένες σε αυτό το ταμείο και θα πιστωθούν σε όποιον τις ολοκληρώσει.'),
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

  String _money(double value) =>
      '${value.toStringAsFixed(2).replaceAll('.', ',')} €';

  Widget _buildHeaderIconButton({
    required ColorScheme colors,
    required IconData icon,
    required String tooltip,
    required VoidCallback? onPressed,
  }) {
    // Matches FullscreenToggleButton so the header actions read as one group.
    return IconButton.filledTonal(
      tooltip: tooltip,
      onPressed: onPressed,
      icon: Icon(icon),
      iconSize: 28,
      constraints: const BoxConstraints.tightFor(width: 56, height: 56),
      style: IconButton.styleFrom(
        backgroundColor: Colors.white,
        foregroundColor: colors.primary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Widget _buildOrderTab(OrderTab tab, int index, ColorScheme colors) {
    final isActive = index == _activeTabIndex;
    final foreground = isActive ? colors.onPrimary : colors.onSurface;
    final subtitle = tab.lines.isEmpty
        ? 'Κενή'
        : '${tab.itemCount} τεμ. · ${_money(priceCart(tab.lines, _promotions).total)}';
    final canClose = tab.lines.isNotEmpty || _tabs.length > 1;

    return Material(
      key: ValueKey('order-tab-${tab.number}'),
      color: isActive ? colors.primary : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
            color: isActive ? colors.primary : colors.outline.withOpacity(0.3)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: _submittingOrder ? null : () => _switchTab(index),
        child: SizedBox(
          height: 56,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: EdgeInsets.only(left: 14, right: canClose ? 0 : 14),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Παραγγελία ${tab.number}',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: foreground,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: foreground.withOpacity(0.8),
                      ),
                    ),
                  ],
                ),
              ),
              if (canClose)
                IconButton(
                  tooltip: 'Κλείσιμο παραγγελίας',
                  onPressed: _submittingOrder ? null : () => _closeTab(tab),
                  icon: const Icon(Icons.close, size: 20),
                  color: foreground.withOpacity(0.85),
                  constraints:
                      const BoxConstraints.tightFor(width: 48, height: 56),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSessionBar(ColorScheme colors) {
    final canAddTab = !_submittingOrder && _tabs.length < maxOrderTabs;

    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.outline.withOpacity(0.22)),
      ),
      child: Row(
        children: [
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (var index = 0; index < _tabs.length; index++) ...[
                    _buildOrderTab(_tabs[index], index, colors),
                    const SizedBox(width: 6),
                  ],
                  Tooltip(
                    message: canAddTab
                        ? 'Νέα παραγγελία'
                        : 'Έως $maxOrderTabs ανοιχτές παραγγελίες',
                    child: OutlinedButton(
                      key: const ValueKey('order-tab-add'),
                      style: OutlinedButton.styleFrom(
                        minimumSize: const Size(56, 56),
                        padding: EdgeInsets.zero,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: canAddTab ? _addTab : null,
                      child: const Icon(Icons.add, size: 28),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 12),
          Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: colors.primaryContainer.withOpacity(0.35),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.person_outline, color: colors.primary, size: 22),
                const SizedBox(width: 6),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 160),
                  child: Text(
                    widget.employeeName,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _buildHeaderIconButton(
            colors: colors,
            icon: Icons.history,
            tooltip: 'Ιστορικό παραγγελιών',
            onPressed: _showOrderHistory,
          ),
          const SizedBox(width: 6),
          _buildHeaderIconButton(
            colors: colors,
            icon: Icons.receipt_long_outlined,
            tooltip: 'Έξοδα',
            onPressed: _showExpenses,
          ),
          const SizedBox(width: 6),
          _buildHeaderIconButton(
            colors: colors,
            icon: Icons.refresh,
            tooltip: 'Ανανέωση καταλόγου',
            onPressed:
                _loadingCatalog || _submittingOrder ? null : _loadCatalog,
          ),
          const SizedBox(width: 6),
          const FullscreenToggleButton(),
          const SizedBox(width: 6),
          _buildHeaderIconButton(
            colors: colors,
            icon: Icons.logout,
            tooltip: 'Αποσύνδεση',
            onPressed: widget.onEndSession == null ? null : _confirmEndSession,
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
    if (_submittingOrder) return;
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
    _saveTabs();
  }

  void _incrementLine(CartLine line) {
    if (_submittingOrder) return;
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
    _saveTabs();
  }

  void _decrementLine(CartLine line) {
    if (_submittingOrder) return;
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
    _saveTabs();
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
            color: isSelected ? colors.primaryContainer : Colors.transparent,
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
                        color: isSelected ? colors.primary : colors.onSurface,
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                          child: Text(
                        label,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: isSelected
                              ? colors.onPrimaryContainer
                              : colors.onSurface,
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

  Future<void> _editManualDiscount() async {
    final tab = _activeTab;
    final result = await showDialog<_ManualDiscountChoice>(
      context: context,
      builder: (_) => _ManualDiscountDialog(
        initial: tab.manualDiscount,
        orderTotalCents: (_pricing.total * 100).round(),
      ),
    );
    if (result == null || !mounted) return;
    setState(() => tab.manualDiscount = result.discount);
    _saveTabs();
  }

  Future<void> _submitOrder() async {
    if (_cartLines.isEmpty || _submittingOrder) {
      return;
    }

    setState(() => _submittingOrder = true);
    // Tab switching is blocked while submitting, so this stays the active tab.
    final submittedTab = _activeTab;

    try {
      final orderId = await widget.orderRepository.submitOrder(
        tenantId: widget.tenantId,
        employeeId: widget.employeeId,
        lines: _cartLines,
        paymentMethod: _selectedPaymentMethod,
        expectedTotal: _lastDisplayedTotal,
        manualDiscount: submittedTab.manualDiscount,
      );

      if (!mounted) {
        return;
      }

      final printItems = _cartLines.map((line) => line.toPrintItem()).toList();
      final printFuture =
          _labelPrinter.printItems(orderId: orderId, items: printItems);

      setState(() {
        _removeTab(submittedTab);
        _submittingOrder = false;
      });
      _saveTabs();

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
              'Ο κατάλογος άλλαξε. Ανανεώστε και ελέγξτε την παραγγελία.';
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
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Το έξοδο καταχωρήθηκε.')));
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
    final colors = Theme.of(context).colorScheme;
    return FilledButton.tonal(
      onPressed: enabled ? onTap : null,
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        padding: EdgeInsets.zero,
        backgroundColor: colors.surface,
        foregroundColor: colors.onSurface,
        side: BorderSide(color: colors.outlineVariant),
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
        color: Theme.of(context)
            .colorScheme
            .surfaceContainerHighest
            .withOpacity(0.35),
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
              color:
                  isSelected ? colors.primary : colors.outline.withOpacity(0.2),
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
                isSelected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_off,
                color: isSelected
                    ? colors.primary
                    : colors.outline.withOpacity(0.5),
                size: 20,
              ),
              const SizedBox(width: 10),

              // Size & Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isBulk
                      ? colors.primaryContainer
                      : colors.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  isBulk ? 'ΧΥΜΑ' : 'ΣΥΣΚ.',
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: isBulk ? colors.primary : colors.onSurfaceVariant,
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
    final pricing = _pricing;
    // An empty cart shows no discount line; the choice returns with items.
    final manualDiscount =
        _cartLines.isEmpty ? null : _activeTab.manualDiscount;
    final promotionTotalCents = (pricing.total * 100).round();
    final manualDiscountCents =
        manualDiscount?.amountCentsOf(promotionTotalCents) ?? 0;
    final total = (promotionTotalCents - manualDiscountCents) / 100;
    _lastDisplayedTotal = total;

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
                                                tooltip:
                                                    'Καθαρισμός αναζήτησης',
                                                icon: const Icon(Icons.clear,
                                                    size: 24),
                                                onPressed: _clearCode,
                                              )
                                            : null,
                                        constraints:
                                            const BoxConstraints(minHeight: 64),
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
                                              child:
                                                  CircularProgressIndicator())
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
                                                          minVerticalPadding:
                                                              12,
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
                                                              fontWeight: isSelected
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
                                              color: colors
                                                  .surfaceContainerHighest
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
                                                        const SizedBox(
                                                            height: 6),
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
                                                constraints:
                                                    const BoxConstraints(
                                                        minHeight: 72),
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
                                    Text(
                                      'Παραγγελία ${_activeTab.number}',
                                      style: const TextStyle(
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
                                              final lineTotal =
                                                  ((line.unitPrice * 100)
                                                                  .round() *
                                                              line.quantity -
                                                          (pricing.lineDiscounts[
                                                                      index] *
                                                                  100)
                                                              .round()) /
                                                      100;

                                              return Padding(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        vertical: 12),
                                                child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment
                                                          .stretch,
                                                  children: [
                                                    Text(line.product.name,
                                                        style: const TextStyle(
                                                            fontSize: 16,
                                                            fontWeight:
                                                                FontWeight
                                                                    .w700)),
                                                    const SizedBox(height: 4),
                                                    Text(
                                                      '${line.variant.name} (${line.variant.label}) · €${line.unitPrice.toStringAsFixed(2)}',
                                                      style: TextStyle(
                                                          fontSize: 13,
                                                          color: colors
                                                              .onSurfaceVariant),
                                                    ),
                                                    if (line.useSpecialBottle)
                                                      Text(
                                                        '✨ Special Μπουκάλι (+€${line.variant.specialBottleExtraPrice?.toStringAsFixed(2)})',
                                                        style: TextStyle(
                                                            fontSize: 12,
                                                            color: Colors.amber
                                                                .shade900),
                                                      ),
                                                    if (pricing.lineDiscounts[
                                                            index] >
                                                        0)
                                                      Text(
                                                          'Προσφορά: −€${pricing.lineDiscounts[index].toStringAsFixed(2)}',
                                                          style: TextStyle(
                                                              color: colors
                                                                  .primary,
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w700)),
                                                    const SizedBox(height: 8),
                                                    Row(
                                                      children: [
                                                        IconButton.outlined(
                                                          tooltip: line
                                                                      .quantity ==
                                                                  1
                                                              ? 'Αφαίρεση προϊόντος'
                                                              : 'Μείωση ποσότητας',
                                                          onPressed:
                                                              _submittingOrder
                                                                  ? null
                                                                  : () =>
                                                                      _decrementLine(
                                                                          line),
                                                          icon: Icon(
                                                              line.quantity == 1
                                                                  ? Icons
                                                                      .delete_outline
                                                                  : Icons
                                                                      .remove,
                                                              color:
                                                                  line.quantity ==
                                                                          1
                                                                      ? colors
                                                                          .error
                                                                      : null),
                                                        ),
                                                        SizedBox(
                                                            width: 36,
                                                            child: Text(
                                                                '${line.quantity}',
                                                                textAlign:
                                                                    TextAlign
                                                                        .center,
                                                                style: const TextStyle(
                                                                    fontSize:
                                                                        18,
                                                                    fontWeight:
                                                                        FontWeight
                                                                            .w800))),
                                                        IconButton.outlined(
                                                          tooltip:
                                                              'Αύξηση ποσότητας',
                                                          onPressed:
                                                              _submittingOrder
                                                                  ? null
                                                                  : () =>
                                                                      _incrementLine(
                                                                          line),
                                                          icon: const Icon(
                                                              Icons.add),
                                                        ),
                                                        const SizedBox(
                                                            width: 8),
                                                        Expanded(
                                                          child: Text(
                                                              '€${lineTotal.toStringAsFixed(2)}',
                                                              textAlign:
                                                                  TextAlign
                                                                      .right,
                                                              style: const TextStyle(
                                                                  fontSize: 16,
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .w700)),
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
                                        for (final gift
                                            in pricing.pendingGifts.take(2))
                                          Text(
                                              'Δικαιούται δώρο: ${gift.quantity} × ${_giftVariantName(gift.variantTemplateId)} — προσθέστε το στο καλάθι',
                                              style: TextStyle(
                                                  color: Theme.of(context)
                                                      .colorScheme
                                                      .primary,
                                                  fontWeight: FontWeight.bold)),
                                        if (pricing.discountTotal > 0 ||
                                            manualDiscount != null) ...[
                                          Text(
                                              'Αρχική αξία: €${pricing.subtotal.toStringAsFixed(2)}'),
                                          for (final promotion
                                              in pricing.promotions.take(2))
                                            Text(
                                                '${promotion.name}: −€${promotion.discountTotal.toStringAsFixed(2)}',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                    color: colors.primary,
                                                    fontWeight:
                                                        FontWeight.w700)),
                                          if (pricing.promotions.length > 2)
                                            Text(
                                                '+${pricing.promotions.length - 2} ακόμη προσφορές'),
                                          if (manualDiscount != null)
                                            Text(
                                                'Έκπτωση ${manualDiscount.details} ${manualDiscount.valueLabel}: −€${(manualDiscountCents / 100).toStringAsFixed(2)}',
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: TextStyle(
                                                    color: colors.primary,
                                                    fontWeight:
                                                        FontWeight.w700)),
                                          Text(
                                              'Συνολική έκπτωση: −€${(pricing.discountTotal + manualDiscountCents / 100).toStringAsFixed(2)}'),
                                          const SizedBox(height: 8),
                                        ],
                                        Wrap(
                                          alignment: WrapAlignment.spaceBetween,
                                          crossAxisAlignment:
                                              WrapCrossAlignment.center,
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
                                              '€${total.toStringAsFixed(2)}',
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
                                  height: 44,
                                  child: OutlinedButton.icon(
                                    onPressed:
                                        _cartLines.isEmpty || _submittingOrder
                                            ? null
                                            : _editManualDiscount,
                                    icon: const Icon(Icons.percent, size: 18),
                                    label: Text(
                                      manualDiscount == null
                                          ? 'Έκπτωση'
                                          : 'Έκπτωση: ${manualDiscount.details} ${manualDiscount.valueLabel}',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
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
                                            'Ολοκλήρωση Πώλησης (€${total.toStringAsFixed(2)})',
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

/// The dialog's answer: a discount to apply, or null to remove it.
class _ManualDiscountChoice {
  const _ManualDiscountChoice(this.discount);

  final ManualDiscount? discount;
}

class _ManualDiscountDialog extends StatefulWidget {
  const _ManualDiscountDialog({this.initial, required this.orderTotalCents});

  final ManualDiscount? initial;

  /// The total after promotions; a fixed amount cannot exceed it.
  final int orderTotalCents;

  @override
  State<_ManualDiscountDialog> createState() => _ManualDiscountDialogState();
}

class _ManualDiscountDialogState extends State<_ManualDiscountDialog> {
  static const _presets = [10, 20, 100];

  late String _details =
      widget.initial?.details ?? ManualDiscount.detailOptions.first;

  /// True when entering a fixed euro amount instead of a percentage.
  late bool _isAmount = widget.initial?.fixedAmountCents != null;

  late final TextEditingController _value = TextEditingController(
      text: widget.initial == null
          ? ''
          : widget.initial!.percentage?.toString() ??
              (widget.initial!.fixedAmountCents! / 100)
                  .toStringAsFixed(2)
                  .replaceAll('.', ','));

  int? get _parsedPercentage {
    if (_isAmount) return null;
    final value = int.tryParse(_value.text.trim());
    return value != null && value >= 1 && value <= 100 ? value : null;
  }

  /// Cents typed in amount mode, accepting "," or "." as the decimal mark.
  static int? _centsOf(String text) {
    final normalized = text.trim().replaceAll(',', '.');
    if (!RegExp(r'^\d+(\.\d{0,2})?$').hasMatch(normalized)) return null;
    return (double.parse(normalized) * 100).round();
  }

  int? get _parsedAmountCents {
    if (!_isAmount) return null;
    final cents = _centsOf(_value.text);
    return cents != null && cents >= 1 && cents <= widget.orderTotalCents
        ? cents
        : null;
  }

  bool get _canApply => _parsedPercentage != null || _parsedAmountCents != null;

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  void _selectPreset(int preset) => setState(() {
        _isAmount = false;
        _value.text = preset.toString();
      });

  void _selectAmount() => setState(() {
        if (!_isAmount) _value.clear();
        _isAmount = true;
      });

  /// Appends a numpad key, ignoring input that would leave the valid range.
  void _typeKey(String key) {
    final text = _value.text.trim();
    if (_isAmount) {
      if (key == ',' && text.contains(',')) return;
      final next = key == ',' && text.isEmpty ? '0,' : '$text$key';
      final cents = _centsOf(next);
      if (cents == null || cents > widget.orderTotalCents) return;
      setState(() => _value.text = next);
      return;
    }
    if (int.tryParse(key) == null) return;
    final next = '$text$key';
    final value = int.parse(next);
    if (value > 100 || (value == 0 && next.length > 1)) return;
    setState(() => _value.text = value.toString());
  }

  void _backspace() {
    final text = _value.text.trim();
    if (text.isEmpty) return;
    setState(() => _value.text = text.substring(0, text.length - 1));
  }

  void _apply() {
    final percentage = _parsedPercentage;
    final amountCents = _parsedAmountCents;
    if (percentage == null && amountCents == null) return;
    Navigator.of(context).pop(_ManualDiscountChoice(ManualDiscount(
        percentage: percentage,
        fixedAmountCents: amountCents,
        details: _details)));
  }

  @override
  Widget build(BuildContext context) {
    final percentage = _parsedPercentage;
    final maxAmount = (widget.orderTotalCents / 100).toStringAsFixed(2);
    return AlertDialog(
      title: const Text('Έκπτωση παραγγελίας'),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
            child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SegmentedButton<String>(
              showSelectedIcon: false,
              segments: [
                for (final option in ManualDiscount.detailOptions)
                  ButtonSegment(value: option, label: Text(option)),
              ],
              selected: {_details},
              onSelectionChanged: (selection) =>
                  setState(() => _details = selection.first),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final preset in _presets)
                  ChoiceChip(
                    label: Text('$preset%'),
                    selected: percentage == preset,
                    onSelected: (_) => _selectPreset(preset),
                  ),
                ChoiceChip(
                  avatar: const Icon(Icons.euro, size: 18),
                  label: const Text('Ποσό'),
                  selected: _isAmount,
                  onSelected: (_) => _selectAmount(),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              // A new key resets hardware input formatting per mode.
              key: ValueKey(_isAmount),
              controller: _value,
              keyboardType: _isAmount
                  ? const TextInputType.numberWithOptions(decimal: true)
                  : TextInputType.number,
              inputFormatters: [
                _isAmount
                    ? FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))
                    : FilteringTextInputFormatter.digitsOnly,
              ],
              decoration: InputDecoration(
                labelText: _isAmount
                    ? 'Ποσό (έως €$maxAmount)'
                    : 'Ποσοστό (1–100)',
                prefixText: _isAmount ? '€ ' : null,
                suffixText: _isAmount ? null : '%',
                border: const OutlineInputBorder(),
              ),
              onChanged: (_) => setState(() {}),
              onSubmitted: (_) => _apply(),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 240,
              child: OnScreenNumpad(onText: _typeKey, onBackspace: _backspace),
            ),
          ],
        )),
      ),
      actions: [
        if (widget.initial != null)
          TextButton(
            onPressed: () =>
                Navigator.of(context).pop(const _ManualDiscountChoice(null)),
            child: const Text('Αφαίρεση'),
          ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Άκυρο'),
        ),
        FilledButton(
          onPressed: _canApply ? _apply : null,
          child: const Text('Εφαρμογή'),
        ),
      ],
    );
  }
}
