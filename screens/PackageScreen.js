import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { SCREEN_TOP_SPACING, screenLayout } from '../components/ScreenHeader';
import EdgeBackGesture from '../components/EdgeBackGesture';
import IconBackButton from '../components/IconBackButton';
import { getDeviceId } from '../FreeOrderUtils';
import { getOrderSettings, getUserProfile, hasClaimedFreeOrder } from '../SupabaseAPI';
import PackageCancellationScreen from './PackageCancellationScreen';
import useKeyboardAwareScroll from '../hooks/useKeyboardAwareScroll';
import {
  PACKAGE_TERMS_VERSION, ensurePackageSession, getPackageSession, getPackages, getPackageOrders, getPendingCheckout, recoverPendingCheckout,
  getPendingPackageOrder, signOutPackage, startOrResumeCheckout, submitPackageOrder,
} from '../PackageAPI';

const terms = {
  contract: {
    title: 'Käyttöehdot',
    text: `Palveluntarjoaja
Finn Tuote, Y-tunnus 2640397-5
Temmeksentie 4, 90400 Oulu
lumitoimeksiannot@gmail.com
+358 40 736 2403

Lumityöpaketti
Paketti sisältää 10 lumityökertaa yhteen oston yhteydessä ilmoitettuun palveluosoitteeseen. Paketin hinta on 150 €. Paketti on voimassa 24 kuukautta onnistuneesta maksusta. Polanteen poisto ei sisälly pakettiin.

Paketin käyttäminen
Voit tilata lumityön paketin palveluosoitteeseen sovelluksessa. Jäljellä olevat kerrat näkyvät sovelluksessa. Jos sinulla on oikeus maksuttomaan ensimmäiseen tilaukseen, se käytetään ennen paketin kertoja.

Peruuttamisoikeus
Kuluttajalla on oikeus peruuttaa etänä tehty palvelusopimus 14 päivän kuluessa sopimuksen tekemisestä. Peruuttamisesta voi ilmoittaa sovelluksessa tai sähköpostitse osoitteeseen lumitoimeksiannot@gmail.com. Ilmoita nimesi ja ostoksesi tiedot.

Jos olet erikseen pyytänyt palvelun aloittamista peruuttamisaikana, suoritetusta palvelusta voidaan periä lain edellytysten täyttyessä kohtuullinen korvaus. Palautamme peruuttamisen perusteella palautettavat maksut viivytyksettä ja viimeistään 14 päivän kuluessa peruuttamisilmoituksen vastaanottamisesta.

Kysymykset ja reklamaatiot
Ota yhteyttä asiakaspalveluun, jos sinulla on kysyttävää paketista, tilauksesta tai palvelun toteutuksesta. Nämä ehdot eivät rajoita kuluttajan lakisääteisiä oikeuksia.`,
  },
  payment: {
    title: 'Maksuehdot',
    text: `Yrityksen tiedot
Finn Tuote
Y-tunnus: 2640397-5
Temmeksentie 4, 90400 Oulu
Sähköposti: lumitoimeksiannot@gmail.com
Puhelin: +358 40 736 2403

Hinta
Lumityöpaketin kokonaishinta on 150 €.

Maksutavat
Maksu suoritetaan Paytrailin maksupalvelussa. Käytettävissä olevat maksutavat, kuten verkkopankit, maksukortit ja mobiilimaksut, näytetään Paytrailin maksupalvelussa.

Maksun vahvistaminen
Paketti aktivoidaan, kun maksu on vahvistettu. Jos maksu jää kesken tai epäonnistuu, pakettia ei aktivoida.

Peruuttaminen ja maksun palautus
Kuluttajalla on oikeus peruuttaa etänä tehty palvelusopimus 14 päivän kuluessa sopimuksen tekemisestä. Peruuttamisesta voi ilmoittaa sovelluksessa tai sähköpostitse osoitteeseen lumitoimeksiannot@gmail.com. Ilmoita nimesi ja ostoksesi tiedot.

Jos olet erikseen pyytänyt palvelun aloittamista peruuttamisaikana, suoritetusta palvelusta voidaan periä lain edellytysten täyttyessä kohtuullinen korvaus. Palautamme peruuttamisen perusteella palautettavat maksut viivytyksettä ja viimeistään 14 päivän kuluessa peruuttamisilmoituksen vastaanottamisesta. Palautus tehdään samalla maksutavalla, ellei kanssasi sovita muuta.

Kysymyksiä maksuehdoista?
Jos sinulla on kysyttävää maksusta tai palautuksesta, ota yhteyttä asiakaspalveluun:

Finn Tuote - Asiakaspalvelu
lumitoimeksiannot@gmail.com
+358 40 736 2403

Nämä ehdot eivät rajoita kuluttajan lakisääteisiä oikeuksia.`,
  },
};

