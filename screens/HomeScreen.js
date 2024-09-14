import React from 'react';
import { View, TouchableOpacity, Text, Image, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import styles from '../styles';
import heroImage from '../assets/Mountains.jpg';
import HeaderImage from '../assets/snow-logo.png';
import ContactComponent from '../ContactComponent';


const CustomButton = ({ title, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress}>
    <Text style={styles.menuItemText}>{title}</Text>
  </TouchableOpacity>
);

const HomeScreen = () => {
  const phoneNumber = '+358407362403';
  const navigation = useNavigation();

  const handleOrderButtonPress = () => {
    navigation.navigate('Tilaus');
  };

  const handleOrderHistoryPress = () => {
    navigation.navigate('Historia');
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />

      <Image
        source={HeaderImage}
        style={styles.smallerHeaderImage}
        resizeMode="cover"
      />

      <Image
        source={heroImage}
        style={styles.headerImage}
        resizeMode="cover"
      />
      <View>
        <View style={styles.menuItemContainer}>
          <CustomButton title="Tilaa Lumityö" onPress={handleOrderButtonPress} />
        </View>


        <View style={styles.menuItemContainer}>
          <ContactComponent phoneNumber={phoneNumber} />
        </View>

        <View style={styles.menuItemContainer1}>
        <TouchableOpacity style={styles.menuItem1} onPress={handleOrderHistoryPress}>
          <Text style={styles.menuItemTextSmall}>Tilaushistoria</Text>
        </TouchableOpacity>
        </View>




      </View>
    </View>
  );
};

export default HomeScreen;
