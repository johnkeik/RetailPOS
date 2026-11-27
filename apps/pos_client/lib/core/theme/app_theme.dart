import 'package:flutter/material.dart';

class AppTheme {
  const AppTheme._();

  // Taken from the shop itself: wine lettering, ivory interior, warm sand and
  // golden light. Wine is kept for main actions; everything else stays soft.
  static const _wine = Color(0xFF8C3A4B);
  static const _wineDeep = Color(0xFF7A2F3F);
  static const _blush = Color(0xFFF7E9E7);
  static const _rose = Color(0xFFF2E3E0);
  static const _ink = Color(0xFF3D2B2F);
  static const _inkSoft = Color(0xFF7D6B6B);
  static const _ivory = Color(0xFFFBF7F2);
  static const _sand = Color(0xFFF2EAE3);
  static const _line = Color(0xFFEDE3DA);
  static const _gold = Color(0xFFB8862E);

  static ThemeData light() {
    const colorScheme = ColorScheme.light(
      primary: _wine,
      onPrimary: Color(0xFFFFFFFF),
      primaryContainer: _blush,
      onPrimaryContainer: Color(0xFF5C2230),
      secondary: _wineDeep,
      onSecondary: Color(0xFFFFFFFF),
      secondaryContainer: _rose,
      onSecondaryContainer: Color(0xFF5C2230),
      tertiary: _gold,
      onTertiary: Color(0xFFFFFFFF),
      error: Color(0xFFB5401B),
      surface: Color(0xFFFFFFFF),
      onSurface: _ink,
      onSurfaceVariant: _inkSoft,
      surfaceContainerHighest: _sand,
      outline: Color(0xFFCDBDB3),
      outlineVariant: _line,
    );

    return ThemeData(
      useMaterial3: true,
      visualDensity: VisualDensity.standard,
      materialTapTargetSize: MaterialTapTargetSize.padded,
      appBarTheme: const AppBarTheme(toolbarHeight: 72),
      colorScheme: colorScheme,
      scaffoldBackgroundColor: _ivory,
      textTheme: const TextTheme(
        titleLarge: TextStyle(fontWeight: FontWeight.w700),
        titleMedium: TextStyle(fontWeight: FontWeight.w600),
        bodyMedium: TextStyle(fontWeight: FontWeight.w500),
      ),
      cardTheme: CardTheme(
        elevation: 0,
        color: colorScheme.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(14),
          side: const BorderSide(color: _line),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(56, 56),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
          backgroundColor: colorScheme.secondary,
          foregroundColor: colorScheme.onSecondary,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(56, 56),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          side: BorderSide(color: colorScheme.outline.withOpacity(0.6)),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          foregroundColor: colorScheme.onSurface,
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          minimumSize: const Size(56, 56),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
      ),
      listTileTheme: const ListTileThemeData(
        dense: false,
        minVerticalPadding: 12,
        horizontalTitleGap: 10,
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          minimumSize: const Size(56, 56),
          padding: const EdgeInsets.all(14),
          foregroundColor: colorScheme.primary,
        ),
      ),
    );
  }
}
