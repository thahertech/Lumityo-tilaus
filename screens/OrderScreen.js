import React, { useState } from 'react';
import { ScrollView, Image, View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import emailjs from 'emailjs-com';
import bgImage from '../assets/Mountains.jpg';
import Config from 'react-native-config';
import { addOrder } from '../DB';


const OrderScreen = () => {
  const [firstName, setFirstName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [selectedService, setSelectedService] = useState(null);

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
      return 'Lumityö suoritetaan seuraavan kierroksen aikana \n\nHinta: 10 — 15 €';
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
      selectedService,
    };

    try {
      const response = await emailjs.send(
        Config.EMAILJS_SERVICE_ID,
        Config.EMAILJS_TEMPLATE_ID,
        templateParams,
        Config.EMAILJS_USER_ID,

      );

      if (response.status === 200) {

        Alert.alert('Tilaus Vahvistettu', `Kiitos ${selectedService} tilauksesta!`);

      addOrder(firstName, phoneNumber, address, selectedService);

      setFirstName('');
      setPhoneNumber('');
      setAddress('');
      setSelectedService(null);

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
      <Image
        source={bgImage}
        style={styles.bgImage}
        resizeMode="cover"
      />
      <ScrollView contentContainerStyle={styles.scrollViewContainer}>
        <View style={styles.container}>

          <Text style={[styles.label, { marginTop: 25, marginBottom: 25, fontSize: 30 }]}>
            Valitse palvelu
          </Text>
          <View style={[styles.buttonContainer, { marginBottom: 20 }]}>
            <TouchableOpacity
              style={[
                styles.serviceButton,
                selectedService === 'Lumityö' && { backgroundColor: 'lightblue' },
              ]}
              onPress={() => setSelectedService('Lumityö')}
            >
              <Text style={styles.serviceButtonText}>Lumityö</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.serviceButton,
                selectedService === 'Polanteen poisto' && { backgroundColor: 'lightblue' },
              ]}
              onPress={() => setSelectedService('Polanteen poisto')}
            >
              <Text style={styles.serviceButtonText}>Polanteen poisto</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.labelContainer}>
            <Text style={[styles.label, { marginBottom: 29 }]}>{getServiceLabel()}</Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Osoite</Text>
            <TextInput
              style={styles.input}
              placeholder="Osoite"
              value={address}
              onChangeText={(text) => setAddress(text)}
              autoComplete="street-address"
              returnKeyType="done"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Puhelinnumero</Text>
            <TextInput
              style={styles.input}
              placeholder="Puhelinnumero"
              value={phoneNumber}
              onChangeText={(text) => setPhoneNumber(text)}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="done"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Etunimi</Text>
            <TextInput
              style={styles.input}
              placeholder="Etunimi"
              value={firstName}
              onChangeText={(text) => setFirstName(text)}
              autoComplete="given-name"
              returnKeyType="done" 
            />
          </View>

          <TouchableOpacity
            style={[
              styles.confirmButton,
              !isFormValid() && { backgroundColor: 'grey', marginTop: 100 },
            ]}
            onPress={handleOrderConfirmation}
            disabled={!isFormValid()}
          >
            <Text style={styles.confirmButtonText}>Vahvista tilaus</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  labelContainer: {
    marginBottom: 15,
  },
  label: {
    marginTop: 20,
    marginBottom: 5,
    fontFamily: 'Inter',
    fontWeight: '300',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    paddingLeft: 10,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    ...Platform.select({
      android: {
        elevation: 5,
      },
      ios: {
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
      },
    }),
  },
  serviceButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'lightgrey',
    paddingVertical: 10,
    marginHorizontal: 5,
    borderRadius: 8,
  },
  serviceButtonText: {
    color: 'black',
    fontWeight: '400',
    fontSize: 15,
  },
  confirmButton: {
    marginTop: 50,
    backgroundColor: 'lightblue',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    ...Platform.select({
      android: {
        elevation: 5,
      },
      ios: {
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
      },
    }),
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  bgImage: {
    top: 0,
    height: 900,
    width: 400,
    position: 'absolute',
  },
});

export default OrderScreen;
