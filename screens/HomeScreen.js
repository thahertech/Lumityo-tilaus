import React, { useRef, useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, Image, StatusBar, Animated, Alert, StyleSheet, Linking, ScrollView, Easing } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import heroImage from '../assets/Mountains.jpg';
import HeaderImage from '../assets/Header.png';
import NotificationLabel from '../NotificationLabel';
import { getDeviceId } from '../FreeOrderUtils';
import { hasClaimedFreeOrder } from '../SupabaseAPI';

const ModernButton = ({ title, onPress, iconName, variant = 'primary', subtitle, entranceStyle, glowStyle }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const arrowOpacity = useRef(new Animated.Value(0.65)).current;
  const arrowTranslateX = useRef(new Animated.Value(0)).current;

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

  const isPrimary = variant === 'primary';

  useEffect(() => {
    if (!isPrimary) {
      return;
    }

    const arrowLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(arrowOpacity, {
            toValue: 1,
            duration: 480,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(arrowTranslateX, {
            toValue: 3,
            duration: 480,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(arrowOpacity, {
            toValue: 0.65,
            duration: 560,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(arrowTranslateX, {
            toValue: 0,
            duration: 560,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    arrowLoop.start();
    return () => arrowLoop.stop();
  }, [isPrimary, arrowOpacity, arrowTranslateX]);

  const getColors = () =>
    isPrimary
      ? ['rgba(76, 132, 175, 0.92)', 'rgba(44, 82, 130, 0.92)']
      : ['rgba(7, 13, 20, 0.58)', 'rgba(7, 13, 20, 0.58)'];

  const textColor = '#f8fafc';
  const iconColor = isPrimary ? '#ffffff' : '#cfe3f4';

  return (
    <Animated.View style={[localStyles.buttonWrapper, entranceStyle, { transform: [{ scale: scaleAnim }] }]}> 
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        accessibilityLabel={title}
      >
        {glowStyle ? <Animated.View pointerEvents="none" style={[localStyles.buttonGlow, glowStyle]} /> : null}
        <LinearGradient
          colors={getColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[localStyles.buttonGradient, !isPrimary && localStyles.secondaryButtonGradient]}
        >
          <View style={localStyles.buttonContent}>
            {iconName && (
              <View style={localStyles.iconContainer}>
                <Ionicons name={iconName} size={20} color={iconColor} />
              </View>
            )}
            <View style={localStyles.textContainer}>
              <Text style={[localStyles.buttonTitle, { color: textColor }]}> 
                {title}
              </Text>
              {subtitle && (
                <Text style={[localStyles.buttonSubtitle, { color: textColor, opacity: 0.8 }]}> 
                  {subtitle}
                </Text>
              )}
            </View>
            <Animated.View
              style={
                isPrimary
                  ? { opacity: arrowOpacity, transform: [{ translateX: arrowTranslateX }] }
                  : { opacity: 0.7 }
              }
            >
              <Ionicons 
                name="chevron-forward" 
                size={20} 
                color={iconColor}
              />
            </Animated.View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const HomeScreen = () => {
  const phoneNumber = '+358407362403';
  const navigation = useNavigation();
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTranslateY = useRef(new Animated.Value(-6)).current;
  const bannerScale = useRef(new Animated.Value(0.96)).current;
  const bannerPulse = useRef(new Animated.Value(0)).current;
  const hasShownBannerOnce = useRef(false);
  const buttonAnim1 = useRef(new Animated.Value(0)).current;
  const buttonAnim2 = useRef(new Animated.Value(0)).current;
  const buttonAnim3 = useRef(new Animated.Value(0)).current;
  const primaryGlow = useRef(new Animated.Value(0.35)).current;
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

    // Staggered appearance for action buttons.
    Animated.stagger(90, [
      Animated.spring(buttonAnim1, {
        toValue: 1,
        tension: 70,
        friction: 16,
        useNativeDriver: true,
      }),
      Animated.spring(buttonAnim2, {
        toValue: 1,
        tension: 70,
        friction: 16,
        useNativeDriver: true,
      }),
      Animated.spring(buttonAnim3, {
        toValue: 1,
        tension: 70,
        friction: 16,
        useNativeDriver: true,
      }),
    ]).start();

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(primaryGlow, {
          toValue: 0.5,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(primaryGlow, {
          toValue: 0.35,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    glowLoop.start();

    return () => {
      glowLoop.stop();
    };
  }, []);

  useEffect(() => {
    if (isEligibleForFree) {
      bannerOpacity.setValue(0);
      bannerTranslateY.setValue(10);
      bannerScale.setValue(0.96);
      bannerPulse.setValue(0);

      const entranceDelay = hasShownBannerOnce.current ? 90 : 500;
      hasShownBannerOnce.current = true;

      Animated.sequence([
        Animated.delay(entranceDelay),
        Animated.parallel([
          Animated.timing(bannerOpacity, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(bannerTranslateY, {
            toValue: 0,
            tension: 70,
            friction: 10,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(bannerScale, {
              toValue: 1.02,
              duration: 180,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.spring(bannerScale, {
              toValue: 1,
              tension: 95,
              friction: 12,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(bannerPulse, {
              toValue: 0.45,
              duration: 260,
              useNativeDriver: true,
            }),
            Animated.timing(bannerPulse, {
              toValue: 0,
              duration: 520,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(bannerOpacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bannerTranslateY, {
        toValue: -4,
        duration: 180,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bannerScale, {
        toValue: 0.98,
        duration: 180,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isEligibleForFree]);

  // Re-check eligibility when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      checkOrderEligibility();
    }, [])
  );

  const handleOrderButtonPress = () => {
    navigation.navigate('Tilaus', { isEligibleForFree });
  };

  const handlePhonePress = () => {
    const url = `tel:${phoneNumber}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Virhe', 'Puhelun soittaminen epäonnistui.');
    });
  };

  const makeEntranceStyle = (anim) => ({
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
              outputRange: [10, 0],
        }),
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
              outputRange: [0.992, 1],
        }),
      },
    ],
  });

  return (
    <View style={localStyles.screen}>
      <StatusBar barStyle="light-content" translucent={true} />

      <Image source={heroImage} style={localStyles.backgroundImage} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(5, 12, 20, 0.25)', 'rgba(5, 12, 20, 0.68)', 'rgba(5, 12, 20, 0.95)']}
        style={localStyles.backgroundOverlay}
      />

      <NotificationLabel />

      <ScrollView
        contentContainerStyle={localStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={localStyles.heroBlock}>
          <Image source={HeaderImage} style={localStyles.heroLogo} resizeMode="contain" />
        </View>

        <View style={localStyles.freeBannerSlot}>
          <Animated.View
            pointerEvents={isEligibleForFree ? 'auto' : 'none'}
            style={[
              localStyles.freeBanner,
              {
                opacity: bannerOpacity,
                transform: [{ translateY: bannerTranslateY }, { scale: bannerScale }],
              },
            ]}
          >
            <Animated.View pointerEvents="none" style={[localStyles.freeBannerPulse, { opacity: bannerPulse }]} />
            <View style={localStyles.freeBannerIcon}>
              <Ionicons name="gift" size={28} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={localStyles.freeBannerTitle}>Ensimmainen tilaus ilmainen</Text>
              <Text style={localStyles.freeBannerSubtitle}>Kokeile palvelua maksutta</Text>
            </View>
          </Animated.View>
        </View>

        <View style={localStyles.menuContainer}>
          <ModernButton
            title="Tilaa Lumityö"
            onPress={handleOrderButtonPress}
            iconName="snow"
            variant="primary"
            subtitle="Luo palvelutilaus tästä"
            entranceStyle={makeEntranceStyle(buttonAnim1)}
            glowStyle={{ opacity: primaryGlow }}
          />
          <ModernButton
            title="Omat tiedot"
            onPress={() => navigation.navigate('Profiili')}
            iconName="person-circle-outline"
            variant="secondary"
            subtitle="Päivitä yhteystiedot"
            entranceStyle={makeEntranceStyle(buttonAnim2)}
          />
          <ModernButton
            title="Soita tästä"
            onPress={handlePhonePress}
            iconName="call"
            variant="secondary"
            subtitle="Asiakaspalvelu"
            entranceStyle={makeEntranceStyle(buttonAnim3)}
          />
        </View>
      </ScrollView>
    </View>
  );
};

const localStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#060c14',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 74,
    paddingBottom: 170,
  },
  heroBlock: {
    marginHorizontal: 20,
    marginBottom: 24,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  heroLogo: {
    width: 640,
    height: 246,
    opacity: 0.97,
  },
  freeBannerSlot: {
    marginHorizontal: 20,
    marginBottom: 18,
    minHeight: 82,
  },
  freeBanner: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
  },
  freeBannerPulse: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(125, 186, 236, 0.22)',
    borderRadius: 16,
  },
  freeBannerIcon: {
    backgroundColor: 'rgba(76, 132, 175, 0.85)',
    borderRadius: 12,
    padding: 9,
    marginRight: 11,
  },
  freeBannerTitle: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 2,
  },
  freeBannerSubtitle: {
    color: 'rgba(226, 232, 240, 0.92)',
    fontWeight: '500',
    fontSize: 12,
  },
  menuContainer: {
    marginHorizontal: 20,
    gap: 12,
  },
  buttonWrapper: {
    marginBottom: 0,
  },
  buttonGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: 'rgba(125, 186, 236, 0.35)',
    transform: [{ scale: 1.02 }],
  },
  buttonGradient: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  secondaryButtonGradient: {
    borderColor: 'rgba(148, 163, 184, 0.28)',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(241, 245, 249, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
    marginBottom: 1,
  },
  buttonSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.05,
  },
});

export default HomeScreen;