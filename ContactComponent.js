import React, { useEffect, useState } from 'react';
import { TouchableOpacity, Text, Linking, Alert } from 'react-native';
import styles from '././styles';

const CallButton = ({ phoneNumber }) => {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      const url = `tel:${phoneNumber}`;
      try {
        const supported = await Linking.canOpenURL(url);
        setIsSupported(supported);
      } catch (err) {
        console.error('Error checking tel: support', err);
        setIsSupported(false);
      }
    };

    checkSupport();
  }, [phoneNumber]);

  const handlePress = () => {
    const url = `tel:${phoneNumber}`;
    Linking.openURL(url).catch((err) => {
      Alert.alert('Error', `An unexpected error occurred: ${err.message}`);
    });
  };


  return (
    <TouchableOpacity onPress={handlePress}
    style={[styles.menuItem, {backgroundColor: '#fffff9'}]}
>
<Text style={[styles.menuItemText, { color: 'black' }]}>Soita</Text>
    </TouchableOpacity>
  );
};

export default CallButton;