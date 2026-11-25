import 'package:flutter/material.dart';

import '../auth/pos_device_auth.dart';
import 'on_screen_keyboard.dart';

class PosActivationPage extends StatefulWidget {
  const PosActivationPage(
      {super.key, required this.auth, required this.onActivated});
  final PosDeviceAuth auth;
  final VoidCallback onActivated;

  @override
  State<PosActivationPage> createState() => _PosActivationPageState();
}

class _PosActivationPageState extends State<PosActivationPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _emailFocus = FocusNode();
  final _passwordFocus = FocusNode();
  late TextEditingController _active = _email;
  bool _busy = false;
  bool _hidePassword = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _emailFocus.addListener(() {
      if (_emailFocus.hasFocus) setState(() => _active = _email);
    });
    _passwordFocus.addListener(() {
      if (_passwordFocus.hasFocus) setState(() => _active = _password);
    });
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _emailFocus.dispose();
    _passwordFocus.dispose();
    super.dispose();
  }

  Future<void> _activate() async {
    if (_busy) return;
    if (_email.text.trim().isEmpty || _password.text.isEmpty) {
      setState(() => _error = 'Συμπληρώστε email και κωδικό διαχειριστή.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.auth.activate(_email.text, _password.text);
      _password.clear();
      if (mounted) widget.onActivated();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        if (error is PosActivationException) {
          final message = switch (error.stage) {
            'manager-sign-in' =>
              'Η σύνδεση διαχειριστή απέτυχε. Ελέγξτε τα στοιχεία και τη σύνδεσή σας.',
            'device-registration' =>
              'Η εγγραφή του υπολογιστή απέτυχε. Ελέγξτε την πρόσβαση διαχειριστή ή επικοινωνήστε με την υποστήριξη.',
            'secure-storage' =>
              'Δεν ήταν δυνατή η ασφαλής αποθήκευση της ενεργοποίησης σε αυτόν τον υπολογιστή.',
            _ => 'Δεν ήταν δυνατή η ολοκλήρωση της σύνδεσης του υπολογιστή.',
          };
          _error =
              '$message\nΚωδικός υποστήριξης: ${error.stage}/${error.code}';
        } else {
          debugPrint('POS activation failed: ${error.runtimeType}');
          _error =
              'Η ενεργοποίηση απέτυχε. Ελέγξτε τα στοιχεία και τη σύνδεσή σας.';
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Ενεργοποίηση υπολογιστή')),
      body: Column(children: [
        Expanded(
            child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Center(
              child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 620),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                      'Συνδεθείτε με τον λογαριασμό διαχειριστή του καταστήματος.',
                      style: TextStyle(fontSize: 20)),
                  const SizedBox(height: 8),
                  const Text(
                      'Η ενεργοποίηση γίνεται μία φορά. Έπειτα οι υπάλληλοι χρησιμοποιούν τον προσωπικό τους κωδικό.'),
                  const SizedBox(height: 20),
                  TextField(
                    key: const ValueKey('activation-email'),
                    controller: _email,
                    focusNode: _emailFocus,
                    autofocus: true,
                    enabled: !_busy,
                    autocorrect: false,
                    enableSuggestions: false,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    onSubmitted: (_) => _passwordFocus.requestFocus(),
                    decoration: const InputDecoration(
                        labelText: 'Email διαχειριστή',
                        border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    key: const ValueKey('activation-password'),
                    controller: _password,
                    focusNode: _passwordFocus,
                    enabled: !_busy,
                    obscureText: _hidePassword,
                    autocorrect: false,
                    enableSuggestions: false,
                    onSubmitted: (_) => _activate(),
                    decoration: InputDecoration(
                        labelText: 'Κωδικός πρόσβασης',
                        border: const OutlineInputBorder(),
                        suffixIcon: IconButton(
                          tooltip: 'Εμφάνιση / απόκρυψη κωδικού',
                          onPressed: () =>
                              setState(() => _hidePassword = !_hidePassword),
                          icon: Icon(_hidePassword
                              ? Icons.visibility
                              : Icons.visibility_off),
                        )),
                  ),
                  const SizedBox(height: 12),
                  if (_error != null)
                    Text(_error!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error)),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    key: const ValueKey('activate-pc'),
                    onPressed: _busy ? null : _activate,
                    style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(58)),
                    icon: const Icon(Icons.verified_user_outlined),
                    label: Text(
                        _busy ? 'Ενεργοποίηση…' : 'Ενεργοποίηση υπολογιστή'),
                  ),
                ]),
          )),
        )),
        SizedBox(
          height: MediaQuery.sizeOf(context).height * .40,
          child: AbsorbPointer(
              absorbing: _busy,
              child: OnScreenKeyboard(
                initialGreekLayout: false,
                onText: (text) => insertKeyboardText(_active, text),
                onBackspace: () => backspaceKeyboardText(_active),
              )),
        ),
      ]),
    );
  }
}
