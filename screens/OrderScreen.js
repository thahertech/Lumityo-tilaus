import React, { useState, useEffect, useRef } from 'react';
import { 
  ScrollView, 
  TouchableWithoutFeedback, 
  Keyboard, 
  Image, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  Platform, 
  KeyboardAvoidingView,
  Dimensions,
  Animated
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import bgImage from '../assets/Mountains.jpg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, createCardStyle } from '../theme';
import { getDeviceId } from '../FreeOrderUtils';
import { upsertUserProfile, getUserProfile, createSnowOrder, getOrdersByDevice, getOrderSettings, hasClaimedFreeOrder } from '../SupabaseAPI';
import AddressAutocomplete from '../components/AddressAutocompleteMapboxNew';
import OrderMapPreview from '../components/OrderMapPreview';
import globalStyles from '../styles';

const { width, height } = Dimensions.get('window');

// Animated Service Button Component
const AnimatedServiceButton = ({ service, isSelected, onPress }) => {
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const glowAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSelected) {
      Animated.timing(glowAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(glowAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [isSelected]);

  const handlePressIn = () => {
    Animated.timing(scaleAnimation, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnimation, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    // Bounce effect
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    setTimeout(() => onPress(service), 50);
  };

  const animatedBackgroundColor = glowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(7, 13, 20, 0.62)', 'rgba(76, 132, 175, 0.92)'],
  });

  const animatedBorderColor = glowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(148, 163, 184, 0.35)', 'rgba(76, 132, 175, 0.95)'],
  });

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnimation }] }}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <Animated.View style={[
          styles.serviceButton,
          {
            backgroundColor: animatedBackgroundColor,
            borderColor: animatedBorderColor,
            borderWidth: 2,
          }
        ]}>
          <Text style={[
            styles.serviceButtonText,
            isSelected && styles.selectedServiceText
          ]}>
            {service}
          </Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const OrderScreen = ({ route }) => {
  const navigation = useNavigation();
  const scrollViewRef = useRef(null);
  const phoneInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const infoInputRef = useRef(null);
  
  const [isEligibleForFree, setIsEligibleForFree] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [addressCoordinates, setAddressCoordinates] = useState(null); // Store lat/lon from address selection
  const [originalAddressCoordinates, setOriginalAddressCoordinates] = useState(null); // Original geocoded coords before any pin drag
  const [selectedService, setSelectedService] = useState(null);
  const [info, setInfo] = useState('');

  const [fadeAnim] = useState(new Animated.Value(0));
  const [userProfile, setUserProfile] = useState(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
    
    // Initialize database and load user profile
    initDatabase();
  }, []);

  // Re-check eligibility when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      checkFreeOrderEligibility();
    }, [])
  );

  const checkFreeOrderEligibility = async () => {
    try {
      const deviceId = await getDeviceId();
      const hasFreeOrder = await hasClaimedFreeOrder(deviceId);
      setIsEligibleForFree(!hasFreeOrder);
      console.log('🎁 Free order eligibility check:', { 
        deviceId, 
        hasFreeOrder, 
        isEligible: !hasFreeOrder 
      });
    } catch (error) {
      console.error('❌ Error checking free order eligibility:', error);
      setIsEligibleForFree(false);
    }
  };

  const initDatabase = async () => {
    try {
      const deviceId = await getDeviceId();
      console.log('📱 Device ID:', deviceId);
      
      const profile = await getUserProfile(deviceId);
      if (profile) {
        setUserProfile(profile);
        setFirstName(profile.name || '');
        setPhoneNumber(profile.phone || '');
        setAddress(profile.address || '');
        console.log('✅ Loaded user profile');
      } else {
        console.log('ℹ️ No existing profile for device');
      }
      
      // Check eligibility
      await checkFreeOrderEligibility();
    } catch (error) {
      console.error('❌ Error initializing:', error);
    }
  };

  const handleServiceSelection = async (service) => {
    const deviceId = await getDeviceId();
    console.log('🔍 Service selection:', service, 'Device ID:', deviceId);
    
    // Check if user has jatkuva tilaus active and is trying to select Lumityö
    if (service === 'Lumityö' && deviceId) {
      try {
        const settings = await getOrderSettings(deviceId);
        console.log('🔍 Order settings:', settings);
        
        if (settings && settings.continuous_order === true) {
          console.log('⚠️ User has jatkuva tilaus active, showing alert');
          Alert.alert(
            'Jatkuva tilaus aktiivinen',
            'Sinulla on jo jatkuva lumityöpalvelu käytössä. Lumityöt tehdään automaattisesti ilman erillistä tilausta kun lunta on satanut riittävästi.',
            [
              {
                text: 'Peruuta',
                style: 'cancel'
              },
              {
                text: 'Siirry asetuksiin',
                onPress: () => navigation.navigate('Profiili')
              }
            ]
          );
          return;
        }
      } catch (error) {
        console.error('Error checking jatkuva tilaus settings:', error);
      }
    }
    
    // If not Lumityö or no jatkuva tilaus active, proceed normally
    setSelectedService(service);
  };

  const isFormValid = () => {
    return (
      firstName.trim() !== '' &&
      phoneNumber.trim() !== '' &&
      address.trim() !== '' &&
      selectedService !== null
    );
  };

  const getServiceLabel = () => {
    if (selectedService === 'Lumityö') {
      const priceText = isEligibleForFree ? 
        'ILMAINEN ENSIMMÄINEN TILAUS!' : 
        'Hinta: 10 — 20 €';
      return `Lumityö suoritetaan seuraavan kierroksen aikana \n\n${priceText}`;
    } else if (selectedService === 'Polanteen poisto') {
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
      
      console.log('📑 Jatkuva tilaus check:', {
        totalOrders: orders.length,
        lumityoOrders: lumityoOrders.length
      });
      
      const settings = await getOrderSettings(deviceId);
      // Show prompt ONLY after FIRST Lumityö order, if continuous_order not enabled
      if (lumityoOrders.length === 1 && (!settings || settings.continuous_order !== true)) {
        console.log('📢 Showing jatkuva tilaus prompt after first Lumityö order');
        
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
      latitude: addressData.geometry?.lat || null,
      longitude: addressData.geometry?.lng || null,
    };
    setAddressCoordinates(coords);
    setOriginalAddressCoordinates(coords);
  };

  const handleMapCoordinatesChange = (lat, lon) => {
    setAddressCoordinates({ latitude: lat, longitude: lon });
  };

  const handleMapReset = () => {
    setAddressCoordinates(originalAddressCoordinates);
  };

  // Auto scroll to focused input
  const scrollToInput = (inputName) => {
    if (scrollViewRef.current) {
      let yOffset = 0;
      
      switch (inputName) {
        case 'address':
        case 'phone':
        case 'name':
          // For all contact fields, scroll to show the entire Yhteystiedot container
          yOffset = 180; // Position to show the full contact card
          break;
        case 'info':
          yOffset = 450;
          break;
      }
      
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: yOffset,
          animated: true,
        });
      }, 100);
    }
  };

  const handleOrderConfirmation = async () => {
    if (isSubmittingOrder) return; // Prevent duplicate submissions
    
    if (!isFormValid()) {
      Alert.alert('Puutteelliset tiedot', 'Täytä kaikki pakolliset kentät.');
      return;
    }

    setIsSubmittingOrder(true);

    try {
      const deviceId = await getDeviceId();
      console.log('📱 Creating order for device:', deviceId);
      
      // Upsert user profile (will update if exists, create if not)
      const profileResult = await upsertUserProfile(deviceId, {
        name: firstName,
        phone: phoneNumber,
        address: address,
        email: null
      });
      
      if (!profileResult.success) {
        console.error('❌ Profile upsert failed:', profileResult.error);
        Alert.alert('Virhe', `Profiilia ei voitu tallentaa: ${profileResult.error || 'Tuntematon virhe'}`);
        return;
      }
      
      console.log('✅ Profile saved');
      setUserProfile(profileResult.profile);

      // Check if user has jatkuva tilaus enabled and ONLY apply to Lumityö
      let isJatkuvaTilaus = false;
      if (selectedService === 'Lumityö') {
        const orderSettings = await getOrderSettings(deviceId);
        isJatkuvaTilaus = orderSettings?.continuous_order === true;
        
        console.log('🔍 Jatkuva tilaus check:', {
          service: selectedService,
          hasSettings: !!orderSettings,
          continuousOrder: orderSettings?.continuous_order,
          isJatkuvaTilaus
        });
      } else {
        console.log('🚫 Polanteen poisto cannot be jatkuva tilaus');
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
        Alert.alert('Virhe', `Tilausta ei voitu luoda: ${orderResult.error}`);
        return;
      }
      
      console.log('✅ Order created:', orderResult.order.id);
      
      Alert.alert(
        'Tilaus Vahvistettu', 
        `Kiitos ${selectedService} tilauksesta!`,
        [
          {
            text: 'OK',
            onPress: async () => {
              // Reset form
              setSelectedService(null);
              setInfo('');
              setAddressCoordinates(null);
              setOriginalAddressCoordinates(null);
              
              // Re-check free order eligibility after creating order
              await checkFreeOrderEligibility();
              
              checkAndPromptJatkuvaTilaus();
            }
          }
        ]
      );

    } catch (error) {
      console.error('❌ Error creating order:', error);
      Alert.alert('Virhe', 'Tilausta ei vahvistettu. Yritä uudelleen.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={StyleSheet.absoluteFillObject}>
          <Image source={bgImage} style={styles.bgImage} />
          {/* Dark overlay for better text readability */}
          <View style={styles.overlay} />
        </View>
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
          <Animated.View style={[styles.container, { opacity: fadeAnim }]}> 
            <ScrollView
              ref={scrollViewRef}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
              bounces={true}
              style={styles.scrollView}
              enableOnAndroid={true}
              keyboardDismissMode="interactive"
            >

              {/* Service Selection */}
              <View style={[globalStyles.modernCard, { top: 0, marginTop: 10 }]}>
                <View style={globalStyles.cardHeader}>
                  <Ionicons name="snow-outline" size={24} color="#4c84af" />
                  <Text style={globalStyles.cardHeaderText}>Valitse Palvelu</Text>
                </View>
                <View style={styles.buttonContainer}>
                  {['Lumityö', 'Polanteen poisto'].map((service) => (
                    <AnimatedServiceButton
                      key={service}
                      service={service}
                      isSelected={selectedService === service}
                      onPress={handleServiceSelection}
                    />
                  ))}
                </View>
                
                {selectedService && (
                  <Animated.View 
                    style={styles.serviceDescriptionContainer}
                    entering="fadeIn"
                  >
                    <Text style={styles.serviceDescription}>{getServiceLabel()}</Text>
                  </Animated.View>
                )}
              </View>

              {/* Prompt to select service first */}
              {!selectedService && (
                <View style={[globalStyles.modernCard, { top: 0, opacity: 0.7 }]}>
                  <View style={styles.promptContainer}>
                    <Ionicons name="arrow-up-outline" size={32} color="#d1d1d1ff" />
                    <Text style={styles.promptText}>
                      Valitse ensin palvelu jatkaaksesi
                    </Text>
                  </View>
                </View>
              )}

              {/* Contact Information - Only show when service is selected */}
              {selectedService && (
                <>
                  <Animated.View 
                    style={[globalStyles.modernCard, { top: 0 }]}
                    entering="fadeIn"
                  >
                    <View style={globalStyles.cardHeader}>
                      <Ionicons name="person-outline" size={24} color="#4c84af" />
                      <Text style={globalStyles.cardHeaderText}>Yhteystiedot</Text>
                    </View>
                    
                    <View style={[styles.inputContainer, styles.addressContainer]}>
                      <Text style={styles.inputLabel}> Osoite</Text>
                      <AddressAutocomplete
                        value={address}
                        onChangeText={setAddress}
                        onAddressSelect={handleAddressSelect}
                        onFocus={() => scrollToInput('address')}
                        placeholder="Esim. Mannerheimintie 1 A 5"
                        inputStyle={styles.input}
                      />
                      {addressCoordinates?.latitude && addressCoordinates?.longitude && (
                        <OrderMapPreview
                          initialLatitude={originalAddressCoordinates.latitude}
                          initialLongitude={originalAddressCoordinates.longitude}
                          address={address}
                          onCoordinatesChange={handleMapCoordinatesChange}
                          onReset={
                            originalAddressCoordinates &&
                            (addressCoordinates.latitude !== originalAddressCoordinates.latitude ||
                             addressCoordinates.longitude !== originalAddressCoordinates.longitude)
                              ? handleMapReset
                              : undefined
                          }
                        />
                      )}
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}> Puhelinnumero</Text>
                      <TextInput
                        ref={phoneInputRef}
                        style={styles.input}
                        placeholder="Esim. +358 40 123 4567"
                        placeholderTextColor={theme.colors.textMuted}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        onFocus={() => scrollToInput('phone')}
                        keyboardType="phone-pad"
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => nameInputRef.current?.focus()}
                        autoComplete="tel"
                        textContentType="telephoneNumber"
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}> Nimi</Text>
                      <TextInput
                        ref={nameInputRef}
                        style={styles.input}
                        placeholder="Etunimi Sukunimi"
                        placeholderTextColor={theme.colors.textMuted}
                        value={firstName}
                        onChangeText={setFirstName}
                        onFocus={() => scrollToInput('name')}
                        returnKeyType="next"
                        blurOnSubmit={false}
                        onSubmitEditing={() => infoInputRef.current?.focus()}
                        autoComplete="name"
                        textContentType="name"
                      />
                    </View>
                  </Animated.View>

                  {/* Additional Information */}
                  <Animated.View 
                    style={[globalStyles.modernCard, { top: 0 }]}
                    entering="fadeIn"
                  >
                    <View style={globalStyles.cardHeader}>
                      <Ionicons name="document-text-outline" size={24} color="#4c84af" />
                      <Text style={globalStyles.cardHeaderText}>Lisätiedot</Text>
                    </View>
                    <TextInput
                      ref={infoInputRef}
                      style={[styles.input, styles.textArea]}
                      placeholder="Kerro erityistoiveista tai ohjeista..."
                      placeholderTextColor={theme.colors.textMuted}
                      value={info}
                      onChangeText={setInfo}
                      onFocus={() => scrollToInput('info')}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      returnKeyType="done"
                      blurOnSubmit={true}
                    />
                  </Animated.View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.confirmButton,
                      (!isFormValid() || isSubmittingOrder) && styles.disabledButton,
                    ]}
                    onPress={handleOrderConfirmation}
                    disabled={!isFormValid() || isSubmittingOrder}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={isFormValid() && !isSubmittingOrder ? [theme.colors.primary, theme.colors.primaryDark] : [theme.colors.buttonDisabled, theme.colors.textMuted]}
                      style={styles.gradientButton}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.confirmButtonText}>
                         {isSubmittingOrder ? 'Lähetetään...' : 'Vahvista Tilaus'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

       
             
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    backgroundColor: 'transparent',
  },
  scrollView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 120, // More padding for address suggestions and keyboard
    paddingTop: 10,
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
    textShadowColor: theme.colors.overlay,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textLight,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    opacity: 0.95,
    textShadowColor: theme.colors.overlay,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  card: {
    ...createCardStyle(),
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
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  serviceButton: {
    flex: 1,
    paddingVertical: 16, // Reduced padding
    paddingHorizontal: 12,
    backgroundColor: 'rgba(7, 13, 20, 0.58)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    minHeight: 56, // Slightly taller but not massive
    justifyContent: 'center',
    alignItems: 'center',
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
  selectedServiceButton: {
    backgroundColor: 'rgba(11, 11, 11, 0.77)', // Light blue background
    borderColor: '#fff',
    transform: [{ scale: 1.02 }],
  },
  serviceButtonText: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
    color: '#e2e8f0',
  },
  selectedServiceText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  serviceDescriptionContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  serviceDescription: {
    fontSize: 15,
    color: '#e2e8f0',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  promptContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  promptText: {
    fontSize: 16,
    color: 'rgba(226, 232, 240, 0.9)',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
    lineHeight: 22,
  },

  inputContainer: {
    marginBottom: 16, // Reduced from theme.spacing.lg
  },
  addressContainer: {
    marginBottom: 24, // Extra space for dropdown suggestions
    zIndex: 10, // Moderate z-index for dropdown visibility
    elevation: 10, // For Android
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.22)',
    padding: 14, // Reduced padding
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    color: '#111827',
    minHeight: 50, // Slightly reduced
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
  textArea: {
    height: 90, // Slightly reduced
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  confirmButton: {
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  gradientButton: {
    paddingVertical: 18, // More balanced padding
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  disabledButton: {
    opacity: 0.5,
  },
  confirmButtonText: {
    ...theme.typography.button,
    color: theme.colors.textLight,
    textShadowColor: theme.colors.overlay,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
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
    textShadowColor: theme.colors.overlay,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default OrderScreen;
