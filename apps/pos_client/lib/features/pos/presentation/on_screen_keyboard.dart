import 'package:flutter/material.dart';

/// Touch-friendly on-screen keyboards (Greek / English / numpad).
class OnScreenKeyboard extends StatefulWidget {
  const OnScreenKeyboard({
    super.key,
    required this.onText,
    required this.onBackspace,
  });

  final ValueChanged<String> onText;
  final VoidCallback onBackspace;

  @override
  State<OnScreenKeyboard> createState() => _OnScreenKeyboardState();
}

class _OnScreenKeyboardState extends State<OnScreenKeyboard> {
  static const _digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  static const _greek = [
    ['ε', 'ρ', 'τ', 'υ', 'θ', 'ι', 'ο', 'π'],
    ['α', 'σ', 'δ', 'φ', 'γ', 'η', 'ξ', 'κ', 'λ'],
    ['ζ', 'χ', 'ψ', 'ω', 'β', 'ν', 'μ'],
  ];
  static const _latin = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ];

  bool _greekLayout = true;
  bool _shift = false;

  Widget _key(String label,
      {VoidCallback? onTap, int flex = 2, bool tonal = false, Widget? child}) {
    final colors = Theme.of(context).colorScheme;
    final style = FilledButton.styleFrom(
      minimumSize: Size.zero,
      padding: EdgeInsets.zero,
      backgroundColor: tonal ? colors.primary : colors.surface,
      foregroundColor: tonal ? colors.onPrimary : colors.onSurface,
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    );
    final content = child ??
        Text(label,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600));
    final press = onTap ?? () => widget.onText(label);
    return Expanded(
      flex: flex,
      child: Padding(
        padding: const EdgeInsets.all(3),
        child: SizedBox.expand(
          child: FilledButton(onPressed: press, style: style, child: content),
        ),
      ),
    );
  }

  String _cased(String letter) => _shift ? letter.toUpperCase() : letter;

  @override
  Widget build(BuildContext context) {
    final rows = _greekLayout ? _greek : _latin;
    return Container(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      padding: const EdgeInsets.all(4),
      child: Column(
        children: [
          Expanded(
            child: Row(children: [for (final d in _digits) _key(d)]),
          ),
          for (var i = 0; i < rows.length; i++)
            Expanded(
              child: Row(
                children: [
                  if (i == 2)
                    _key('',
                        flex: 3,
                        tonal: _shift,
                        onTap: () => setState(() => _shift = !_shift),
                        child: const Icon(Icons.arrow_upward))
                  else if (rows[i].length < 10)
                    Spacer(flex: 10 - rows[i].length),
                  for (final l in rows[i]) _key(_cased(l)),
                  if (i == 2)
                    _key('',
                        flex: 3,
                        onTap: widget.onBackspace,
                        child: const Icon(Icons.backspace_outlined))
                  else if (rows[i].length < 10)
                    Spacer(flex: 10 - rows[i].length),
                ],
              ),
            ),
          Expanded(
            child: Row(
              children: [
                _key(_greekLayout ? 'EN' : 'ΕΛ',
                    flex: 3,
                    onTap: () => setState(() => _greekLayout = !_greekLayout)),
                _key(',', flex: 2),
                _key(' ', flex: 10, child: const Icon(Icons.space_bar)),
                _key('.', flex: 2),
                _key('-', flex: 2),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class OnScreenNumpad extends StatelessWidget {
  const OnScreenNumpad({
    super.key,
    required this.onText,
    required this.onBackspace,
  });

  final ValueChanged<String> onText;
  final VoidCallback onBackspace;

  Widget _key(String label, VoidCallback onTap, {Widget? child}) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.all(3),
        child: SizedBox.expand(
          child: FilledButton(
            onPressed: onTap,
            style: FilledButton.styleFrom(
              minimumSize: Size.zero,
              padding: EdgeInsets.zero,
              backgroundColor: Colors.white,
              foregroundColor: Colors.black87,
              elevation: 1,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            child: child ??
                Text(label,
                    style: const TextStyle(
                        fontSize: 26, fontWeight: FontWeight.w700)),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    Widget row(List<String> labels) => Expanded(
          child: Row(
            children: [for (final l in labels) _key(l, () => onText(l))],
          ),
        );

    return Container(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      padding: const EdgeInsets.all(4),
      child: Column(
        children: [
          row(['1', '2', '3']),
          row(['4', '5', '6']),
          row(['7', '8', '9']),
          Expanded(
            child: Row(
              children: [
                _key(',', () => onText(',')),
                _key('0', () => onText('0')),
                _key('', onBackspace,
                    child: const Icon(Icons.backspace_outlined)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
