import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import { 
  ScrollView, 
  ActivityIndicator,
  Keyboard, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  Platform, 
  KeyboardAvoidingView,
  UIManager
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { createCardStyle } from '../theme';
import { useTheme } from '../ThemeContext';
import ScreenHeader, { SCREEN_TOP_SPACING, screenLayout } from '../components/ScreenHeader';
import { getDeviceId } from '../FreeOrderUtils';
import { upsertUserProfile, getUserProfile, createSnowOrder, getOrdersByDevice, getOrderSettings, hasClaimedFreeOrder } from '../SupabaseAPI';
import AddressAutocomplete from '../components/AddressAutocompleteMapboxNew';
import createSharedStyles from '../styles';
import { CurrentAddressError, getCurrentAddress } from '../utils/currentAddress';

const orderSteps = [
  { label: 'Valitse palvelu', subtitle: 'Valitse palvelu jatkaaksesi' },
  { label: 'Yhteystiedot', subtitle: 'Tilaustiedot – tarkista ja täydennä yhteystietosi.' },
  { label: 'Vahvista tilaus', subtitle: 'Vahvistus – tarkista tilauksen tiedot.' },
];

const AnimatedServiceButton = ({ service, description, isSelected, selectingService, onPress, theme, styles }) => {
  return (
    <TouchableOpacity
      onPress={() => onPress(service)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!selectingService, busy: selectingService === service }}
      disabled={!!selectingService}
      style={[styles.serviceButton, isSelected && styles.selectedServiceButton]}
    >
      <View style={styles.serviceIcon}>
        <Ionicons name={service === 'Lumityö' ? 'snow-outline' : 'construct-outline'} size={26} color={theme.colors.textPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.serviceButtonText}>{service}</Text>
        <Text style={styles.serviceCardDescription}>{description}</Text>
      </View>
      {selectingService === service
        ? <ActivityIndicator color={theme.colors.textPrimary} />
        : <Ionicons name="chevron-forward" size={24} color={theme.colors.textPrimary} />}
    </TouchableOpacity>
  );
};

