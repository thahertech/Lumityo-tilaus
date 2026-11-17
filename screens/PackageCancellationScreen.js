import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';
import { SCREEN_TOP_SPACING, screenLayout } from '../components/ScreenHeader';
import EdgeBackGesture from '../components/EdgeBackGesture';
import IconBackButton from '../components/IconBackButton';
import { getPendingCancellation, submitPackageCancellation } from '../PackageAPI';
import useKeyboardAwareScroll from '../hooks/useKeyboardAwareScroll';

export default function PackageCancellationScreen({ onClose }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardScroll = useKeyboardAwareScroll();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [contract, setContract] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState('');
  const [received, setReceived] = useState(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let active = true;
    getPendingCancellation().then((pending) => {
      if (active && pending) {
        setName(pending.payload.name);
        setEmail(pending.payload.email);
        setContract(pending.payload.contract);
        setLocked(true);
      }
    }).catch((failure) => {
      console.error('Unable to load cancellation request:', failure);
      if (active) setError('Tallennettua ilmoitusta ei voitu lukea. Ota yhteyttä: lumitoimeksiannot@gmail.com.');
      if (active) setLocked(true);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function send() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const time = await submitPackageCancellation({ name, email, contract });
      setReceived(time);
    } catch (failure) {
      console.error('Cancellation submission failed:', failure);
      setLocked(true);
      setError('Ilmoituksen vastaanottoa ei voitu varmistaa. Yritä samoilla tiedoilla uudelleen tai lähetä ilmoitus osoitteeseen lumitoimeksiannot@gmail.com.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function confirm() {
    if (!name.trim() || name.trim().length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        email.trim().length > 254 || !contract.trim() || contract.trim().length > 1000 ||
        /[\u0000-\u001f\u007f]/.test(name + email + contract)) {
      setError('Anna nimesi, kelvollinen sähköpostiosoite ja peruutettavan sopimuksen tiedot.');
      return;
    }
    Alert.alert('Vahvista peruuttamisilmoitus',
      'Haluatko lähettää peruuttamisilmoituksen? Mahdollinen maksun palautus käsitellään erikseen.',
      [{ text: 'Peruuta', style: 'cancel' }, { text: 'Vahvista ja lähetä', onPress: send }]);
  }

  const field = (label, value, onChangeText, props = {}) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.textPrimary }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} accessibilityLabel={label}
        editable={!busy && !locked} onFocus={keyboardScroll.onFocusInput} onBlur={keyboardScroll.onBlurInput}
        style={[styles.input, { backgroundColor: theme.colors.input, color: theme.colors.controlText }]} {...props} />
    </View>
  );
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
    <ScrollView ref={keyboardScroll.scrollViewRef} keyboardShouldPersistTaps="handled"
      onLayout={keyboardScroll.onLayout} onScroll={keyboardScroll.onScroll} scrollEventThrottle={16}
      contentContainerStyle={[screenLayout.content, styles.content, { paddingTop: insets.top + SCREEN_TOP_SPACING }]}>
      <IconBackButton onPress={onClose} style={styles.back} color={theme.colors.textPrimary} />
      <Text style={[styles.title, { color: theme.colors.textPrimary }]} accessibilityRole="header">Peruuta ostos</Text>
      {received ? (
        <View>
          <Text style={[styles.body, { color: theme.colors.textPrimary }]} accessibilityLiveRegion="polite">
            Ilmoituksesi on vastaanotettu {new Date(received).toLocaleString('fi-FI')}. Vahvistus lähetetään osoitteeseen {email}. Mahdollinen palautus käsitellään erikseen.
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.body, { color: theme.colors.textPrimary }]}>Ilmoita nimesi ja peruutettavan ostoksen tiedot, esimerkiksi palveluosoite tai ostotunniste. Saat vahvistuksen sähköpostitse.</Text>
          {loading ? <Text style={[styles.body, { color: theme.colors.textPrimary }]}>Ladataan tietoja...</Text> : <>
            {field('Nimi', name, setName, { autoComplete: 'name', maxLength: 200 })}
            {field('Sähköposti vahvistusta varten', email, setEmail, { keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email', maxLength: 254 })}
            {field('Peruutettavan ostoksen tiedot', contract, setContract, { maxLength: 1000 })}
            {locked && <Text style={[styles.body, { color: theme.colors.textSecondary }]}>Jos lähetys jäi kesken, voit yrittää samoilla tiedoilla uudelleen.</Text>}
            {!!error && <Text style={[styles.body, { color: theme.colors.textPrimary }]} accessibilityLiveRegion="polite">{error}</Text>}
            <TouchableOpacity onPress={confirm} disabled={busy}
              accessibilityRole="button" accessibilityState={{ disabled: busy }} style={[styles.button, { backgroundColor: theme.colors.primary }, busy && styles.disabled]}>
              <Text style={styles.buttonText}>{busy ? 'Lähetetään...' : 'Jatka'}</Text>
            </TouchableOpacity>
          </>}
        </>
      )}
    </ScrollView>
    <EdgeBackGesture enabled onBack={onClose} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 36, gap: 16 },
  back: { minHeight: 48, alignSelf: 'flex-start', borderRadius: 12 },
  title: { fontSize: 28, lineHeight: 35, fontWeight: '700' },
  body: { fontSize: 18, lineHeight: 26 },
  field: { gap: 7 },
  label: { fontSize: 18, fontWeight: '600' },
  input: { minHeight: 54, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, fontSize: 18 },
  button: { minHeight: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, paddingVertical: 12 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  disabled: { opacity: 0.55 },
});
