import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenHeader from '../components/ScreenHeader';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, Alert, ScrollView, KeyboardAvoidingView, Platform, Image, StatusBar, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import emailjs from 'emailjs-com';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import createSharedStyles from '../styles';
import { useTheme } from '../ThemeContext';
import AddressAutocompleteMapboxNew from '../components/AddressAutocompleteMapboxNew';
import bgImage from '../assets/Mountains.jpg';
import { getDeviceId } from '../FreeOrderUtils';
import { getUserProfile, upsertUserProfile, getOrdersByDevice, getOrderSettings, saveOrderSettings } from '../SupabaseAPI';

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

  // Contact modal state
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  // Edit mode and saving state
  const [isEditMode, setIsEditMode] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
    if (isSavingContinuousOrder) return;

    // Validate required fields before enabling
    if (value && (!name.trim() || !address.trim() || !phone.trim())) {
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
    if (isSaving) return; // Prevent double-clicks
    
    // Validate required fields
    if (!name.trim() || !address.trim() || !phone.trim()) {
      Alert.alert('Virhe', 'Täytä kaikki pakolliset kentät (nimi, osoite, puhelinnumero).');
      return;
    }
    
    setIsSaving(true);
    
    try {
      const deviceId = await getDeviceId();
      
      // Upsert profile (creates or updates)
      const result = await upsertUserProfile(deviceId, {
        name,
        phone,
        address,
        email
      });
      
      if (!result.success) {
        Alert.alert('Virhe', 'Tietojen tallentaminen epäonnistui');
        return;
      }
      
      setUserProfile(result.profile);

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
              <Text style={{ color: theme.colors.textPrimary, fontSize: 10, fontWeight: 'bold' }}>ILMAINEN</Text>
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
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={mode === 'light' ? 'dark-content' : 'light-content'} backgroundColor="transparent" translucent={true} />
      
      {/* Background Image */}
      {mode === 'dark' && <Image source={bgImage} style={styles.backgroundImage} resizeMode="cover" />}
      
      {/* Overlay for better text readability */}
      {mode === 'dark' && <View style={styles.overlay} />}
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: insets.top + 16, width: '100%', maxWidth: 600, alignSelf: 'center' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
         

          <ScreenHeader eyebrow="OMA ASIAKKUUS" title="Omat sivut" subtitle="Yhteystietosi ja tilausasetuksesi." />
          {isLoadingProfile ? (
            <View style={{ alignItems: 'center', paddingVertical: 36 }}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={{ color: theme.colors.textSecondary, marginTop: 12 }}>Ladataan tietoja...</Text>
            </View>
          ) : (
          <>
          {/* Section 1: User Details */}
          <View style={[styles.modernCard, profileStyles.contactCard]}>
           <View style={[styles.cardHeader, profileStyles.contactCardHeader]}>
            <Ionicons name="person-circle-outline" size={32} color={theme.colors.accent} />
            <Text style={styles.cardHeaderText}>Yhteystiedot</Text>
          </View>
          {isEditMode ? (
            <>
              <View style={[styles.inputContainer, profileStyles.contactInputContainer]}>
                <Text style={[styles.label, profileStyles.contactLabel]}>Nimi *</Text>
                <TextInput
                  style={[styles.input, profileStyles.contactInput]}
                  placeholder="Syötä nimesi"
                  placeholderTextColor={theme.colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
              </View>

              <View style={[styles.inputContainer, profileStyles.contactInputContainer]}>
                <Text style={[styles.label, profileStyles.contactLabel]}>Osoite *</Text>
                <AddressAutocompleteMapboxNew
                  value={address}
                  onChangeText={setAddress}
                  onAddressSelect={(addressData) => {
                    const displayAddress = typeof addressData === 'string' ? addressData : addressData.displayAddress || addressData.formatted || addressData;
                    setAddress(displayAddress);
                  }}
                  placeholder="Syötä osoitteesi"
                  placeholderTextColor={theme.colors.textMuted}
                  inputStyle={profileStyles.addressInput}
                />
              </View>

              <View style={[styles.inputContainer, profileStyles.contactInputContainer]}>
                <Text style={[styles.label, profileStyles.contactLabel]}>Puhelinnumero *</Text>
                <TextInput
                  style={[styles.input, profileStyles.contactInput]}
                  placeholder="Syötä puhelinnumerosi"
                  placeholderTextColor={theme.colors.textMuted}
                  value={phone}
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
                  style={[styles.input, profileStyles.contactInput]}
                  placeholder="Syötä sähköpostiosoitteesi"
                  placeholderTextColor={theme.colors.textMuted}
                  value={email}
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
            disabled={isSaving}
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
              accessibilityRole="button"
            >
              <Text style={[styles.confirmButtonText, { color: theme.colors.textSecondary }]}>Peruuta muokkaus</Text>
            </TouchableOpacity>
          )}

          {/* Contact Button */}
          <TouchableOpacity 
            style={[styles.confirmButton, profileStyles.contactAction, { 
              backgroundColor: theme.colors.surfaceRaised,
              marginTop: 16,
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.3)'
            }]} 
            onPress={() => setShowContactModal(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="mail-outline" size={20} color={theme.colors.textPrimary} style={{ marginRight: 8 }} />
              <Text style={[styles.confirmButtonText, { color: theme.colors.textPrimary }]}>Ota yhteyttä</Text>
            </View>
          </TouchableOpacity>
          
          <Text style={{
            color: theme.colors.textSecondary,
            fontSize: 13,
            textAlign: 'center',
            marginTop: 12,
            fontStyle: 'italic',
            backgroundColor: theme.colors.surfaceRaised,
            padding: 8,
            borderRadius: 6,



          }}>
            * Pakolliset tiedot jatkuvaa tilausta varten
          </Text>
        </View>

        <View style={[styles.modernCard, profileStyles.preferenceCard]}>
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
              trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
              thumbColor={theme.colors.surface}
              accessibilityLabel="Vaalea teema"
              accessibilityRole="switch"
              accessibilityState={{ checked: mode === 'light' }}
            />
          </View>
          <Text style={{ color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 }}>
            Teema tallennetaan laitteellesi. Vaalea teema on käytössä oletuksena.
          </Text>
        </View>

        {/* Section 2: Continuous Order Setting */}
        <View style={styles.modernCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="settings-outline" size={24} color={theme.colors.textPrimary} />
            <Text style={styles.cardHeaderText}>Tilausasetukset</Text>
            <TouchableOpacity 
              onPress={() => setShowContinuousOrderInfo(!showContinuousOrderInfo)}
              style={styles.infoButton}
              accessibilityRole="button"
              accessibilityLabel={showContinuousOrderInfo ? 'Piilota jatkuvan tilauksen lisätiedot' : 'Näytä jatkuvan tilauksen lisätiedot'}
              accessibilityState={{ expanded: showContinuousOrderInfo }}
            >
              <Ionicons 
                name={showContinuousOrderInfo ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={theme.colors.textPrimary} 
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.modernSwitchContainer}>
            <View style={styles.switchContent}>
              <Ionicons name="repeat-outline" size={20} color={theme.colors.textPrimary} />
              <Text style={styles.modernSwitchLabel}>Jatkuva tilaus</Text>
            </View>
            <Switch
              trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
              thumbColor={theme.colors.surface}
              ios_backgroundColor={theme.colors.border}
              onValueChange={handleContinuousOrderToggle}
              value={continuousOrder}
              disabled={isSavingContinuousOrder || isLoadingProfile}
              accessibilityLabel="Jatkuva tilaus"
              accessibilityRole="switch"
              accessibilityState={{ checked: continuousOrder, disabled: isSavingContinuousOrder || isLoadingProfile }}
            />
          </View>
          
         
          
          <Text style={{
            color: theme.colors.textSecondary,
            fontSize: 15,
            lineHeight: 20,
            marginTop: 12,
            backgroundColor: theme.colors.surfaceRaised,
            padding: 12,
            borderRadius: 8,



          }}>
            {continuousOrder 
              ? 'Jatkuva tilaus -asetus on käytössä. Tulevat tilauksesi merkitään automaattisesti jatkuviksi tilauksiksi.' 
              : !name.trim() || !address.trim() || !phone.trim() 
                ? 'Täytä ensin pakolliset tiedot (nimi*, osoite*, puhelinnumero*) ja tallenna ne jatkuvan tilauksen aktivoimiseksi.'
                : 'Jatkuva tilaus -asetus ei ole käytössä. Tulevat tilauksesi luodaan kertatilauksina.'
            }
          </Text>

          {/* Accordion Content */}
          {showContinuousOrderInfo && (
            <View style={{
              backgroundColor: theme.colors.input,
              borderRadius: 12,
              padding: 18,
              marginTop: 16,
            }}>
              <Text style={{
                color: theme.colors.textPrimary,
                fontSize: 17,
                fontWeight: 'bold',
                marginBottom: 12
              }}>
                Jatkuva tilaus - Lisätietoa
              </Text>

              <Text style={{
                color: theme.colors.textSecondary,
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 10
              }}>
                <Text style={{ fontWeight: 'bold', color: '#e9e9e9ff' }}>Toiminta:</Text> Kun asetus on päällä, lumityöt tehdään annettuun osoittteeseen ilman erillistä tilausta. Työt suoritetaan, kun lunta satanut merkittävä määrä. 
              </Text>

              <Text style={{
                color: theme.colors.textSecondary,
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 10
              }}>
                <Text style={{ fontWeight: 'bold', color: '#e9e9e9ff' }}>Laskutus:</Text> Kun lumitöitä on kertynyt 5 kertaa, lähetetään lasku joko paperisena tai suoraan sähköpostiin. Halutessasi voit myös sopia koko talven laskutuksen yhdellä laskulla. 
              </Text>

              <Text style={{
                color: theme.colors.textSecondary,
                fontSize: 15,
                lineHeight: 22,
                marginBottom: 10
              }}>
                <Text style={{ fontWeight: 'bold', color: '#e9e9e9ff' }}>Peruutus:</Text> Voit ottaa asetuksen pois päältä milloin tahansa. Aiemmin tehtyjen lumitöiden tiedot näkyvät tilaushistoriassa.
              </Text>
              <View style={{
                backgroundColor: theme.colors.surfaceRaised,
                borderRadius: 8,
                padding: 12,
                marginTop: 8,
              }}>
                <Text style={{
                  color: theme.colors.textSecondary,
                  fontSize: 15,
                  lineHeight: 20,
                  fontWeight: '500'
                }}>
                  Toivottavasti olet tyytyväinen palveluun! Kiitos, kun käytät sovellusta.
                </Text>
              </View>
            </View>
          )}
        </View>
          </>
          )}
      </ScrollView>

      {/* Contact Modal */}
      <Modal
        visible={showContactModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowContactModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 30}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
          }}>
          <View style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 400,
            maxHeight: '80%'
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 20
            }}>
              <Ionicons name="mail" size={24} color={theme.colors.textSecondary} />
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: theme.colors.textPrimary,
                marginLeft: 8
              }}>
                Ota yhteyttä
              </Text>
              <TouchableOpacity
                style={{
                  marginLeft: 'auto',
                  padding: 4
                }}
                onPress={() => setShowContactModal(false)}
              >
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          

            <ScrollView style={{ maxHeight: 300 }}>
              <Text style={{
                fontSize: 16,
                color: theme.colors.textSecondary,
                marginBottom: 16,
                lineHeight: 22
              }}>
                Laita viesti - otamme sinuun yhteyttä pian!
              </Text>

              {/* Email Input Field */}
              <Text style={{
                fontSize: 14,
                color: theme.colors.textPrimary,
                marginBottom: 8,
                fontWeight: '500'
              }}>
                Sähköpostiosoite
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 16,
                  backgroundColor: theme.colors.input,
                  color: theme.colors.textPrimary,
                  marginBottom: 20
                }}
                placeholder="esim. maija@example.com"
                placeholderTextColor={theme.colors.textMuted}
                value={contactEmail}
                onChangeText={setContactEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
              />

              {/* Message Input Field */}
              <Text style={{
                fontSize: 14,
                color: theme.colors.textPrimary,
                marginBottom: 8,
                fontWeight: '500'
              }}>
                Viesti
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 16,
                  textAlignVertical: 'top',
                  minHeight: 120,
                  backgroundColor: theme.colors.input,
                  color: theme.colors.textPrimary
                }}
                placeholder="Kirjota tähän..."
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={6}
                value={contactMessage}
                onChangeText={setContactMessage}
                maxLength={500}
              />

              <Text style={{
                fontSize: 12,
                color: theme.colors.textMuted,
                textAlign: 'right',
                marginTop: 8
              }}>
                {contactMessage.length}/500
              </Text>
            </ScrollView>

            <View style={{
              flexDirection: 'row',
              marginTop: 20,
              gap: 12
            }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.surfaceRaised,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center'
                }}
                onPress={() => setShowContactModal(false)}
              >
                <Text style={{
                  fontSize: 16,
                  color: theme.colors.textSecondary,
                  fontWeight: '500'
                }}>
                  Peruuta
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: theme.colors.primary,
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: 'center',
                  opacity: isSubmittingContact ? 0.6 : 1
                }}
                onPress={handleContactSubmit}
                disabled={isSubmittingContact}
              >
                <Text style={{
                  fontSize: 16,
                  color: theme.colors.onPrimary,
                  fontWeight: '600'
                }}>
                  {isSubmittingContact ? 'Lähetetään...' : 'Lähetä'}
                </Text>
              </TouchableOpacity>
            </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
    </View>
  );
};

const createProfileStyles = (theme) => StyleSheet.create({
  contactCard: {
    padding: 16,
    marginBottom: 12,
  },
  contactCardHeader: {
    marginBottom: 12,
  },
  preferenceCard: {
    padding: 16,
    marginBottom: 12,
  },
  contactDetails: {
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderLight,
    gap: 12,
  },
  detailLabel: {
    width: 96,
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  detailValue: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
  },
  contactInputContainer: {
    marginBottom: 10,
  },
  contactLabel: {
    marginBottom: 4,
  },
  contactInput: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  addressInput: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  contactAction: {
    minHeight: 48,
    paddingVertical: 10,
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
