import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, Alert, ScrollView, KeyboardAvoidingView, Platform, Image, StatusBar, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import emailjs from 'emailjs-com';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import createSharedStyles from '../styles';
import { useTheme } from '../ThemeContext';
import ScreenHeader, { SCREEN_TOP_SPACING, screenLayout } from '../components/ScreenHeader';
import AddressAutocompleteMapboxNew from '../components/AddressAutocompleteMapboxNew';
import { getDeviceId } from '../FreeOrderUtils';
import { getUserProfile, upsertUserProfile, getOrdersByDevice, getOrderSettings, saveOrderSettings } from '../SupabaseAPI';

const SHOW_PRIVACY_BUTTON = false;

const OmatTiedotScreen = ({ route }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme, mode, setThemeMode } = useTheme();
  const styles = createSharedStyles(theme);
  const profileStyles = createProfileStyles(theme);
  
  // User details state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Profile and order state
  const [userProfile, setUserProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  
  // Continuous order state
  const [continuousOrder, setContinuousOrder] = useState(false);
  const [continuousOrderInfo, setContinuousOrderInfo] = useState('');
  const [showContinuousOrderInfo, setShowContinuousOrderInfo] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSavingContinuousOrder, setIsSavingContinuousOrder] = useState(false);
  const profileOperationInProgress = useRef(false);

  // Contact modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const contactScrollRef = useRef(null);
  const contactPanelY = useRef(0);
  const contactFieldPositions = useRef({});
  const focusedContactField = useRef(null);

  // Edit mode and saving state
  const [isEditMode, setIsEditMode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Load order history on mount; profile data is refreshed whenever this tab gains focus.
  useEffect(() => {
    loadOrderHistory();
  }, []);

  // Show success message if user converted order to jatkuva tilaus
  useEffect(() => {
    if (route?.params?.jatkuvaTilaasEnabled) {
      setTimeout(() => {
        Alert.alert(
          'Jatkuva tilaus aktivoitu!',
          'Edellinen tilauksesi on muutettu jatkuvaksi tilaukseksi. Jatkuva tilaus -asetus on nyt käytössä.',
          [{ text: 'Selvä!' }]
        );
      }, 1000); // Small delay to ensure UI has loaded
    } else if (route?.params?.showJatkuvaTilausInfo) {
      setTimeout(() => {
        Alert.alert(
          'Jatkuva tilaus',
          'Aktivoi jatkuva tilaus -kytkin alla olevasta asetuksesta. Näin saat automaattisen lumityöpalvelun ilman erillistä tilausta joka kerta.',
          [{ text: 'Selvä!' }]
        );
      }, 500);
    }
  }, [route?.params?.jatkuvaTilaasEnabled, route?.params?.showJatkuvaTilausInfo]);

  // Reload data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  const loadUserData = async () => {
    setIsLoadingProfile(true);
    try {
      const deviceId = await getDeviceId();
      const profile = await getUserProfile(deviceId);
      
      if (profile) {
        setUserProfile(profile);
        setName(profile.name || '');
        setAddress(profile.address || '');
        setPhone(profile.phone || '');
        setEmail(profile.email || '');
        
        // Set edit mode based on whether user has complete required data
        const hasCompleteData = profile.name && profile.address && profile.phone;
        setIsEditMode(!hasCompleteData);
        
        // Load order settings - ALWAYS set the switch state, even if no settings exist
        const settings = await getOrderSettings(deviceId);
        if (settings) {
          setContinuousOrder(settings.continuous_order === true);
        } else {
          // No settings found, default to OFF
          setContinuousOrder(false);
        }
      } else {
        // No profile exists, start in edit mode
        setIsEditMode(true);
        setContinuousOrder(false);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleContinuousOrderToggle = async (value) => {
    if (profileOperationInProgress.current) return;

    // Validate required fields before enabling
    const savedDetailsComplete = [userProfile?.name, userProfile?.address, userProfile?.phone]
      .every((field) => typeof field === 'string' && field.trim());
    if (value && (!name.trim() || !address.trim() || !phone.trim() || !savedDetailsComplete)) {
      Alert.alert(
        'Puutteelliset tiedot',
        'Jatkuva tilaus vaatii seuraavat tiedot:\n\n• Nimi\n• Osoite\n• Puhelinnumero\n\nTäytä ensin kaikki pakolliset tiedot ja tallenna ne.',
        [
          { 
            text: 'OK', 
            style: 'default'
          }
        ]
      );
      return;
    }
    
    profileOperationInProgress.current = true;
    setContinuousOrder(value);
    setIsSavingContinuousOrder(true);
    
    // Save the toggle state immediately to Supabase
    try {
      const deviceId = await getDeviceId();
      const result = await saveOrderSettings(deviceId, {
        continuousOrder: value,
        preferredService: 'Lumityö'
      });
        
      if (!result.success) {
        console.error('❌ Failed to save order settings:', result.error);
        Alert.alert('Virhe', result.error || 'Asetuksen tallentaminen epäonnistui');
        // Revert the toggle on error
        setContinuousOrder(!value);
        return;
      }
      
      console.log(`🔄 Jatkuva tilaus toggle ${value ? 'enabled' : 'disabled'} and saved immediately`);
      
      // Reload order history to reflect the change
      await loadOrderHistory();
    } catch (error) {
      console.error('Error saving continuous order setting:', error);
      Alert.alert('Virhe', 'Asetuksen tallentaminen epäonnistui');
      // Revert the toggle on error
      setContinuousOrder(!value);
    } finally {
      profileOperationInProgress.current = false;
      setIsSavingContinuousOrder(false);
    }
  };

  const loadOrderHistory = async () => {
    try {
      const deviceId = await getDeviceId();
      const orders = await getOrdersByDevice(deviceId);
      setOrders(orders || []);
      console.log(`📋 Loaded ${orders?.length || 0} orders`);
    } catch (error) {
      console.error('Error loading order history:', error);
    }
  };

  const saveUserData = async () => {
    if (profileOperationInProgress.current) return;

    profileOperationInProgress.current = true;
    setIsSaving(true);
    
    try {
      const deviceId = await getDeviceId();
      const profileData = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        email: email.trim(),
      };

      if (!profileData.name || !profileData.address || !profileData.phone) {
        const settings = await getOrderSettings(deviceId, { throwOnError: true });
        if (settings?.continuous_order) {
          Alert.alert('Jatkuva tilaus aktiivinen', 'Poista jatkuva tilaus käytöstä ennen kuin poistat pakollisia yhteystietoja.');
          return;
        }
      }
      
      // Upsert profile (creates or updates)
      const result = await upsertUserProfile(deviceId, profileData);
      
      if (!result.success) {
        Alert.alert('Virhe', 'Tietojen tallentaminen epäonnistui');
        return;
      }
      
      setUserProfile(result.profile);
      setName(profileData.name);
      setAddress(profileData.address);
      setPhone(profileData.phone);
      setEmail(profileData.email);

      // Profile data saved successfully
      Alert.alert(
        'Onnistui', 
        'Tiedot tallennettu!',
        [{ text: 'OK', onPress: () => {
          setIsEditMode(false); // Switch to view mode after successful save
          loadOrderHistory();
        }}]
      );

    } catch (error) {
      console.error('Error saving user data:', error);
      Alert.alert('Virhe', 'Tietojen tallentaminen epäonnistui');
    } finally {
      profileOperationInProgress.current = false;
      setIsSaving(false);
    }
  };

  const handleEditToggle = () => {
    setIsEditMode(!isEditMode);
  };

  const handleCancelEditing = () => {
    setName(userProfile?.name || '');
    setAddress(userProfile?.address || '');
    setPhone(userProfile?.phone || '');
    setEmail(userProfile?.email || '');
    setIsEditMode(false);
  };

  const handleThemeToggle = async (useLightTheme) => {
    try {
      await setThemeMode(useLightTheme ? 'light' : 'dark');
    } catch (error) {
      console.error('Unable to save theme preference:', error);
      Alert.alert('Virhe', 'Teeman vaihtaminen ei onnistunut. Yritä uudelleen.');
    }
  };

  const scrollToFocusedContactField = () => {
    const position = contactFieldPositions.current[focusedContactField.current];
    if (typeof position === 'number') {
      contactScrollRef.current?.scrollTo({
        y: Math.max(0, contactPanelY.current + position - 12),
        animated: true,
      });
    }
  };

  const openDeletionRequest = () => {
    const request = 'Pyydän henkilötietojeni poistamista.';
    const openForm = () => {
      setContactMessage(request);
      if (!contactEmail.trim() && email.trim()) setContactEmail(email.trim());
      setShowPrivacy(false);
      setShowContactModal(true);
    };

    if (contactMessage.trim() && !contactMessage.startsWith(request)) {
      Alert.alert(
        'Keskeneräinen viesti',
        'Yhteydenottolomakkeessa on keskeneräinen viesti. Korvataanko se poistopyynnöllä?',
        [
          { text: 'Peruuta', style: 'cancel' },
          { text: 'Korvaa viesti', onPress: openForm },
        ]
      );
      return;
    }

    if (contactMessage.startsWith(request)) {
      setShowPrivacy(false);
      setShowContactModal(true);
      return;
    }
    openForm();
  };

  // Contact functions
  const handleContactSubmit = async () => {
    if (!contactMessage.trim()) {
      Alert.alert('Virhe', 'Kirjoita viestisi ennen lähettämistä.');
      return;
    }
    
    if (!contactEmail.trim()) {
      Alert.alert('Virhe', 'Anna sähköpostiosoitteesi, jotta voimme ottaa sinuun yhteyttä.');
      return;
    }

    setIsSubmittingContact(true);
    
    try {
      const templateParams = {
        message: contactMessage,
        email: contactEmail || 'Ei sähköpostia',
        to_name: 'Lumityöt'
      };

      // Use the correct EmailJS configuration from environment
      await emailjs.send(
        process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID,
        process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID,
        templateParams,
        process.env.EXPO_PUBLIC_EMAILJS_USER_ID
      );

      Alert.alert(
        'Viestin lähetetty!',
        'Viestisi on lähetetty onnistuneesti. Otamme sinuun yhteyttä pian.',
        [{ text: 'OK', onPress: () => {
          setShowContactModal(false);
          setContactMessage('');
          setContactEmail('');
        }}]
      );
    } catch (error) {
      console.error('Contact form error:', error);
      Alert.alert(
        'Virhe',
        'Viestin lähettäminen epäonnistui. Yritä myöhemmin uudelleen tai ota yhteyttä puhelimitse.'
      );
    } finally {
      setIsSubmittingContact(false);
    }
  };

  const renderOrderItem = ({ item }) => {
    // Convert status to user-friendly Finnish text with icons
    const getStatusIcon = (status) => {
      switch (status) {
        case 'odottaa': return 'time-outline';
        case 'kuitattu': return 'checkmark-circle-outline';
        case 'kesken': return 'build-outline';
        default: return 'document-outline';
      }
    };

    const getStatusText = (status) => {
      switch (status) {
        case 'odottaa': return 'Odottaa';
        case 'kuitattu': return 'Valmis';
        case 'kesken': return 'Työn alla';
        default: return status;
      }
    };

    // Get status color
    const getStatusColor = (status) => {
      switch (status) {
        case 'odottaa': return theme.colors.warning; // Orange
        case 'kuitattu': return theme.colors.success; // Green
        case 'kesken': return theme.colors.info; // Blue
        default: return '#999'; // Gray
      }
    };

    return (
      <View style={styles.modernOrderItem}>
        <View style={styles.orderItemHeader}>
          <Ionicons name="snow-outline" size={20} color={theme.colors.textPrimary} />
          <Text style={styles.orderItemTitle}>{item.service_type}</Text>
          {item.is_free_order === 1 && (
            <View style={{ marginLeft: 'auto', backgroundColor: theme.colors.surfaceRaised, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ color: theme.colors.controlText, fontSize: 10, fontWeight: 'bold' }}>ILMAINEN</Text>
            </View>
          )}
        </View>
        <View style={styles.orderItemContent}>
          <View style={styles.orderItemRow}>
            <Ionicons name="location-outline" size={16} color="#ccc" />
            <Text style={styles.orderItemText}>{item.address}</Text>
          </View>
          <View style={styles.orderItemRow}>
            <Ionicons name={getStatusIcon(item.status)} size={16} color={getStatusColor(item.status)} />
            <Text style={[styles.orderItemText, { color: getStatusColor(item.status), fontWeight: 'bold' }]}>
              {getStatusText(item.status)}
            </Text>
          </View>
          <View style={styles.orderItemRow}>
            <Ionicons name="calendar-outline" size={16} color="#ccc" />
            <Text style={styles.orderItemText}>{new Date(item.created_at).toLocaleDateString('fi-FI')}</Text>
          </View>
          {item.price_estimate && (
            <View style={styles.orderItemRow}>
              <Ionicons name="card-outline" size={16} color="#636363ff" />
              <Text style={styles.orderItemText}>{item.price_estimate}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };



  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={[screenLayout.content, { paddingBottom: 24, paddingTop: insets.top + SCREEN_TOP_SPACING }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          <ScreenHeader title="Omat tiedot" subtitle="Hallitse yhteystietoja ja tilausasetuksia" />

          {isLoadingProfile ? (
            <View style={{ alignItems: 'center', paddingVertical: 36 }}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={{ ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: 12 }}>Ladataan tietoja...</Text>
            </View>
          ) : (
          <>
          <View style={[styles.modernCard, profileStyles.preferenceCard]}>
           <View style={[styles.cardHeader, profileStyles.contactCardHeader]}>
            <Ionicons name="person-circle-outline" size={32} color={theme.colors.accent} />
            <Text style={styles.cardHeaderText}>Yhteystiedot</Text>
          </View>
          {isEditMode ? (
            <>
              <View style={[styles.inputContainer, profileStyles.contactInputContainer]}>
                <Text style={[styles.label, profileStyles.contactLabel]}>Nimi *</Text>
                <TextInput
                  style={[styles.input, profileStyles.formInput]}
                  placeholder="Syötä nimesi"
                  placeholderTextColor={theme.mode === 'light' ? theme.colors.inputPlaceholder : '#D4D4D4'}
                  accessibilityLabel="Nimi"
                  value={name}
                  editable={!isSaving}
                  onChangeText={setName}
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
              </View>

              <View style={[styles.inputContainer, profileStyles.contactInputContainer, profileStyles.addressContainer]}>
                <Text style={[styles.label, profileStyles.contactLabel]}>Osoite *</Text>
                <AddressAutocompleteMapboxNew
                  value={address}
                  editable={!isSaving}
                  onChangeText={setAddress}
                  onAddressSelect={(addressData) => {
                    const displayAddress = typeof addressData === 'string' ? addressData : addressData.displayAddress || addressData.formatted || addressData;
                    setAddress(displayAddress);
                  }}
                  placeholder="Syötä osoitteesi"
                  accessibilityLabel="Osoite"
                  placeholderTextColor={theme.mode === 'light' ? theme.colors.inputPlaceholder : '#D4D4D4'}
                  inputStyle={profileStyles.formInput}
                />
              </View>

              <View style={[styles.inputContainer, profileStyles.contactInputContainer]}>
                <Text style={[styles.label, profileStyles.contactLabel]}>Puhelinnumero *</Text>
                <TextInput
                  style={[styles.input, profileStyles.formInput]}
                  placeholder="Syötä puhelinnumerosi"
                  placeholderTextColor={theme.mode === 'light' ? theme.colors.inputPlaceholder : '#D4D4D4'}
                  accessibilityLabel="Puhelinnumero"
                  value={phone}
                  editable={!isSaving}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  blurOnSubmit={false}
                />
              </View>

              <View style={[styles.inputContainer, profileStyles.contactInputContainer]}>
                <Text style={[styles.label, profileStyles.contactLabel]}>Sähköposti</Text>
                <TextInput
                  style={[styles.input, profileStyles.formInput]}
                  placeholder="Syötä sähköpostiosoitteesi"
                  placeholderTextColor={theme.mode === 'light' ? theme.colors.inputPlaceholder : '#D4D4D4'}
                  accessibilityLabel="Sähköposti"
                  value={email}
                  editable={!isSaving}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="done"
                  blurOnSubmit
                />
              </View>
            </>
          ) : (
            <View style={profileStyles.contactDetails}>
              <ProfileDetail label="Nimi" value={name} />
              <ProfileDetail label="Osoite" value={address} />
              <ProfileDetail label="Puhelin" value={phone} />
              <ProfileDetail label="Sähköposti" value={email} />
            </View>
          )}

          <TouchableOpacity 
            style={[styles.confirmButton, profileStyles.contactAction, isSaving && { opacity: 0.6 }]} 
            onPress={isEditMode ? saveUserData : handleEditToggle}
            disabled={isSaving || isSavingContinuousOrder}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons 
                name={isEditMode ? "save-outline" : "create-outline"} 
                size={20} 
                color={theme.colors.onPrimary}
                style={{ marginRight: 8 }} 
              />
              <Text style={styles.confirmButtonText}>
                {isEditMode 
                  ? (isSaving ? 'Tallennetaan...' : 'Tallenna Tiedot')
                  : 'Muokkaa Tiedot'
                }
              </Text>
            </View>
          </TouchableOpacity>
          {isEditMode && userProfile && (
            <TouchableOpacity
              style={[styles.confirmButton, profileStyles.contactAction, { marginTop: 8, backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.border }]}
              onPress={handleCancelEditing}
              disabled={isSaving || isSavingContinuousOrder}
              accessibilityRole="button"
            >
              <Text style={[styles.confirmButtonText, { color: theme.colors.textSecondary }]}>Peruuta muokkaus</Text>
            </TouchableOpacity>
          )}

          <Text style={profileStyles.requiredNote}>
            * Pakolliset tiedot jatkuvaa tilausta varten. Aiemmat tilaukset säilyttävät tilausten yhteystiedot.
          </Text>
          <View style={profileStyles.sectionDivider} />
          <View style={[styles.cardHeader, profileStyles.contactCardHeader]}>
            <Ionicons name="settings-outline" size={24} color={theme.colors.textPrimary} />
            <Text style={styles.cardHeaderText}>Tilausasetukset</Text>
          </View>
          <View style={[styles.modernSwitchContainer, profileStyles.continuousOrderSwitch]}>
            <View style={styles.switchContent}>
              <Ionicons name="repeat-outline" size={24} color={theme.colors.textPrimary} />
              <Text style={[styles.modernSwitchLabel, profileStyles.continuousOrderLabel]}>Jatkuva tilaus</Text>
            </View>
            <Switch
              trackColor={{ false: '#777777', true: theme.colors.primary }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#777777"
              onValueChange={handleContinuousOrderToggle}
              value={continuousOrder}
              disabled={isSaving || isSavingContinuousOrder || isLoadingProfile}
              accessibilityLabel="Jatkuva tilaus"
              accessibilityRole="switch"
              accessibilityState={{ checked: continuousOrder, disabled: isSaving || isSavingContinuousOrder || isLoadingProfile }}
            />
          </View>
          <Text style={profileStyles.orderStatus}>
            {continuousOrder
              ? 'Jatkuva tilaus -asetus on käytössä. Tulevat tilauksesi merkitään automaattisesti jatkuviksi tilauksiksi.'
              : !name.trim() || !address.trim() || !phone.trim()
                ? 'Täytä ensin pakolliset tiedot (nimi*, osoite*, puhelinnumero*) ja tallenna ne jatkuvan tilauksen aktivoimiseksi.'
                : 'Jatkuva tilaus -asetus ei ole käytössä. Tulevat tilauksesi luodaan kertatilauksina.'
            }
          </Text>
          <Text style={profileStyles.orderSummary}>
            Kun asetus on käytössä, lumityöt tehdään automaattisesti ilman erillistä tilausta.
          </Text>
          <TouchableOpacity
            style={profileStyles.orderInfoButton}
            onPress={() => setShowContinuousOrderInfo(true)}
            accessibilityRole="button"
          >
            <Text style={profileStyles.orderInfoButtonText}>Lue jatkuvan tilauksen ehdot</Text>
          </TouchableOpacity>
          <View style={profileStyles.sectionDivider} />
          <View style={styles.cardHeader}>
            <Ionicons name="color-palette-outline" size={24} color={theme.colors.accent} />
            <Text style={styles.cardHeaderText}>Ulkoasu</Text>
          </View>
          <View style={styles.modernSwitchContainer}>
            <View style={styles.switchContent}>
              <Ionicons name={mode === 'light' ? 'sunny-outline' : 'moon-outline'} size={20} color={theme.colors.textSecondary} />
              <Text style={styles.modernSwitchLabel}>Vaalea teema</Text>
            </View>
            <Switch
              value={mode === 'light'}
              onValueChange={handleThemeToggle}
              trackColor={{ false: '#777777', true: theme.colors.primary }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Vaalea teema"
              accessibilityRole="switch"
              accessibilityState={{ checked: mode === 'light' }}
            />
          </View>
          <Text style={{ ...theme.typography.caption, color: theme.colors.textMuted }}>
            Teema tallennetaan laitteellesi. Vaalea teema on käytössä oletuksena.
          </Text>
          <View style={profileStyles.sectionDivider} />
          <TouchableOpacity
            style={[styles.confirmButton, profileStyles.contactAction, {
              backgroundColor: theme.colors.surfaceRaised,
              marginTop: 0,
              borderWidth: 1,
              borderColor: theme.colors.controlBorder
            }]}
            onPress={() => setShowContactModal(true)}
            accessibilityRole="button"
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.controlText} style={{ marginRight: 8 }} />
              <Text style={[styles.confirmButtonText, { color: theme.colors.controlText }]}>Ota yhteyttä</Text>
            </View>
          </TouchableOpacity>
        </View>
          {SHOW_PRIVACY_BUTTON && (
            <TouchableOpacity
              style={profileStyles.privacyButton}
              onPress={() => setShowPrivacy(true)}
              accessibilityRole="button"
              accessibilityLabel="Tietosuoja ja tietojen poistaminen"
            >
              <Text style={profileStyles.privacyButtonText}>Tietosuoja</Text>
            </TouchableOpacity>
          )}
          </>
          )}
      </ScrollView>

      <Modal
        visible={showContinuousOrderInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContinuousOrderInfo(false)}
      >
        <View style={[profileStyles.orderModalOverlay, {
          paddingTop: Math.max(insets.top, 20),
          paddingBottom: Math.max(insets.bottom, 20),
        }]}>
          <View style={[profileStyles.orderModal, profileStyles.orderInfoModal]} accessibilityViewIsModal>
            <ScrollView style={profileStyles.orderModalScroll}>
              <Text style={profileStyles.orderInfoTitle} accessibilityRole="header">
                Jatkuva tilaus - Kuinka se toimii?
              </Text>
              <View style={profileStyles.orderInfoSection}>
                <Text style={profileStyles.orderInfoSectionTitle}>Toiminta</Text>
                <Text style={profileStyles.orderInfoDetailText}>
                  Kun asetus on päällä, lumityöt tehdään annettuun osoitteeseen ilman erillistä tilausta. Työt suoritetaan automaattisesti, kun lunta on satanut merkittävä määrä.
                </Text>
              </View>
              <View style={profileStyles.orderInfoSection}>
                <Text style={profileStyles.orderInfoSectionTitle}>Laskutus</Text>
                <Text style={profileStyles.orderInfoDetailText}>
                  Kun lumitöitä on kertynyt 5 kertaa, lähetetään lasku joko paperisena tai suoraan sähköpostiin. Halutessasi voit myös sopia koko talven laskutuksen yhdellä laskulla.
                </Text>
              </View>
              <View style={profileStyles.orderInfoSection}>
                <Text style={profileStyles.orderInfoSectionTitle}>Peruutus</Text>
                <Text style={profileStyles.orderInfoDetailText}>
                  Voit ottaa asetuksen pois päältä milloin tahansa. Aiemmin tehtyjen lumitöiden tiedot näkyvät tilaushistoriassa.
                </Text>
              </View>
              <Text style={profileStyles.orderInfoDetailText}>
                Toivottavasti olet tyytyväinen palveluun! Kiitos, kun käytät sovellusta.
              </Text>
            </ScrollView>
            <TouchableOpacity
              style={profileStyles.orderModalClose}
              onPress={() => setShowContinuousOrderInfo(false)}
              accessibilityRole="button"
            >
              <Text style={profileStyles.orderModalCloseText}>Sulje</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Contact Modal */}
      <Modal
        visible={showContactModal || showPrivacy}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (showPrivacy) setShowPrivacy(false);
          else setShowContactModal(false);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            ref={contactScrollRef}
            style={profileStyles.contactModalOverlay}
            contentContainerStyle={[profileStyles.contactModalContent, {
              paddingTop: Math.max(insets.top, 20),
              paddingBottom: Math.max(insets.bottom, 20),
            }]}
            keyboardShouldPersistTaps="handled"
            onLayout={scrollToFocusedContactField}
          >
          <View
            style={[profileStyles.orderModal, profileStyles.orderInfoModal, profileStyles.contactModal]}
            accessibilityViewIsModal
            onLayout={(event) => {
              contactPanelY.current = event.nativeEvent.layout.y;
              scrollToFocusedContactField();
            }}
          >
            {showPrivacy ? (
            <>
              <Text style={profileStyles.orderInfoTitle} accessibilityRole="header">Tietosuoja</Text>
              <View style={profileStyles.orderInfoSection}>
                <Text style={profileStyles.orderInfoSectionTitle}>Sovelluksessa käsiteltävät tiedot</Text>
                <Text style={profileStyles.orderInfoDetailText}>
                  Sovellus tallentaa yhteystietoja, tilausten tietoja ja laitteeseen liittyvän tunnisteen. Tilaustiedot voivat sisältää osoitteen ja sijaintikoordinaatit.
                </Text>
              </View>
              <View style={profileStyles.orderInfoSection}>
                <Text style={profileStyles.orderInfoSectionTitle}>Palvelut ja sijainti</Text>
                <Text style={profileStyles.orderInfoDetailText}>
                  Osoitehaut ja kartta käyttävät ulkopuolisia karttapalveluita. Paikannukseen pyydetään lupa. Yhteydenottoviesti lähetetään sähköpostipalvelun kautta.
                </Text>
              </View>
              <View style={profileStyles.orderInfoSection}>
                <Text style={profileStyles.orderInfoSectionTitle}>Tietojen poistaminen</Text>
                <Text style={profileStyles.orderInfoDetailText}>
                  Voit lähettää pyynnön henkilötietojesi poistamisesta. Pyynnön lähettäminen ei poista tietoja automaattisesti. Asiakaspalvelu voi pyytää lisätietoja henkilöllisyytesi varmistamiseksi.
                </Text>
              </View>
              <Text style={profileStyles.orderInfoDetailText}>
                Tämä on lyhyt kuvaus, ei täydellinen tietosuojaseloste. Voit pyytää lisätietoja asiakaspalvelusta.
              </Text>
              <TouchableOpacity
                style={profileStyles.privacyRequestButton}
                onPress={openDeletionRequest}
                accessibilityRole="button"
              >
                <Text style={profileStyles.privacyRequestText}>Pyydä tietojeni poistamista</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={profileStyles.orderModalClose}
                onPress={() => setShowPrivacy(false)}
                accessibilityRole="button"
              >
                <Text style={profileStyles.orderModalCloseText}>Sulje</Text>
              </TouchableOpacity>
            </>
            ) : (
            <>
            <View style={profileStyles.contactModalHeader}>
              <Text style={profileStyles.contactModalTitle} accessibilityRole="header">
                Ota yhteyttä
              </Text>
              <TouchableOpacity
                style={profileStyles.contactModalDismiss}
                onPress={() => setShowContactModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Sulje yhteydenottolomake"
              >
                <Ionicons name="close" size={24} color={theme.mode === 'light' ? theme.colors.controlSecondary : theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

              <Text style={profileStyles.contactModalDescription}>
                Laita viesti - otamme sinuun yhteyttä pian!
              </Text>

              <View style={profileStyles.contactEmailField} onLayout={(event) => {
                contactFieldPositions.current.email = event.nativeEvent.layout.y;
                scrollToFocusedContactField();
              }}>
              <Text style={[styles.label, profileStyles.contactLabel, profileStyles.contactModalLabel]}>
                Sähköpostiosoite
              </Text>
              <TextInput
                style={profileStyles.formInput}
                placeholder="esim. maija@example.com"
                placeholderTextColor={theme.mode === 'light' ? theme.colors.inputPlaceholder : '#D4D4D4'}
                accessibilityLabel="Sähköpostiosoite"
                value={contactEmail}
                onChangeText={setContactEmail}
                onFocus={() => {
                  focusedContactField.current = 'email';
                  scrollToFocusedContactField();
                }}
                onBlur={() => { focusedContactField.current = null; }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />
              </View>

              <View onLayout={(event) => {
                contactFieldPositions.current.message = event.nativeEvent.layout.y;
                scrollToFocusedContactField();
              }}>
              <Text style={[styles.label, profileStyles.contactLabel, profileStyles.contactModalLabel]}>
                Viesti
              </Text>
              <TextInput
                style={[profileStyles.formInput, profileStyles.contactMessageInput]}
                placeholder="Kirjota tähän..."
                placeholderTextColor={theme.mode === 'light' ? theme.colors.inputPlaceholder : '#D4D4D4'}
                accessibilityLabel="Viesti"
                multiline
                numberOfLines={6}
                value={contactMessage}
                onChangeText={setContactMessage}
                onFocus={() => {
                  focusedContactField.current = 'message';
                  scrollToFocusedContactField();
                }}
                onBlur={() => { focusedContactField.current = null; }}
                maxLength={500}
              />

              <Text style={{
                ...theme.typography.caption,
                color: theme.mode === 'light' ? theme.colors.controlSecondary : theme.colors.textMuted,
                textAlign: 'right',
                marginTop: 8
              }}>
                {contactMessage.length}/500
              </Text>
              </View>

            <View style={profileStyles.contactModalActions}>
              <TouchableOpacity
                style={[profileStyles.contactModalButton, profileStyles.contactModalCancel]}
                onPress={() => setShowContactModal(false)}
                accessibilityRole="button"
              >
                <Text style={{
                  ...theme.typography.label,
                  color: theme.colors.controlText,
                }}>
                  Peruuta
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[profileStyles.contactModalButton, {
                  backgroundColor: theme.colors.primary,
                  opacity: isSubmittingContact ? 0.6 : 1
                }]}
                onPress={handleContactSubmit}
                disabled={isSubmittingContact}
                accessibilityRole="button"
              >
                <Text style={{
                  ...theme.typography.label,
                  color: theme.colors.onPrimary,
                }}>
                  {isSubmittingContact ? 'Lähetetään...' : 'Lähetä'}
                </Text>
              </TouchableOpacity>
            </View>
            </>
            )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
    </View>
  );
};

const createProfileStyles = (theme) => StyleSheet.create({
  contactCardHeader: {
    marginBottom: 16,
  },
  preferenceCard: {
    padding: 16,
    marginBottom: 12,
  },
  continuousOrderSwitch: {
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
    paddingLeft: 12,
  },
  continuousOrderLabel: {
    ...theme.typography.cardTitle,
    flexShrink: 1,
  },
  orderStatus: {
    color: theme.colors.textSecondary,
    ...theme.typography.bodySmall,
    marginTop: 8,
  },
  orderSummary: {
    color: theme.colors.textSecondary,
    ...theme.typography.bodySmall,
    marginTop: 8,
  },
  orderInfoButton: {
    minHeight: 48,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
  },
  orderInfoButtonText: {
    ...theme.typography.label,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  privacyButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  privacyButtonText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  privacyRequestButton: {
    minHeight: 54,
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyRequestText: {
    ...theme.typography.button,
    color: theme.colors.onPrimary,
    textAlign: 'center',
  },
  orderModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  orderModal: {
    backgroundColor: theme.colors.panel,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '100%',
    alignSelf: 'center',
  },
  orderInfoModal: {
    backgroundColor: theme.mode === 'light' ? theme.colors.surfaceRaised : theme.colors.panel,
    borderColor: theme.mode === 'light' ? theme.colors.controlBorder : theme.colors.border,
  },
  orderModalScroll: {
    flexShrink: 1,
  },
  orderInfoTitle: {
    color: theme.mode === 'light' ? theme.colors.controlText : theme.colors.textPrimary,
    ...theme.typography.h3,
    marginBottom: 20,
  },
  orderInfoSection: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.mode === 'light' ? theme.colors.controlBorder : theme.colors.border,
  },
  orderInfoSectionTitle: {
    color: theme.mode === 'light' ? theme.colors.controlText : theme.colors.textPrimary,
    ...theme.typography.label,
    marginBottom: 6,
  },
  orderInfoDetailText: {
    color: theme.mode === 'light' ? theme.colors.controlSecondary : theme.colors.textSecondary,
    ...theme.typography.body,
  },
  orderModalClose: {
    minHeight: 54,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.mode === 'light' ? theme.colors.orderSurface : theme.colors.surfaceRaised,
    ...(theme.mode === 'light' && { borderWidth: 1, borderColor: theme.colors.controlBorder }),
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderModalCloseText: {
    ...theme.typography.button,
    color: theme.colors.controlText,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    marginVertical: 28,
  },
  requiredNote: {
    color: theme.colors.textSecondary,
    ...theme.typography.caption,
    marginTop: 12,
  },
  contactDetails: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
    gap: 12,
  },
  detailLabel: {
    width: 96,
    color: theme.colors.textMuted,
    ...theme.typography.bodySmall,
  },
  detailValue: {
    flex: 1,
    color: theme.colors.textPrimary,
    ...theme.typography.body,
    lineHeight: 23,
  },
  contactInputContainer: {
    marginBottom: 14,
  },
  addressContainer: {
    zIndex: 10,
    elevation: 10,
  },
  contactLabel: {
    marginBottom: 6,
  },
  formInput: {
    minHeight: 54,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.mode === 'light' ? theme.colors.controlBorder : theme.colors.border,
    borderRadius: 12,
    fontSize: 17,
    fontFamily: theme.fonts.regular,
    color: theme.mode === 'light' ? theme.colors.controlText : theme.colors.textPrimary,
    backgroundColor: theme.mode === 'light' ? theme.colors.input : 'rgba(12, 12, 12, 0.65)',
  },
  contactAction: {
    minHeight: 48,
    paddingVertical: 10,
  },
  contactModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactModalTitle: {
    ...theme.typography.h3,
    color: theme.mode === 'light' ? theme.colors.controlText : theme.colors.textPrimary,
    flex: 1,
  },
  contactModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  contactModalContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  contactModal: {
    maxHeight: undefined,
  },
  contactModalDismiss: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactModalDescription: {
    ...theme.typography.body,
    color: theme.mode === 'light' ? theme.colors.controlSecondary : theme.colors.textSecondary,
    marginBottom: 20,
  },
  contactModalLabel: {
    color: theme.mode === 'light' ? theme.colors.controlText : theme.colors.textPrimary,
  },
  contactEmailField: {
    marginBottom: 20,
  },
  contactMessageInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  contactModalActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  contactModalCancel: {
    backgroundColor: theme.mode === 'light' ? theme.colors.orderSurface : theme.colors.surfaceRaised,
    ...(theme.mode === 'light' && { borderWidth: 1, borderColor: theme.colors.controlBorder }),
  },
  contactModalButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const ProfileDetail = ({ label, value }) => {
  const { theme } = useTheme();
  const profileStyles = createProfileStyles(theme);
  return (
    <View style={profileStyles.detailRow}>
      <Text style={profileStyles.detailLabel}>{label}</Text>
      <Text style={profileStyles.detailValue}>{value || 'Ei lisätty'}</Text>
    </View>
  );
};

export default OmatTiedotScreen;
