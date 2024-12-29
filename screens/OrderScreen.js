import React, { useState } from 'react';
import { ScrollView,TouchableWithoutFeedback, Keyboard, Image, View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import emailjs from 'emailjs-com';
import bgImage from '../assets/Mountains.jpg';


const OrderScreen = () => {
  const [firstName, setFirstName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [info, setInfo] = useState('');

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


    
    try {
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_USER_ID,

      );

      if (response.status === 200) {

        Alert.alert('Tilaus Vahvistettu', `Kiitos ${selectedService} tilauksesta!`);


      setFirstName('');
      setPhoneNumber('');
      setAddress('');
      setInfo('');
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
  <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <View style={{ flex: 1 }}>
      <Image source={bgImage} style={styles.bgImage} resizeMode="cover" />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.label, { marginTop: 15, marginBottom: 25, fontSize: 24 }]}>
          Valitse palvelu
        </Text>
        <View style={[styles.buttonContainer, { marginBottom: 5 }]}>
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
          <Text style={[styles.label, { marginBottom: 29 }]}>
            {getServiceLabel()}
          </Text>
        </View>

        {/* Input Fields */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Osoite</Text>
          <TextInput
            style={styles.input}
            placeholder="Osoite, 1 A"
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
          <Text style={styles.label}>Nimi</Text>
          <TextInput
            style={styles.input}
            placeholder="Etunimi Sukunimi"
            value={firstName}
            onChangeText={(text) => setFirstName(text)}
            autoComplete="name"
            returnKeyType="done"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Lisätietoja</Text>
          <TextInput
            style={[styles.input, { height: 100, textAlignVertical: 'top', padding: 10 }]}
            placeholder="Kirjoita lisätiedot tähän..."
            value={info}
            onChangeText={(text) => setInfo(text)}
            returnKeyType="default"
            multiline={true}
            numberOfLines={4}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.confirmButton,
            !isFormValid() && { backgroundColor: 'grey', marginTop: 0 },
          ]}
          onPress={handleOrderConfirmation}
          disabled={!isFormValid()}
        >
          <Text style={styles.confirmButtonText}>Vahvista tilaus</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  </TouchableWithoutFeedback>
</KeyboardAvoidingView>
  );
};


const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    margin: 0,
    padding: 20,
    paddingBottom: 100,

    
  },
  labelContainer: {
    marginBottom: 10,
    color: '#fff'
  },
  label: {
    marginTop: 20,
    marginBottom: 5,
    fontWeight: '300',
    textAlign: 'left',
    
  },
  inputContainer: {
    marginBottom: 5,
    
  },
  inputContainerlabel: {
    color: 'white'

  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    paddingLeft: 10,
    borderRadius: 10,
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
    height: '100%',
    width: '100%',
    position: 'absolute',
  },
});

export default OrderScreen;