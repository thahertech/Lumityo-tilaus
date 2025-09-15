import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, Alert, ScrollView, KeyboardAvoidingView, Platform, Button } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import styles from '../styles';

const OmatTiedotScreen = () => {
  const navigation = useNavigation();
  
  // User details state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  
  // Continuous order state
  const [continuousOrder, setContinuousOrder] = useState(false);

  // Load saved user data on component mount
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const savedName = await AsyncStorage.getItem('userName');
      const savedAddress = await AsyncStorage.getItem('userAddress');
      const savedPhone = await AsyncStorage.getItem('userPhone');
      const savedContinuousOrder = await AsyncStorage.getItem('continuousOrder');

      if (savedName) setName(savedName);
      if (savedAddress) setAddress(savedAddress);
      if (savedPhone) setPhone(savedPhone);
      if (savedContinuousOrder) setContinuousOrder(JSON.parse(savedContinuousOrder));
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const saveUserData = async () => {
    try {
      await AsyncStorage.setItem('userName', name);
      await AsyncStorage.setItem('userAddress', address);
      await AsyncStorage.setItem('userPhone', phone);
      await AsyncStorage.setItem('continuousOrder', JSON.stringify(continuousOrder));
      
      Alert.alert('Onnistui', 'Tiedot tallennettu!');
    } catch (error) {
      console.error('Error saving user data:', error);
      Alert.alert('Virhe', 'Tietojen tallentaminen epäonnistui');
    }
  };



  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView style={{ flex: 1, backgroundColor: "#000" }} contentContainerStyle={{ padding: 20, justifyContent: "center", alignItems: "center" }}>
        
        {/* Header */}
 

        {/* Section 1: User Details */}
        <View style={styles.sectionContainer}>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nimi</Text>
            <TextInput
              style={styles.input}
              placeholder="Syötä nimesi"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Osoite</Text>
            <TextInput
              style={styles.input}
              placeholder="Syötä osoitteesi"
              value={address}
              onChangeText={setAddress}
              autoComplete="street-address"
              textContentType="fullStreetAddress"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Puhelinnumero</Text>
            <TextInput
              style={styles.input}
              placeholder="Syötä puhelinnumerosi"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity style={styles.confirmButton} onPress={saveUserData}>
            <Text style={styles.confirmButtonText}>Tallenna Tiedot</Text>
          </TouchableOpacity>
        </View>

        {/* Section 2: Continuous Order Setting */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Tilausasetukset</Text>
          
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Jatkuva tilaus</Text>
            <Switch
              trackColor={{ false: '#767577', true: '#000000ff' }}
              thumbColor={continuousOrder ? '#f1f1f1ff' : '#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
              onValueChange={setContinuousOrder}
              value={continuousOrder}
            />
          </View>
          
          <Text style={styles.switchDescription}>
            {continuousOrder 
              ? 'Jatkuva tilaus on käytössä. Tilaus suoritetaan automaattisesti seuraavalla kierroksella.' 
              : 'Jatkuva tilaus ei ole käytössä. Tilaa palvelu manuaalisesti.'
            }
          </Text>
        </View>
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionHeader}>Oma Historia</Text>
        </View>
        <View style={{ height: 40 }} >
        <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
            Ota yhteyttä 
        </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default OmatTiedotScreen;