function Action({ title, onPress, disabled, secondary, ghost, theme }) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress}
      style={[styles.button, ghost ? styles.ghostButton : secondary ? styles.secondaryButton : { backgroundColor: theme.colors.primary }, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, (ghost || secondary) && styles.secondaryText]}>{title}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value, onChangeText, theme, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.colors.textPrimary }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} accessibilityLabel={label}
        placeholderTextColor={theme.colors.inputPlaceholder}
        style={[styles.input, { backgroundColor: theme.colors.input, color: theme.colors.controlText }]} {...props} />
    </View>
  );
}

export default function PackageScreen({ onClose, onFreeOrder, refreshKey }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardScroll = useKeyboardAwareScroll();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [info, setInfo] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [packages, setPackages] = useState([]);
  const [packageOrders, setPackageOrders] = useState([]);
  const [checkout, setCheckout] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [showTerms, setShowTerms] = useState(null);
  const [message, setMessage] = useState('');
  const [showCancellation, setShowCancellation] = useState(false);

  async function loadAccount(currentSession) {
    if (!currentSession?.user?.id) {
      setSession(null);
      setPackages([]);
      setPackageOrders([]);
      return;
    }
    const userId = currentSession.user.id;
    const [available, orders, savedCheckout, savedOrder] = await Promise.all([
      getPackages(), getPackageOrders(), recoverPendingCheckout(userId), getPendingPackageOrder(userId),
    ]);
    setPackages(available);
    setPackageOrders(orders);
    setCheckout(savedCheckout);
    setPendingOrder(savedOrder);
    setSession(currentSession);
    if (currentSession.user.email) setEmail(currentSession.user.email);
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [existingSession, deviceId] = await Promise.all([getPackageSession(), getDeviceId()]);
        const currentSession = existingSession || await ensurePackageSession();
        const profile = await getUserProfile(deviceId, { throwOnError: true });
        if (!active) return;
        if (profile) {
          setAddress(profile.address || '');
          setName(profile.name || '');
          setPhone(profile.phone || '');
          if (!currentSession?.user?.email) setEmail(profile.email || '');
        }
        await loadAccount(currentSession);
      } catch (error) {
        console.error('Package screen initialization failed:', error);
        if (active) setMessage(error?.message?.includes('Anonymous sign-ins are disabled')
          ? 'Pakettia varten pitää sallia anonyymit kirjautumiset Supabasen Auth-asetuksissa.'
          : 'Tietojen lataus ei onnistunut. Sulje näkymä ja yritä uudelleen.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!refreshKey || !session?.user?.id) return;
    run(async () => {
      await loadAccount(session);
      setMessage('Maksun tila päivitettiin. Jos paketti ei vielä näy, odota hetki ja tarkista uudelleen.');
    }, 'Maksun tilaa ei voitu päivittää. Yritä hetken kuluttua uudelleen.');
  }, [refreshKey, session?.user?.id]);

  async function run(action, failure) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      console.error('Package action failed:', error);
      const checkoutErrors = {
        checkout_unavailable: 'Maksaminen ei ole käytössä Supabasessa. Tarkista package-checkout-funktion asetukset.',
        verified_email_required: 'Supabase käyttää vielä vanhaa checkout-funktiota. Päivitä package-checkout ennen uutta yritystä.',
        authentication_required: 'Pakettitiliä ei voitu vahvistaa. Sulje pakettinäkymä ja yritä uudelleen.',
        invalid_request: 'Maksutiedot tai ehtoversio eivät täsmää. Tarkista osoite, yhteystiedot ja sovelluksen asetukset.',
      };
      setMessage(error?.message?.includes('Anonymous sign-ins are disabled')
        ? 'Pakettia varten pitää sallia anonyymit kirjautumiset Supabasen Auth-asetuksissa.'
        : checkoutErrors[error?.message] || failure);
      if (session?.user?.id) {
        try {
          setCheckout(await getPendingCheckout(session.user.id));
          setPendingOrder(await getPendingPackageOrder(session.user.id));
        } catch (storageError) {
          console.error('Package request recovery failed:', storageError);
          setMessage('Tallennettu pyyntö ei ole luettavissa. Ota yhteyttä asiakaspalveluun ennen uutta yritystä.');
        }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function checkoutPackage() {
    const trimmedAddress = address.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!checkout && (trimmedAddress.length < 5 || trimmedAddress.length > 250 ||
      /[\u0000-\u001f\u007f]/.test(trimmedAddress) || !phone.trim() || phone.trim().length > 40 ||
      /[\u0000-\u001f\u007f]/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail) ||
      trimmedEmail.length > 254 || !accepted || !PACKAGE_TERMS_VERSION)) {
      setMessage(!PACKAGE_TERMS_VERSION
        ? 'Maksaminen ei ole vielä käytettävissä.'
        : 'Anna palveluosoite, puhelinnumero ja kuittisähköposti sekä hyväksy ehdot ennen maksamista.');
      return;
    }
    run(async () => {
      const result = await startOrResumeCheckout(session.user.id, address, phone, email, await getDeviceId(), PACKAGE_TERMS_VERSION);
      if (result.status === 'paid') {
        setCheckout(null);
        try {
          await loadAccount(session);
          setMessage('Maksu on vahvistettu. Paketti näkyy alla.');
        } catch (error) {
          console.error('Unable to refresh package after payment:', error);
          setMessage('Maksu on vahvistettu, mutta pakettitietojen lataus ei onnistunut. Avaa näkymä uudelleen.');
        }
      } else if (result.status === 'new' && typeof result.checkoutUrl === 'string') {
        await loadAccount(session);
        const url = new URL(result.checkoutUrl);
        if (url.protocol !== 'https:' || !['services.paytrail.com', 'pay.paytrail.com'].includes(url.hostname) || url.username || url.password) {
          throw new Error('Invalid Paytrail URL');
        }
        await Linking.openURL(url.href);
        setMessage('Maksun jälkeen palaat automaattisesti tähän näkymään.');
      } else if (['pending', 'delayed', 'fail'].includes(result.status)) {
        await loadAccount(session);
        setMessage('Maksun tila vaatii tarkistuksen. Älä aloita uutta maksua; ota tarvittaessa yhteyttä asiakaspalveluun.');
      } else {
        throw new Error('Unexpected checkout response');
      }
    }, 'Maksun tilaa ei voitu varmistaa. Tarkista tila uudelleen tai ota yhteyttä asiakaspalveluun; älä aloita uutta maksua.');
  }

  function selectPackage(item) {
    run(async () => {
      const deviceId = await getDeviceId();
      const settings = await getOrderSettings(deviceId, { throwOnError: true });
      if (settings?.continuous_order) {
        setMessage('Pakettia ei voi vielä käyttää jatkuvaan tilaukseen tässä esikatselussa.');
        return;
      }
      if (!await hasClaimedFreeOrder(deviceId)) {
        Alert.alert('Ensimmäinen tilaus', 'Käytä ensin maksuton ensimmäinen tilauksesi.', [
          { text: 'Peruuta', style: 'cancel' },
          { text: 'Tee ilmainen tilaus', onPress: onFreeOrder },
        ]);
        return;
      }
      setSelectedPackage(item);
    }, 'Tilauksen tietoja ei voitu tarkistaa. Yritä uudelleen.');
  }

  function orderPackage() {
    if (!pendingOrder && (!selectedPackage || !name.trim() || name.trim().length > 200 ||
      !phone.trim() || phone.trim().length > 40 || info.length > 2000)) {
      setMessage('Tarkista nimi, puhelinnumero ja lisätiedot.');
      return;
    }
    run(async () => {
      const payload = pendingOrder?.payload || {
        p_purchase_id: selectedPackage.id,
        p_device_id: await getDeviceId(),
        p_name: name.trim(),
        p_phone: phone.trim(),
        p_info: info.trim() || null,
      };
      await submitPackageOrder(session.user.id, payload);
      setSelectedPackage(null);
      setPendingOrder(null);
      setInfo('');
      try {
        await loadAccount(session);
        setMessage('Tilaus on vastaanotettu. Voit seurata sitä Historia-välilehdellä.');
      } catch (error) {
        console.error('Unable to refresh package after order:', error);
        setMessage('Tilaus on vastaanotettu, mutta pakettitietojen lataus ei onnistunut. Tarkista Historia-välilehti.');
      }
    }, 'Tilausta ei voitu vahvistaa. Tarkista tilaushistoria ja yritä samaa pyyntöä uudelleen tai ota yhteyttä asiakaspalveluun.');
  }

  const currentTerms = showTerms && terms[showTerms];
  if (showCancellation) return <PackageCancellationScreen onClose={() => setShowCancellation(false)} />;
  return (
    <KeyboardAvoidingView style={[styles.screen, currentTerms && styles.termsOverlay]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
      <ScrollView ref={keyboardScroll.scrollViewRef} keyboardShouldPersistTaps="handled"
        onLayout={keyboardScroll.onLayout} onScroll={keyboardScroll.onScroll} scrollEventThrottle={16}
        contentContainerStyle={[screenLayout.content, styles.content, { paddingTop: insets.top + SCREEN_TOP_SPACING }]}>
        <IconBackButton onPress={currentTerms ? () => setShowTerms(null) : onClose}
          style={styles.back} color={theme.colors.textPrimary} />
        <Text style={[styles.title, { color: theme.colors.textPrimary }]} accessibilityRole="header">
          {currentTerms ? currentTerms.title : 'Lumityöpaketti'}
        </Text>
        {currentTerms ? (
          <Text style={[styles.body, { color: theme.colors.textPrimary }]}>{currentTerms.text}</Text>
        ) : (
          <>
            {!!message && <Text style={[styles.message, { color: theme.colors.textPrimary }]} accessibilityLiveRegion="polite">{message}</Text>}
            {loading ? <Text style={[styles.body, { color: theme.colors.textPrimary }]}>Ladataan tietoja...</Text> : !session ? (
              <View style={[styles.card, { backgroundColor: theme.colors.homeSurface, borderColor: theme.colors.border }]}>
                <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Pakettia ei voitu avata</Text>
                <Text style={[styles.body, { color: theme.colors.textSecondary }]}>Tarkista yhteys ja yritä uudelleen.</Text>
                <Action title="Yritä uudelleen" onPress={() => run(async () => loadAccount(await ensurePackageSession()), 'Pakettia ei voitu avata. Tarkista yhteys ja yritä uudelleen.')} disabled={busy} theme={theme} />
              </View>
            ) : (
              <>
                <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
                  {session.user.is_anonymous
                    ? 'Paketti tallentuu tälle laitteelle. Uudelleenasennuksen tai laitteen vaihdon jälkeen sitä ei voi palauttaa. Kuittisähköpostia ei vahvisteta.'
                    : `Kirjautuneena: ${session.user.email || 'pakettitili'}`}
                </Text>
                {packages.map((item) => {
                  const expired = Date.parse(item.expires_at) <= Date.now();
                  return <View key={item.id} style={[styles.card, { backgroundColor: theme.colors.homeSurface, borderColor: theme.colors.border }]}>
                    <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Oma lumityöpaketti</Text>
                    <Text style={[styles.body, { color: theme.colors.textPrimary }]}>{item.service_address}</Text>
                    <Text style={[styles.body, { color: theme.colors.textPrimary }]}>Käytettävissä: {expired ? 0 : item.remaining} · Varattu: {item.reserved} · Tehty: {item.completed}</Text>
                    <Text style={[styles.body, { color: theme.colors.textSecondary }]}>Voimassa: {new Date(item.expires_at).toLocaleDateString('fi-FI')}</Text>
                    <Action title={expired ? 'Paketti on päättynyt' : 'Tilaa paketilla'} onPress={() => selectPackage(item)}
                      disabled={busy || expired || item.remaining <= 0 || !!pendingOrder} theme={theme} />
                  </View>;
                })}
                {packageOrders.length > 0 && <View style={[styles.card, { backgroundColor: theme.colors.homeSurface, borderColor: theme.colors.border }]}>
                  <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Viimeisimmät pakettitilaukset</Text>
                  {packageOrders.map((item) => <View key={item.order_id}>
                    <Text style={[styles.body, { color: theme.colors.textPrimary }]}>{item.service_address}</Text>
                    <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
                      {new Date(item.created_at).toLocaleDateString('fi-FI')} · {({ odottaa: 'Odottaa', kesken: 'Työn alla', kuitattu: 'Valmis', peruttu: 'Peruttu' })[item.status] || item.status}
                    </Text>
                  </View>)}
                </View>}
                {pendingOrder ? <View style={[styles.card, { backgroundColor: theme.colors.homeSurface, borderColor: theme.colors.border }]}>
                  <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Tilauksen vahvistus kesken</Text>
                  <Text style={[styles.body, { color: theme.colors.textPrimary }]}>Tarkista tilaushistoria. Voit tarvittaessa yrittää samaa tilausta uudelleen.</Text>
                  <Action title="Tarkista sama tilaus uudelleen" onPress={orderPackage} disabled={busy} theme={theme} />
                </View> : selectedPackage && <View style={[styles.card, { backgroundColor: theme.colors.homeSurface, borderColor: theme.colors.border }]}>
                  <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Tilaa lumityö paketilla</Text>
                  <Text style={[styles.body, { color: theme.colors.textPrimary }]}>Osoite: {selectedPackage.service_address}</Text>
                  <Field label="Nimi" value={name} onChangeText={setName} theme={theme} editable={!busy} autoComplete="name" maxLength={200} onFocus={keyboardScroll.onFocusInput} onBlur={keyboardScroll.onBlurInput} />
                  <Field label="Puhelinnumero" value={phone} onChangeText={setPhone} theme={theme} keyboardType="phone-pad" editable={!busy} autoComplete="tel" maxLength={40} onFocus={keyboardScroll.onFocusInput} onBlur={keyboardScroll.onBlurInput} />
                  <Field label="Lisätiedot (valinnainen)" value={info} onChangeText={setInfo} theme={theme} multiline editable={!busy} maxLength={2000} onFocus={keyboardScroll.onFocusInput} onBlur={keyboardScroll.onBlurInput} />
                  <Action title="Vahvista tilaus" onPress={orderPackage} disabled={busy} theme={theme} />
                  <Action title="Peruuta" onPress={() => setSelectedPackage(null)} disabled={busy} secondary theme={theme} />
                </View>}
                <View style={styles.paymentContainer}>
                  <View style={[styles.offerCard, { backgroundColor: theme.colors.homeSurface, borderColor: theme.colors.border }]}>
                    <Text style={[styles.offerPrice, { fontFamily: theme.fonts.bold, color: theme.colors.textPrimary, borderRightColor: theme.colors.border }]}>150 €</Text>
                    <View style={styles.offerCopy}>
                      <Text style={[styles.offerTitle, { fontFamily: theme.fonts.bold, color: theme.colors.textPrimary }]}>10 lumityökertaa</Text>
                      <Text style={[styles.offerSubtitle, { color: theme.colors.textSecondary }]}>Yhteen osoitteeseen · 24 kk</Text>
                    </View>
                  </View>
                  <View style={[styles.card, { backgroundColor: theme.colors.homeSurface, borderColor: theme.colors.border }]}>
                    <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>{checkout ? 'Maksu kesken' : 'Osta lumityöpaketti'}</Text>
                    {checkout ? <>
                      <Text style={[styles.body, { color: theme.colors.textPrimary }]}>Palveluosoite: {checkout.payload.address}</Text>
                      <Text style={[styles.body, { color: theme.colors.textPrimary }]}>Puhelinnumero: {checkout.payload.phone}</Text>
                      <Text style={[styles.body, { color: theme.colors.textPrimary }]}>Kuittisähköposti: {checkout.payload.email}</Text>
                    </> : <>
                      <Field label="Palveluosoite" value={address} onChangeText={setAddress} theme={theme} editable={!busy} maxLength={250} onFocus={keyboardScroll.onFocusInput} onBlur={keyboardScroll.onBlurInput} />
                      <Field label="Puhelinnumero" value={phone} onChangeText={setPhone} theme={theme} keyboardType="phone-pad" autoComplete="tel" editable={!busy} maxLength={40} onFocus={keyboardScroll.onFocusInput} onBlur={keyboardScroll.onBlurInput} />
                      <Field label="Sähköposti kuitille (ei vahvistusta)" value={email} onChangeText={setEmail} theme={theme} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} maxLength={254} onFocus={keyboardScroll.onFocusInput} onBlur={keyboardScroll.onBlurInput} />
                      <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted(!accepted)} style={styles.checkbox}>
                        <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={26} color={theme.colors.textPrimary} />
                        <Text style={[styles.body, { color: theme.colors.textPrimary, flex: 1 }]}>Hyväksyn käyttö- ja maksuehdot.</Text>
                      </TouchableOpacity>
                    </>}
                    <Action title={checkout ? 'Tarkista maksu / jatka maksua' : 'Siirry maksamaan 150 €'} onPress={checkoutPackage}
                      disabled={busy || (!checkout && (!accepted || !PACKAGE_TERMS_VERSION))} theme={theme} />
                    {!PACKAGE_TERMS_VERSION && <Text style={[styles.body, { color: theme.colors.textSecondary }]}>Maksaminen ei ole vielä käytettävissä.</Text>}
                  </View>
                </View>
                {!session.user.is_anonymous && <Action title="Kirjaudu ulos" onPress={() => run(async () => {
                  await signOutPackage();
                  setSession(null);
                  setPackages([]);
                  setPackageOrders([]);
                  setCheckout(null);
                  setPendingOrder(null);
                  setSelectedPackage(null);
                }, 'Uloskirjautuminen ei onnistunut.')} disabled={busy} ghost theme={theme} />}
              </>
            )}
          </>
        )}
      </ScrollView>
      {!currentTerms && !keyboardScroll.keyboardVisible && (
        <View style={[styles.termsLinks, { backgroundColor: theme.colors.homeSurface, borderColor: theme.colors.border }]}>
          <TouchableOpacity accessibilityRole="link" onPress={() => setShowTerms('payment')} style={styles.termsLink}>
            <Text style={[styles.termsLinkText, { color: theme.colors.textPrimary }]}>Maksuehdot</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="link" onPress={() => setShowTerms('contract')} style={styles.termsLink}>
            <Text style={[styles.termsLinkText, { color: theme.colors.textPrimary }]}>Käyttöehdot</Text>
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="link" onPress={() => setShowCancellation(true)} style={styles.termsLink}>
            <Text style={[styles.termsLinkText, { color: theme.colors.textPrimary }]}>Peruuta ostos</Text>
          </TouchableOpacity>
        </View>
      )}
      <EdgeBackGesture enabled onBack={currentTerms ? () => setShowTerms(null) : onClose} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  termsOverlay: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  content: { paddingBottom: 24, gap: 12 },
  back: { minHeight: 48, alignSelf: 'flex-start', borderRadius: 12 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  offerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, marginHorizontal: 0, marginBottom: -6, zIndex: 1 },
  offerHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  offerIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.10)' },
  offerLabel: { fontSize: 12, letterSpacing: 0.6, flexShrink: 1 },
  offerCopy: { flex: 1, minWidth: 0, gap: 2 },
  offerTitle: { fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
  offerPrice: { fontFamily: 'System', fontSize: 20, letterSpacing: -0.4, paddingRight: 10, borderRightWidth: 1, flexShrink: 0 },
  offerSubtitle: { fontSize: 13, lineHeight: 18, opacity: 0.8 },
  offerDivider: { height: 1, backgroundColor: 'rgba(255, 255, 255, 0.22)', marginVertical: 0 },
  paymentContainer: { gap: 0 },
  body: { fontSize: 15, lineHeight: 22 },
  termsLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 20, paddingHorizontal: 16, borderTopWidth: 1 },
  termsLink: { minHeight: 40, justifyContent: 'center' },
  termsLinkText: { fontSize: 14, textDecorationLine: 'underline' },
  message: { fontSize: 15, lineHeight: 22 },
  field: { gap: 5 },
  label: { fontSize: 15, fontWeight: '600' },
  input: { minHeight: 44, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  button: { minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
  ghostButton: { backgroundColor: 'transparent', borderWidth: 0 },
  secondaryText: { color: '#FFFFFF' },
  disabled: { opacity: 0.55 },
  checkbox: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
});
