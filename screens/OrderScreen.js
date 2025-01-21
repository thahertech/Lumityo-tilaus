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
           <Image source={bgImage} style={styles.bgImage} />
           <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContainer}>
             <Text style={styles.title}>Valitse palvelu</Text>
             <View style={styles.buttonContainer}>
               {['Lumityö', 'Polanteen poisto'].map((service) => (
                 <TouchableOpacity
                   key={service}
                   style={[
                     styles.serviceButton,
                     selectedService === service && styles.selectedServiceButton,
                   ]}
                   onPress={() => setSelectedService(service)}
                 >
                   <Text style={styles.serviceButtonText}>{service}</Text>
                 </TouchableOpacity>
               ))}
             </View>

             <Text style={styles.serviceDescription}>{getServiceLabel()}</Text>

             <TextInput
               style={styles.input}
               placeholder="Osoite, 1 A"
               value={address}
               onChangeText={setAddress}
               autoComplete="street-address"
             />
             <TextInput
               style={styles.input}
               placeholder="123 4567890"
               value={phoneNumber}
               onChangeText={setPhoneNumber}
               keyboardType="phone-pad"
             />
             <TextInput
               style={styles.input}
               placeholder="Etunimi Sukunimi"
               value={firstName}
               onChangeText={setFirstName}
             />
             <TextInput
               style={[styles.input, styles.textArea]}
               placeholder="Kirjoita lisätiedot tähän..."
               value={info}
               onChangeText={setInfo}
               multiline
             />
             <TouchableOpacity
               style={[
                 styles.confirmButton,
                 !isFormValid() && styles.disabledButton,
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
  scrollContainer: {
    flexGrow: 1,
  },   title: { fontSize: 24, marginVertical: 15, fontWeight: 'bold' },
   buttonContainer: { flexDirection: 'row', justifyContent: 'space-between' },
   serviceButton: { flex: 1, margin: 5, padding: 10, backgroundColor: '#ddd' },
   selectedServiceButton: { backgroundColor: 'lightblue' },
   serviceButtonText: { textAlign: 'center', fontWeight: 'bold' },
   serviceDescription: { marginVertical: 10, fontSize: 16 },
   input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginVertical: 10, borderRadius: 5 },
   textArea: { height: 100 },
   confirmButton: { backgroundColor: 'lightblue', padding: 15, borderRadius: 5 },
   disabledButton: { backgroundColor: 'gray' },
   confirmButtonText: { textAlign: 'center', fontWeight: 'bold', color: 'white' },
   bgImage: { flex: 1, position: 'absolute', width: '100%', height: '100%' },
 });

 export default OrderScreen;