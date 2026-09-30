import 'package:flutter/material.dart';

class AppTheme {
  const AppTheme._();

  static ThemeData light() {
    const colorScheme = ColorScheme.light(
      primary: Color(0xFF0F766E),
      onPrimary: Color(0xFFFFFFFF),
      primaryContainer: Color(0xFFCCFBF1),
      onPrimaryContainer: Color(0xFF134E4A),
      secondary: Color(0xFF1D4ED8),
      onSecondary: Color(0xFFFFFFFF),
      surface: Color(0xFFF8FAFC),
      onSurface: Color(0xFF0F172A),
      surfaceContainerHighest: Color(0xFFE2E8F0),
      outline: Color(0xFF94A3B8),
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: const Color(0xFFEFF6FF),
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
          side: BorderSide(color: colorScheme.outline.withOpacity(0.25)),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: colorScheme.secondary,
          foregroundColor: colorScheme.onSecondary,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: colorScheme.outline.withOpacity(0.6)),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          foregroundColor: colorScheme.onSurface,
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      listTileTheme: const ListTileThemeData(
        dense: true,
        horizontalTitleGap: 10,
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: colorScheme.primary,
        ),
      ),
    );
  }
}
