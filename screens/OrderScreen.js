import React, { useState } from 'react';
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
import emailjs from 'emailjs-com';
import bgImage from '../assets/Mountains.jpg';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const OrderScreen = () => {
  const [firstName, setFirstName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [info, setInfo] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

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
      return 'Lumityö suoritetaan seuraavan kierroksen aikana \n\nHinta: 10 — 20 €';
    } else if (selectedService === 'Polanteen poisto') {
      return 'Polanteen poisto suoritetaan seuraavan kierroksen aikana\n\nHinta: 20 — 30 €';
    }
    return '';
  };

  const handleOrderConfirmation = async () => {
    if (!isFormValid()) {
      Alert.alert('Puutteelliset tiedot', 'Täytä kaikki pakolliset kentät.');
      return;
    }

    const templateParams = {
      firstName,
      phoneNumber,
      address,
      info,
      selectedService,
    };

    const EMAILJS_SERVICE_ID = "service_dnlb5bk";
    const EMAILJS_TEMPLATE_ID = "template_za30asu";
    const EMAILJS_USER_ID = "XwJENMkw3QXVvWHQB";
    
    try {
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_USER_ID,
      );

      if (response.status === 200) {
        Alert.alert('Tilaus Vahvistettu', `Kiitos ${selectedService} tilauksesta!`);
        // Reset form
        setFirstName('');
        setPhoneNumber('');
        setAddress('');
        setSelectedService(null);
        setInfo('');
      } else {
        Alert.alert('Virhe', 'Tilausta ei vahvistettu. Yritä uudelleen.');
        console.log('Error response:', response);
      }
    } catch (error) {
      console.error('Error occurred:', error);
      Alert.alert('Virhe', 'Tilausta ei vahvistettu. Yritä uudelleen.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          <Image source={bgImage} style={styles.bgImage} />
          
          {/* Dark overlay for better text readability */}
          <View style={styles.overlay} />
          
          <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContainer}
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>❄️ Valitse Palvelu</Text>
              </View>

              {/* Service Selection */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Palvelun valinta</Text>
                <View style={styles.buttonContainer}>
                  {['Lumityö', 'Polanteen poisto'].map((service) => (
                    <TouchableOpacity
                      key={service}
                      style={[
                        styles.serviceButton,
                        selectedService === service && styles.selectedServiceButton,
                      ]}
                      onPress={() => setSelectedService(service)}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.serviceButtonText,
                        selectedService === service && styles.selectedServiceText
                      ]}>
                        {service}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
                {selectedService && (
                  <View style={styles.serviceDescriptionContainer}>
                    <Text style={styles.serviceDescription}>{getServiceLabel()}</Text>
                  </View>
                )}
              </View>

              {/* Contact Information */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Yhteystiedot</Text>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}> Osoite</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Esim. Mannerheimintie 1 A 5"
                    placeholderTextColor="#999"
                    value={address}
                    onChangeText={setAddress}
                    autoComplete="street-address"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}> Puhelinnumero</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Esim. +358 40 123 4567"
                    placeholderTextColor="#999"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}> Nimi</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Etunimi Sukunimi"
                    placeholderTextColor="#999"
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                </View>
              </View>

              {/* Additional Information */}
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Lisätiedot (valinnainen)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Kerro erityistoiveista tai ohjeista..."
                  placeholderTextColor="#999"
                  value={info}
                  onChangeText={setInfo}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  !isFormValid() && styles.disabledButton,
                ]}
                onPress={handleOrderConfirmation}
                disabled={!isFormValid()}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={isFormValid() ? ['#4CAF50', '#45a049'] : ['#ccc', '#aaa']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.confirmButtonText}>
                    ✅ Vahvista Tilaus
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  Tilaus vahvistetaan sähköpostitse
                </Text>
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 30,
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  serviceButton: {
    flex: 1,
    margin: 5,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#e0e0e0',
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
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
    transform: [{ scale: 1.02 }],
  },
  serviceButtonText: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
    color: '#666',
  },
  selectedServiceText: {
    color: '#2196F3',
  },
  serviceDescriptionContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  serviceDescription: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  confirmButton: {
    marginTop: 10,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  gradientButton: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
});

export default OrderScreen;