const OrderScreen = ({ route }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = createOrderStyles(theme);
  const globalStyles = createSharedStyles(theme);
  const scrollViewRef = useRef(null);
  const phoneInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const infoInputRef = useRef(null);
  const formEdited = useRef(false);
  const focusedInput = useRef(null);
  const scrollViewportHeight = useRef(0);
  const scrollOffset = useRef(0);
  const locationRequest = useRef(0);
  const serviceRequest = useRef(0);
  const serviceSelectionInProgress = useRef(false);
  const orderSubmissionInProgress = useRef(false);
  
  const [isEligibleForFree, setIsEligibleForFree] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [addressCoordinates, setAddressCoordinates] = useState(null); // Store lat/lon from address selection
  const [selectedService, setSelectedService] = useState(null);
  const [info, setInfo] = useState('');

  const [userProfile, setUserProfile] = useState(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [step, setStep] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [selectingService, setSelectingService] = useState(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
      scrollFocusedInputIntoView();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      focusedInput.current = null;
      setIsKeyboardVisible(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Re-check eligibility when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (!formEdited.current) {
        initDatabase();
      } else {
        checkFreeOrderEligibility();
      }
    }, [])
  );

  useFocusEffect(
    React.useCallback(() => {
      setIsLocating(false);
      return () => {
        locationRequest.current += 1;
        serviceRequest.current += 1;
        serviceSelectionInProgress.current = false;
        setSelectingService(null);
      };
    }, [])
  );

  useEffect(() => {
    if (route?.params?.requestedService) {
      setConfirmedOrder(null);
      setValidationErrors({});
      setStep(0);
      handleServiceSelection(route.params.requestedService);
      navigation.setParams({ requestedService: undefined, requestId: undefined });
    }
  }, [route?.params?.requestId]);

  const checkFreeOrderEligibility = async () => {
    try {
      const deviceId = await getDeviceId();
      const hasFreeOrder = await hasClaimedFreeOrder(deviceId);
      setIsEligibleForFree(!hasFreeOrder);
    } catch (error) {
      console.error('❌ Error checking free order eligibility:', error);
      setIsEligibleForFree(false);
    }
  };

  const initDatabase = async () => {
    try {
      const deviceId = await getDeviceId();
      const profile = await getUserProfile(deviceId);
      if (profile) {
        setUserProfile(profile);
        if (!formEdited.current) {
          setFirstName(profile.name || '');
          setPhoneNumber(profile.phone || '');
          setAddress(profile.address || '');
          setAddressCoordinates(null);
        }
      }
      
      // Check eligibility
      await checkFreeOrderEligibility();
    } catch (error) {
      console.error('❌ Error initializing:', error);
    }
  };

  const handleServiceSelection = async (service) => {
    if (serviceSelectionInProgress.current) return;
    serviceSelectionInProgress.current = true;
    const request = ++serviceRequest.current;
    setSelectingService(service);
    try {
      const deviceId = await getDeviceId();
      if (request !== serviceRequest.current) return;

      if (service === 'Lumityö' && deviceId) {
        try {
          const settings = await getOrderSettings(deviceId);
          if (request !== serviceRequest.current) return;
          if (settings && settings.continuous_order === true) {
            Alert.alert(
              'Jatkuva tilaus aktiivinen',
              'Sinulla on jo jatkuva lumityöpalvelu käytössä. Lumityöt tehdään automaattisesti ilman erillistä tilausta kun lunta on satanut riittävästi.',
              [
                { text: 'Peruuta', style: 'cancel' },
                { text: 'Siirry asetuksiin', onPress: () => navigation.navigate('Profiili') }
              ]
            );
            return;
          }
        } catch (error) {
          console.error('Error checking jatkuva tilaus settings:', error);
        }
      }
      if (request !== serviceRequest.current) return;
      setSelectedService(service);
      setStep(1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    } catch (error) {
      if (request === serviceRequest.current) {
        console.error('Error selecting service:', error);
        Alert.alert('Virhe', 'Palvelua ei voitu valita. Yritä uudelleen.');
      }
    } finally {
      if (request === serviceRequest.current) {
        serviceSelectionInProgress.current = false;
        setSelectingService(null);
      }
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!address.trim()) errors.address = 'Anna osoite.';
    if (!phoneNumber.trim()) errors.phone = 'Anna puhelinnumero.';
    if (!firstName.trim()) errors.name = 'Anna nimi.';
    setValidationErrors(errors);
    if (Object.keys(errors).length > 0) {
      Keyboard.dismiss();
      setStep(1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      Alert.alert('Tarkista tiedot', Object.values(errors).join('\n'));
      return false;
    }
    if (!selectedService) {
      setStep(0);
      Alert.alert('Valitse palvelu', 'Valitse palvelu ennen jatkamista.');
      return false;
    }
    return true;
  };

  const getServiceLabel = (service = selectedService) => {
    if (service === 'Lumityö') {
      const priceText = isEligibleForFree ? 
        'ILMAINEN ENSIMMÄINEN TILAUS!' : 
        'Hinta: 10 — 20 €';
      return `Lumityö suoritetaan seuraavan kierroksen aikana \n\n${priceText}`;
    } else if (service === 'Polanteen poisto') {
      const priceText = isEligibleForFree ? 
        'ILMAINEN ENSIMMÄINEN TILAUS!' : 
        'Hinta: 20 — 30 €';
      return `Polanteen poisto suoritetaan seuraavan kierroksen aikana\n\n${priceText}`;
    }
    return '';
  };

  const checkAndPromptJatkuvaTilaus = async () => {
    try {
      const deviceId = await getDeviceId();
      const orders = await getOrdersByDevice(deviceId);
      
      // Only check for Lumityö orders (not Polanteen poisto)
      const lumityoOrders = orders.filter(order => order.palvelu === 'Lumityö');
      const settings = await getOrderSettings(deviceId);
      // Show prompt ONLY after FIRST Lumityö order, if continuous_order not enabled
      if (lumityoOrders.length === 1 && (!settings || settings.continuous_order !== true)) {
        Alert.alert(
          'Hei! Kiinnostaako jatkuva tilaus?',
          'Säästä aikaa ja vaivaa! Voit asettaa jatkuvan tilauksen Omat tiedot -sivulla. Näin et unohda tilata lumityötä ja saat automaattisen palvelun.',
          [
            {
              text: 'Ei kiitos',
              style: 'cancel',
              onPress: () => navigation.navigate('Koti')
            },
            {
              text: 'Kiinnostaa! →',
              onPress: () => {
                // Navigate to OmatTiedot where user can enable jatkuva tilaus
                navigation.navigate('Profiili', { showJatkuvaTilausInfo: true });
              }
            }
          ]
        );
        return;
      }
      // If no prompt needed, just navigate home
      navigation.navigate('Koti');
    } catch (error) {
      console.error('Error checking jatkuva tilaus settings:', error);
      navigation.navigate('Koti');
    }
  };

  const handleAddressSelect = (addressData) => {
    const coords = {
      latitude: addressData.geometry?.lat ?? null,
      longitude: addressData.geometry?.lng ?? null,
    };
    setAddressCoordinates(coords);
  };

  const cancelLocationRequest = () => {
    locationRequest.current += 1;
    setIsLocating(false);
  };

  const handleUseCurrentLocation = async () => {
    const request = ++locationRequest.current;
    formEdited.current = true;
    setIsLocating(true);
    try {
      const result = await getCurrentAddress(() => request === locationRequest.current);
      if (request !== locationRequest.current) return;
      setAddress(result.address);
      setValidationErrors((errors) => ({ ...errors, address: undefined }));
      setAddressCoordinates(result.coordinates);
      Alert.alert('Tarkista osoite', 'Tarkista löydetty osoite ennen tilaamista. Täydennä tarvittaessa esimerkiksi asunnon numero.');
    } catch (error) {
      if (request !== locationRequest.current) return;
      Alert.alert(
        'Sijaintia ei voitu käyttää',
        error instanceof CurrentAddressError
          ? error.message
          : 'Sijaintia tai osoitetta ei voitu hakea. Tarkista laitteen sijaintipalvelut tai syötä osoite käsin.'
      );
    } finally {
      if (request === locationRequest.current) setIsLocating(false);
    }
  };

  const scrollFocusedInputIntoView = () => {
    const scrollView = scrollViewRef.current;
    const target = focusedInput.current;
    const content = scrollView?.getInnerViewNode();
    if (target == null || content == null || scrollViewportHeight.current <= 0) return;

    UIManager.measureLayout(target, content, () => {
      if (focusedInput.current === target) console.warn('Unable to measure the focused order field');
    }, (_x, y, _width, height) => {
      if (focusedInput.current !== target) return;
      const top = scrollOffset.current;
      const visibleHeight = scrollViewportHeight.current;
      const bottom = top + visibleHeight;
      if (y + height > bottom - 12) {
        scrollView.scrollTo({ y: Math.max(0, y + height - visibleHeight + 12), animated: true });
      } else if (y < top + 12) {
        scrollView.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }
    });
  };

  const scrollToInput = (event) => {
    focusedInput.current = event.nativeEvent.target;
    scrollFocusedInputIntoView();
  };

  const clearFocusedInput = (event) => {
    if (focusedInput.current === event.nativeEvent.target) focusedInput.current = null;
  };

  const handleOrderConfirmation = async () => {
    if (orderSubmissionInProgress.current || confirmedOrder) return;
    
    if (!validateForm()) return;

    orderSubmissionInProgress.current = true;
    setIsSubmittingOrder(true);

    try {
      const deviceId = await getDeviceId();
      // Upsert user profile (will update if exists, create if not)
      const currentProfile = await getUserProfile(deviceId);
      const profileResult = await upsertUserProfile(deviceId, {
        name: firstName,
        phone: phoneNumber,
        address: address,
        email: currentProfile ? currentProfile.email : (userProfile?.email ?? null)
      });
      
      if (!profileResult.success) {
        console.error('❌ Profile upsert failed:', profileResult.error);
        Alert.alert('Virhe', `Profiilia ei voitu tallentaa: ${profileResult.error || 'Tuntematon virhe'}`);
        return;
      }
      setUserProfile(profileResult.profile);

      // Check if user has jatkuva tilaus enabled and ONLY apply to Lumityö
      let isJatkuvaTilaus = false;
      if (selectedService === 'Lumityö') {
        const orderSettings = await getOrderSettings(deviceId);
        isJatkuvaTilaus = orderSettings?.continuous_order === true;
      }

      // Determine price based on eligibility and service
      let priceEstimate;
      if (isEligibleForFree) {
        priceEstimate = 'ILMAINEN';
      } else {
        priceEstimate = selectedService === 'Lumityö' ? '10-20€' : '20-30€';
      }

      // Create order in Supabase
      const orderResult = await createSnowOrder(deviceId, {
        serviceType: selectedService,
        address: address,
        phone: phoneNumber,
        name: firstName,
        priceEstimate: priceEstimate,
        coordinates: addressCoordinates, // Pass coordinates if available
        info: info, // Pass additional information
        isRecurring: isJatkuvaTilaus, // Pass the jatkuva tilaus flag
        isFreeOrder: isEligibleForFree || false // Mark as free order
      });

      if (!orderResult.success) {
        Alert.alert('Tilauksen lähetys ei onnistunut', 'Tarkista tilaushistoria ennen kuin yrität uudelleen. Jos et ole varma, ota yhteyttä asiakaspalveluun.');
        return;
      }
      setConfirmedOrder({ service: selectedService, address });
      Keyboard.dismiss();
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

    } catch (error) {
      console.error('❌ Error creating order:', error);
      Alert.alert('Tilauksen lähetys ei onnistunut', 'Tarkista tilaushistoria ennen kuin yrität uudelleen. Jos et ole varma, ota yhteyttä asiakaspalveluun.');
    } finally {
      orderSubmissionInProgress.current = false;
      setIsSubmittingOrder(false);
    }
  };

  const finishOrder = async () => {
    setConfirmedOrder(null);
    setSelectedService(null);
    setStep(0);
    setValidationErrors({});
    formEdited.current = false;
    setInfo('');
    setAddressCoordinates(null);
    await checkFreeOrderEligibility();
    await checkAndPromptJatkuvaTilaus();
  };

  const handleContinue = () => {
    focusedInput.current = null;
    if (step === 1) {
      if (!validateForm()) return;
      cancelLocationRequest();
      Keyboard.dismiss();
      setStep(2);
    } else {
      return handleOrderConfirmation();
    }
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleBack = () => {
    focusedInput.current = null;
    cancelLocationRequest();
    Keyboard.dismiss();
    setStep(step - 1);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
          <View style={[styles.container, { paddingTop: insets.top + SCREEN_TOP_SPACING }]}>
            <ScrollView
              ref={scrollViewRef}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[screenLayout.content, styles.scrollContainer]}
              showsVerticalScrollIndicator={false}
              bounces={step !== 0}
              style={styles.scrollView}
              enableOnAndroid={true}
              keyboardDismissMode="interactive"
              onLayout={(event) => {
                scrollViewportHeight.current = event.nativeEvent.layout.height;
                scrollFocusedInputIntoView();
              }}
              onScroll={(event) => { scrollOffset.current = event.nativeEvent.contentOffset.y; }}
              scrollEventThrottle={16}
            >
              <ScreenHeader
                title={confirmedOrder ? 'Tilaus vastaanotettu' : 'Uusi tilaus'}
                subtitle={confirmedOrder ? 'Kiitos tilauksestasi.' : orderSteps[step].subtitle}
              />
              {!confirmedOrder && <View style={styles.progress} accessible accessibilityRole="progressbar" accessibilityLabel={orderSteps[step].label} accessibilityValue={{ min: 1, max: 3, now: step + 1 }}>
                <View style={styles.progressLines} pointerEvents="none">
                  {[0, 1].map((index) => (
                    <View key={index} style={[styles.progressLine, index < step && styles.progressLineComplete]} />
                  ))}
                </View>
                {orderSteps.map(({ label }, index) => (
                  <View key={label} style={[styles.progressStep, index === 0 && styles.progressStepStart, index === orderSteps.length - 1 && styles.progressStepEnd]}>
                    <View style={[styles.progressNumber, index === step && styles.progressNumberActive, index < step && styles.progressNumberComplete]}>
                      {index < step
                        ? <Ionicons name="checkmark" size={18} color={theme.colors.onPrimary} />
                        : <Text style={[styles.progressNumberText, index === step && styles.progressNumberTextActive]}>{index + 1}</Text>}
                    </View>
                    <Text style={[styles.progressLabel, index === step && styles.progressLabelActive, index === 0 && styles.progressLabelStart, index === orderSteps.length - 1 && styles.progressLabelEnd]}>{label}</Text>
                  </View>
                ))}
              </View>}
              {confirmedOrder && (
                <View style={[globalStyles.modernCard, styles.successCard]}>
                  <Ionicons name="checkmark-circle-outline" size={48} color={theme.colors.textPrimary} />
                  <Text style={styles.successTitle} accessibilityRole="header">Tilauksesi on vastaanotettu</Text>
                  <Text style={styles.successText}>Voit seurata tilaustasi Historia-välilehdellä.</Text>
                  <View style={styles.successDetails}>
                    <Text style={styles.summaryLabel}>Palvelu</Text>
                    <Text style={styles.summaryValue}>{confirmedOrder.service}</Text>
                    <Text style={styles.summaryLabel}>Osoite</Text>
                    <Text style={styles.summaryValue}>{confirmedOrder.address}</Text>
                  </View>
                </View>
              )}
              {!confirmedOrder && step === 0 && (
                <View style={styles.buttonContainer}>
                  {['Lumityö', 'Polanteen poisto'].map((service) => (
                    <AnimatedServiceButton
                      key={service}
                      service={service}
                      description={getServiceLabel(service)}
                      isSelected={selectedService === service}
                      selectingService={selectingService}
                      onPress={handleServiceSelection}
                      theme={theme}
                      styles={styles}
                    />
                  ))}
                </View>
              )}

              {/* Contact Information - Only show when service is selected */}
              {!confirmedOrder && selectedService && step === 1 && (
                <>
                  <View
                    style={[globalStyles.modernCard, styles.detailsCard]}
                  >
                    <View style={[globalStyles.cardHeader, styles.detailsHeader]}>
                      <Ionicons name="person-outline" size={24} color={theme.colors.textSecondary} />
                      <Text style={globalStyles.cardHeaderText}>Yhteystiedot</Text>
                    </View>
                    
                    <View style={[styles.inputContainer, styles.addressContainer]}>
                      <Text style={styles.inputLabel}>Osoite *</Text>
                      <AddressAutocomplete
                        value={address}
                        onChangeText={(text) => {
                          cancelLocationRequest();
                          formEdited.current = true;
                          setAddress(text);
                          if (text.trim()) setValidationErrors((errors) => ({ ...errors, address: undefined }));
                          setAddressCoordinates(null);
                        }}
                        onAddressSelect={handleAddressSelect}
                        onUseCurrentLocation={handleUseCurrentLocation}
                        onCancelCurrentLocation={cancelLocationRequest}
                        isLocating={isLocating}
                        onFocus={scrollToInput}
                        onBlur={clearFocusedInput}
                        placeholder="Esim. Mannerheimintie 1 A 5"
                        inputStyle={validationErrors.address ? [styles.input, styles.inputError] : styles.input}
                        accessibilityLabel="Osoite"
                        accessibilityHint={validationErrors.address}
                      />
                      {!!validationErrors.address && <Text style={styles.validationText} accessibilityLiveRegion="polite">{validationErrors.address}</Text>}
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Puhelinnumero *</Text>
                      <TextInput
                        ref={phoneInputRef}
                        style={[styles.input, validationErrors.phone && styles.inputError]}
                        placeholder="Esim. +358 40 123 4567"
                        placeholderTextColor={theme.colors.inputPlaceholder}
                        value={phoneNumber}
                        onChangeText={(text) => {
                          formEdited.current = true;
                          setPhoneNumber(text);
                          if (text.trim()) setValidationErrors((errors) => ({ ...errors, phone: undefined }));
                        }}
                        onFocus={scrollToInput}
                        onBlur={clearFocusedInput}
                        keyboardType="phone-pad"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => nameInputRef.current?.focus()}
                        autoComplete="tel"
                        textContentType="telephoneNumber"
                        accessibilityLabel="Puhelinnumero"
                        accessibilityHint={validationErrors.phone}
                      />
                      {!!validationErrors.phone && <Text style={styles.validationText} accessibilityLiveRegion="polite">{validationErrors.phone}</Text>}
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>Nimi *</Text>
                      <TextInput
                        ref={nameInputRef}
                        style={[styles.input, validationErrors.name && styles.inputError]}
                        placeholder="Etunimi Sukunimi"
                        placeholderTextColor={theme.colors.inputPlaceholder}
                        value={firstName}
                        onChangeText={(text) => {
                          formEdited.current = true;
                          setFirstName(text);
                          if (text.trim()) setValidationErrors((errors) => ({ ...errors, name: undefined }));
                        }}
                        onFocus={scrollToInput}
                        onBlur={clearFocusedInput}
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => infoInputRef.current?.focus()}
                        autoComplete="name"
                        textContentType="name"
                        accessibilityLabel="Nimi"
                        accessibilityHint={validationErrors.name}
                      />
                      {!!validationErrors.name && <Text style={styles.validationText} accessibilityLiveRegion="polite">{validationErrors.name}</Text>}
                    </View>
                    <View style={styles.sectionDivider} />
                    <View style={[globalStyles.cardHeader, styles.detailsHeader]}>
                      <Ionicons name="document-text-outline" size={24} color={theme.colors.textSecondary} />
                      <Text style={globalStyles.cardHeaderText}>Lisätiedot</Text>
                    </View>
                    <TextInput
                      ref={infoInputRef}
                      style={[styles.input, styles.textArea]}
                      placeholder="Kerro erityistoiveista tai ohjeista..."
                      placeholderTextColor={theme.colors.inputPlaceholder}
                      value={info}
                      onChangeText={(text) => { formEdited.current = true; setInfo(text); }}
                      onFocus={scrollToInput}
                      onBlur={clearFocusedInput}
                      multiline
                      numberOfLines={6}
                      textAlignVertical="top"
                      returnKeyType="done"
                      blurOnSubmit={true}
                      accessibilityLabel="Lisätiedot"
                    />
                  </View>

                </>
              )}
              {!confirmedOrder && selectedService && step === 2 && (
                <>
                  <View style={globalStyles.modernCard}>
                    {[
                      ['Valitse palvelu', selectedService],
                      ['Osoite', address],
                      ['Puhelinnumero', phoneNumber],
                      ['Nimi', firstName],
                      ...(info ? [['Lisätiedot', info]] : []),
                    ].map(([label, value]) => (
                      <View key={label} style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{label}</Text>
                        <Text style={styles.summaryValue}>{value}</Text>
                      </View>
                    ))}
                    <Text style={styles.serviceDescription}>{getServiceLabel()}</Text>
                  </View>
                </>
              )}

            </ScrollView>
            {confirmedOrder ? <View style={styles.actionFooterBackground}>
              <View style={styles.actionFooter}>
                <TouchableOpacity style={styles.nextButton} onPress={finishOrder} accessibilityRole="button">
                  <Text style={styles.confirmButtonText}>Valmis</Text>
                </TouchableOpacity>
              </View>
            </View> : step > 0 && <View style={styles.actionFooterBackground}>
              <View style={[styles.actionFooter, isKeyboardVisible && styles.actionFooterKeyboard]}>
                {step > 0 && (
                  <TouchableOpacity
                    style={[styles.backButton, isSubmittingOrder && styles.disabledButton]}
                    onPress={handleBack}
                    disabled={isSubmittingOrder}
                    accessibilityRole="button"
                  >
                    <Text style={styles.backButtonText}>Takaisin</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.nextButton, isSubmittingOrder && styles.disabledButton]}
                  onPress={handleContinue}
                  disabled={isSubmittingOrder}
                  accessibilityRole="button"
                >
                  <Text style={styles.confirmButtonText}>
                    {step === 2 ? (isSubmittingOrder ? 'Lähetetään...' : 'Vahvista tilaus') : 'Jatka'}
                  </Text>
                  {step !== 2 && <Ionicons name="arrow-forward" size={20} color={theme.colors.onPrimary} />}
                </TouchableOpacity>
              </View>
            </View>}
          </View>
        </KeyboardAvoidingView>
    </View>
  );
};

const createOrderStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 24,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 12,
  },
  bgImage: {
    flex: 1,
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.overlay,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16, // Reduced from theme.spacing.xl
    marginTop: 8, // Reduced from theme.spacing.lg
    paddingHorizontal: 20,
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.textLight,
    textAlign: 'center',

  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    opacity: 0.95,

  },
  card: {
    ...createCardStyle(theme),
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // High opacity for elder accessibility
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  buttonContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 24,
  },
  serviceButton: {
    paddingVertical: 20,
    paddingLeft: 0,
    paddingRight: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.colors.border,
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  serviceIcon: {
    width: 72,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.colors.border,
  },
  selectedServiceButton: {
    borderColor: theme.colors.textPrimary,
  },
  serviceButtonText: {
    ...theme.typography.cardTitle,
    color: theme.colors.textPrimary,
  },
  progress: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 8,
  },
  progressLines: {
    position: 'absolute',
    left: 15,
    right: 15,
    top: 14,
    flexDirection: 'row',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: theme.colors.border,
  },
  progressLineComplete: {
    backgroundColor: theme.colors.primary,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  progressStepStart: {
    alignItems: 'flex-start',
  },
  progressStepEnd: {
    alignItems: 'flex-end',
  },
  progressNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNumberActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  progressNumberComplete: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  progressNumberText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontFamily: theme.fonts.semibold,
  },
  progressNumberTextActive: {
    color: theme.colors.onPrimary,
  },
  progressLabel: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  progressLabelActive: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fonts.semibold,
  },
  progressLabelStart: {
    textAlign: 'left',
  },
  progressLabelEnd: {
    textAlign: 'right',
  },
  serviceCardDescription: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: 4 },
  serviceDescription: {
    ...theme.typography.bodySmall,
    color: theme.colors.textSecondary,
    textAlign: 'left',
    fontFamily: theme.fonts.medium,
  },
  successCard: {
    alignItems: 'center',
    gap: 12,
  },
  successTitle: {
    ...theme.typography.h3,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  successText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  successDetails: {
    alignSelf: 'stretch',
    gap: 4,
    marginTop: 8,
  },

  inputContainer: {
    marginBottom: 8,
  },
  detailsCard: {
    padding: 14,
    marginBottom: 8,
  },
  detailsHeader: {
    marginBottom: 8,
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    marginBottom: 8,
  },
  addressContainer: {
    marginBottom: 8,
    zIndex: 10, // Moderate z-index for dropdown visibility
    elevation: 10, // For Android
  },
  inputLabel: {
    ...theme.typography.label,
    color: theme.colors.textPrimary,
    marginBottom: 4,

  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.controlBorder,
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    fontFamily: theme.fonts.regular,
    backgroundColor: theme.mode === 'light' ? theme.colors.input : theme.colors.orderSurface,
    color: theme.colors.controlText,
    minHeight: 48,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  inputError: {
    borderWidth: 2,
    borderColor: '#B42318',
  },
  validationText: {
    ...theme.typography.bodySmall,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  textArea: {
    height: 64,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  confirmButtonText: {
    ...theme.typography.button,
    color: theme.colors.onPrimary,

  },
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  footerText: {
    ...theme.typography.caption,
    color: theme.colors.textLight,
    opacity: 0.9,
    textAlign: 'center',

  },
  actionFooterBackground: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  actionFooter: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    paddingBottom: 12,
  },
  actionFooterKeyboard: {
    paddingBottom: 10,
  },
  nextButton: { flex: 2, backgroundColor: theme.colors.primary, borderRadius: 16, minHeight: 52, paddingHorizontal: 10, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  backButton: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: theme.colors.controlBorder, backgroundColor: theme.colors.surfaceRaised },
  backButtonText: { ...theme.typography.button, color: theme.colors.controlText },
  summaryRow: { borderBottomWidth: 1, borderBottomColor: theme.colors.borderLight, paddingVertical: 10 },
  summaryLabel: { ...theme.typography.caption, color: theme.colors.textSecondary, fontFamily: theme.fonts.semibold },
  summaryValue: { ...theme.typography.body, color: theme.colors.textPrimary, lineHeight: 24, marginTop: 2 },
});

export default OrderScreen;
