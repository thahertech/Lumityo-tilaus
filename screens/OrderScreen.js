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
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import bgImage from '../assets/Mountains.jpg';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, createCardStyle } from '../theme';
import { initializeDatabase, createOrder, getUserProfile, createUserProfile, getOrderSettings, convertLatestOrderToJatkuva } from '../LocalDatabase';
import AddressAutocomplete from '../components/AddressAutocompleteMapboxNew';
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
    outputRange: ['rgba(255, 255, 255, 0.9)', '#4c84af'],
  });

  const animatedBorderColor = glowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(76, 132, 175, 0.3)', '#2c5282'],
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
  const [isEligibleForFree, setIsEligibleForFree] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [addressCoordinates, setAddressCoordinates] = useState(null); // Store lat/lon from address selection
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

  const initDatabase = async () => {
    await initializeDatabase();
    const profile = await getUserProfile();
    if (profile) {
      setUserProfile(profile);
      setFirstName(profile.name || '');
      setPhoneNumber(profile.phone || '');
      setAddress(profile.address || '');
      
      // Check if user has any orders to determine free eligibility
      const orders = await getOrders(profile.id);
      const eligible = !orders || orders.length === 0;
      setIsEligibleForFree(eligible);
    } else {
      // No profile means no orders, so eligible
      setIsEligibleForFree(true);
    }
  };

  const handleServiceSelection = async (service) => {
    console.log('🔍 Service selection:', service, 'User profile ID:', userProfile?.id);
    
    // Check if user has jatkuva tilaus active and is trying to select Lumityö
    if (service === 'Lumityö' && userProfile?.id) {
      try {
        const settings = await getOrderSettings(userProfile.id);
        console.log('🔍 Order settings:', settings);
        
        if (settings && settings.continuous_order === 1) {
          console.log('⚠️ User has jatkuva tilaus active, showing alert');
          Alert.alert(
            'Jatkuva tilaus aktiivinen',
            'Sinulla on jo jatkuva lumityöpalvelu käytössä. Lumityöt tehdään automaattisesti ilman erillistä tilausta kun lunta on satanut riittävästi.\n\nHaluatko silti tehdä ylimääräisen tilauksen?',
            [
              {
                text: 'Peruuta',
                style: 'cancel'
              },
              {
                text: 'Kyllä, tilaa silti',
                onPress: () => setSelectedService(service)
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
      const profile = await getUserProfile();
      if (profile) {
        const settings = await getOrderSettings(profile.id);
        // Only prompt if user doesn't already have jatkuva tilaus enabled
        if (!settings || settings.continuous_order !== 1) {
          // Check if user has already seen the jatkuva tilaus prompt
          const hasSeenPrompt = await AsyncStorage.getItem(`jatkuva_prompt_${profile.id}`);
          
          if (!hasSeenPrompt) {
            // Mark that user has seen the prompt
            await AsyncStorage.setItem(`jatkuva_prompt_${profile.id}`, 'true');
            
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
                  onPress: async () => {
                    try {
                      // Convert the latest order to jatkuva tilaus and enable the setting
                      const result = await convertLatestOrderToJatkuva(profile.id);
                      
                      if (result.success) {
                        console.log('✅ Successfully converted order to jatkuva tilaus');
                        // Navigate to OmatTiedot where the jatkuva tilaus switch will now be ON
                        navigation.navigate('Profiili', { jatkuvaTilaasEnabled: true });
                      } else {
                        console.error('❌ Failed to convert order:', result.error);
                        // Still navigate to profile even if conversion failed
                        navigation.navigate('Profiili');
                      }
                    } catch (error) {
                      console.error('❌ Error during jatkuva tilaus conversion:', error);
                      // Still navigate to profile even if there's an error
                      navigation.navigate('Profiili');
                    }
                  }
                }
              ]
            );
            return;
          }
        }
      }
      // If user already has jatkuva tilaus, has seen prompt, or no profile, just navigate home
      navigation.navigate('Koti');
    } catch (error) {
      console.error('Error checking jatkuva tilaus settings:', error);
      navigation.navigate('Koti');
    }
  };

  const handleAddressSelect = (addressData) => {
    console.log('📍 Address selected:', addressData);
    setAddressCoordinates({
      latitude: addressData.geometry?.lat || null,
      longitude: addressData.geometry?.lng || null,
    });
    console.log('📍 Address coordinates set:', {
      lat: addressData.geometry?.lat,
      lng: addressData.geometry?.lng,
      fullAddress: addressData.formatted,
      katuNumero: addressData.katuNumero
    });
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
      // Create or get user profile
      let profileId = userProfile?.id;
      
      if (!profileId) {
        const profileResult = await createUserProfile({
          name: firstName,
          phone: phoneNumber,
          address: address,
          email: null
        });
        
        if (!profileResult.success) {
          Alert.alert('Virhe', 'Profiilia ei voitu luoda.');
          return;
        }
        
        profileId = profileResult.profileId;
      }

      // Check if user has jatkuva tilaus enabled and ONLY apply to Lumityö
      let isJatkuvaTilaus = false;
      if (selectedService === 'Lumityö') {
        const orderSettings = await getOrderSettings(profileId);
        isJatkuvaTilaus = orderSettings?.continuous_order === 1;
        
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

      // Create order locally and sync to Supabase
      const orderResult = await createOrder({
        profileId: profileId,
        serviceType: selectedService,
        address: address,
        phone: phoneNumber,
        name: firstName,
        priceEstimate: priceEstimate,
        coordinates: addressCoordinates, // Pass coordinates if available
        info: info, // Pass additional information
        status: 'pending', // Initial status for Map App workflow
        isRecurring: isJatkuvaTilaus, // Pass the jatkuva tilaus flag
        isFreeOrder: isEligibleForFree || false // Mark as free order
      });

      if (!orderResult.success) {
        Alert.alert('Virhe', 'Tilausta ei voitu luoda.');
        return;
      }
      Alert.alert(
        'Tilaus Vahvistettu', 
        `Kiitos ${selectedService} tilauksesta!`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setSelectedService(null);
              setInfo('');
       
              setAddressCoordinates(null);
              checkAndPromptJatkuvaTilaus();
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error creating order:', error);
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
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}> Puhelinnumero</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Esim. +358 40 123 4567"
                        placeholderTextColor={theme.colors.textMuted}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        onFocus={() => scrollToInput('phone')}
                        keyboardType="phone-pad"
                        blurOnSubmit={false}
                        autoComplete="tel"
                        textContentType="telephoneNumber"
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}> Nimi</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Etunimi Sukunimi"
                        placeholderTextColor={theme.colors.textMuted}
                        value={firstName}
                        onChangeText={setFirstName}
                        onFocus={() => scrollToInput('name')}
                        returnKeyType="next"
                        blurOnSubmit={false}
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(76, 132, 175, 0.3)',
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
    color: '#333',
  },
  selectedServiceText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  serviceDescriptionContainer: {
    backgroundColor: 'rgba(220, 220, 220, 0.92)',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 132, 175, 0.81)',
  },
  serviceDescription: {
    fontSize: 15,
    color: '#444',
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
    color: '#e8e8e8ff',
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
    borderColor: 'rgba(255, 255, 255, 0.3)',
    padding: 14, // Reduced padding
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    color: '#333',
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
