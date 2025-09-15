import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, Linking, Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './styles';

const ContactButtons = ({ phoneNumber, email = "info@lumityo.fi" }) => {
  const [isPhoneSupported, setIsPhoneSupported] = useState(false);
  const [isEmailSupported, setIsEmailSupported] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      try {
        const phoneUrl = `tel:${phoneNumber}`;
        const emailUrl = `mailto:${email}`;
        
        const phoneSupported = await Linking.canOpenURL(phoneUrl);
        const emailSupported = await Linking.canOpenURL(emailUrl);
        
        setIsPhoneSupported(phoneSupported);
        setIsEmailSupported(emailSupported);
      } catch (err) {
        console.error('Error checking URL support', err);
      }
    };

    checkSupport();
  }, [phoneNumber, email]);

  const handlePhonePress = () => {
    const url = `tel:${phoneNumber}`;
    console.log('Attempting to open URL:', url);
    Linking.openURL(url).catch((err) => {
      Alert.alert('Virhe', `Puhelun soittaminen epäonnistui: ${err.message}`);
    });
  };

  const handleEmailPress = () => {
    const url = `mailto:${email}?subject=Lumityö-kysely&body=Hei,%0D%0A%0D%0AHaluaisin kysyä lumityöstä...`;
    Linking.openURL(url).catch((err) => {
      Alert.alert('Virhe', `Sähköpostin avaaminen epäonnistui: ${err.message}`);
    });
  };

  return (
    <View style={styles.contactButtonsContainer}>
      <TouchableOpacity 
        onPress={handlePhonePress}
        style={[styles.contactButton, styles.phoneButton]}
        activeOpacity={0.8}
        disabled={!isPhoneSupported}
      >
        <Ionicons 
          name="call" 
          size={24}
          color="#fff"
          style={styles.contactIcon}
        />
        <Text style={styles.contactButtonText}>Soita</Text>
      </TouchableOpacity>

    
    </View>
  );
};

export default ContactButtons;
