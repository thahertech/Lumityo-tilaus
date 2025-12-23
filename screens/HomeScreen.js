import React, { useRef, useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, Image, StatusBar, Animated, Alert, StyleSheet, Linking, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import styles from '../styles';
import { theme } from '../theme';
import heroImage from '../assets/Mountains.jpg';
import HeaderImage from '../assets/Header.png';
import NotificationLabel from '../NotificationLabel';
import JatkuvaTilausStatus from '../JatkuvaTilausStatus';
import { getDeviceId } from '../FreeOrderUtils';
import { hasClaimedFreeOrder, getOrdersByDevice } from '../SupabaseAPI';
import * as FileSystem from 'expo-file-system';

const ModernButton = ({ title, onPress, iconName, variant = 'primary', subtitle }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      tension: 100,
      friction: 5,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 5,
    }).start();
  };

  const getColors = () => {
    switch (variant) {
      case 'primary':
        return [theme.colors.primary, theme.colors.primaryDark];
      case 'secondary':
        return ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)'];
      case 'danger':
        return ['#ff4444', '#cc0000'];
      case 'contact':
        return ['rgba(0, 0, 0, 0.78)', 'rgba(0, 0, 0, 0.85)'];
      default:
        return [theme.colors.primary, theme.colors.primaryDark];
    }
  };

  const getTextColor = () => {
    return variant === 'secondary' ? theme.colors.textPrimary : '#fff';
  };

  const getIconColor = () => {
    return variant === 'secondary' ? theme.colors.primary : '#fff';
  };

  return (
    <Animated.View style={[localStyles.buttonWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        accessibilityLabel={title}
      >
        <LinearGradient
          colors={getColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={localStyles.buttonGradient}
        >
          <View style={localStyles.buttonContent}>
            {iconName && (
              <View style={localStyles.iconContainer}>
                <Ionicons name={iconName} size={24} color={getIconColor()} />
              </View>
            )}
            <View style={localStyles.textContainer}>
              <Text style={[localStyles.buttonTitle, { color: getTextColor() }]}>
                {title}
              </Text>
              {subtitle && (
                <Text style={[localStyles.buttonSubtitle, { color: getTextColor(), opacity: 0.8 }]}>
                  {subtitle}
                </Text>
              )}
            </View>
            <Ionicons 
              name="chevron-forward" 
              size={30} 
              color={getIconColor()} 
              style={{ opacity: 0.6 }}
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const HomeScreen = () => {
  const phoneNumber = '+358407362403';
  const navigation = useNavigation();
  const slideAnim = useRef(new Animated.Value(-12000)).current;
  const [isEligibleForFree, setIsEligibleForFree] = useState(false);

  const checkOrderEligibility = async () => {
    try {
      const deviceId = await getDeviceId();
      const hasFreeOrder = await hasClaimedFreeOrder(deviceId);
      setIsEligibleForFree(!hasFreeOrder);
    } catch (error) {
      console.error('Error checking order eligibility:', error);
      setIsEligibleForFree(false);
    }
  };

  useEffect(() => {
    checkOrderEligibility();
    // Slide in from left animation
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 2,
      friction: 900,
      useNativeDriver: true,
    }).start();
  }, []);

  // Re-check eligibility when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      checkOrderEligibility();
    }, [])
  );

  const handleOrderButtonPress = () => {
    navigation.navigate('Tilaus', { isEligibleForFree });
  };

  const handleDeleteDB = () => {
    Alert.alert(
      'Poista tietokanta',
      'Haluatko varmasti poistaa kaikki tiedot? Tätä toimintoa ei voi peruuttaa.',
      [
        {
          text: 'Peruuta',
          style: 'cancel'
        },
        {
          text: 'Poista',
          style: 'destructive',
          onPress: async () => {
            try {
              // Note: This only shows an alert - data is now in Supabase
              // To actually delete, would need to delete from Supabase by device_id
              Alert.alert('Info', 'Tiedot ovat nyt Supabasessa. Ota yhteyttä poistaaksesi ne.');
              
              checkOrderEligibility();
            } catch (error) {
              Alert.alert('Virhe', 'Virhe tarkistettaessa tilauksia.');
            }
          }
        }
      ]
    );
  };

  const handleDatabaseClear = () => {
    Alert.alert(
      'Tyhjennä vanha tietokanta',
      'Haluatko poistaa vanhan SQLite-tietokannan? Tämä poistaa paikallisesti tallennetut tilaukset (uudet tilaukset ovat Supabasessa).',
      [
        {
          text: 'Peruuta',
          style: 'cancel'
        },
        {
          text: 'Poista SQLite',
          style: 'destructive',
          onPress: async () => {
            try {
              const dbPath = `${FileSystem.documentDirectory}SQLite/lumiapp.db`;
              const fileInfo = await FileSystem.getInfoAsync(dbPath);
              
              if (fileInfo.exists) {
                await FileSystem.deleteAsync(dbPath);
                Alert.alert('Onnistui', 'SQLite-tietokanta poistettu.');
              } else {
                Alert.alert('Info', 'SQLite-tietokantaa ei löytynyt.');
              }
              
              checkOrderEligibility();
            } catch (error) {
              console.error('Error deleting SQLite:', error);
              Alert.alert('Virhe', 'Tietokannan poisto epäonnistui: ' + error.message);
            }
          }
        }
      ]
    );
  };

  const handlePhonePress = () => {
    const url = `tel:${phoneNumber}`;
    Linking.openURL(url).catch((err) => {
      Alert.alert('Virhe', 'Puhelun soittaminen epäonnistui.');
    });
  };

  return (
    <View style={[styles.container, { paddingTop: StatusBar.currentHeight || 0 }]}> 
      <StatusBar barStyle="light-content" translucent={true} />

      <Image source={HeaderImage} style={styles.smallerHeaderImage} resizeMode="cover" />
      <Image source={heroImage} style={styles.headerImage} resizeMode="cover" />

      <NotificationLabel />

      {isEligibleForFree && (
        <Animated.View style={{
          position: 'absolute',
          top: '50%',
          left: 30,
          right: 30,
          backgroundColor: 'rgba(0, 0, 0, 0.31)',
          borderRadius: 16,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#000000ff',
          shadowOffset: { width: 2, height: 4 },
          shadowOpacity: 0.45,
          shadowRadius: 8,
          zIndex: 1000,
          borderWidth: 2,
          borderColor: '#4c84af56',
          transform: [{ translateX: slideAnim }],
        }}>
          <View style={{
            backgroundColor: '#4c84af',
            borderRadius: 12,
            padding: 10,
            marginRight: 12,
          }}>
            <Ionicons name="gift" size={28} color="#ffffffff" />
          </View>
          <View style={{ flex: 1}}>
            <Text style={{ 
              color: '#eaeaeaff', 
              fontWeight: '700', 
              fontSize: 14,
              marginBottom: 2,
            }}>
              Ensimmäinen tilaus ilmainen😊
            </Text>
            <Text style={{ 
              color: '#f7f7f7ff', 
              fontWeight: '500', 
              fontSize: 12,
            }}>
              Kokeile palvelua maksutta
            </Text>
          </View>
        </Animated.View>
      )}

      <View style={localStyles.menuContainer}>
        <ModernButton 
          title="Tilaa Lumityö" 
          onPress={handleOrderButtonPress}
          iconName="snow"
          variant="primary"
          subtitle="Luo palvelutilaus tästä"
        />

        <ModernButton 
          title="Omat tiedot" 
          onPress={() => navigation.navigate('Profiili')}
          iconName="person-circle-outline"
          variant="secondary"
        />

        <ModernButton 
          title="Soita tästä" 
          onPress={handlePhonePress}
          iconName="call"
          variant="contact"
        />
      </View>
    </View>
  );
};

const localStyles = StyleSheet.create({
  menuContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    gap: 12,
  },
  buttonWrapper: {
    marginBottom: 0,
  },
  buttonGradient: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    minHeight: 72,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  buttonSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});

export default HomeScreen;