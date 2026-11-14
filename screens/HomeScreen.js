import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useRef, useEffect, useState } from 'react';
import { View, TouchableOpacity, Text, Image, StatusBar, Animated, Alert, StyleSheet, Platform, Linking, ScrollView, Easing, useWindowDimensions } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import heroImage from '../assets/Mountains.jpg';
import HeaderImage from '../assets/header_img.png';
import { theme } from '../theme';
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
      ? [theme.colors.primary, theme.colors.primaryDark]
      : [theme.colors.surface, theme.colors.surface];

  const textColor = isPrimary ? theme.colors.onPrimary : theme.colors.textPrimary;
  const iconColor = textColor;

  return (
    <Animated.View style={[localStyles.buttonWrapper, entranceStyle, { transform: [{ scale: scaleAnim }] }]}> 
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      >
        {glowStyle ? <Animated.View pointerEvents="none" style={[localStyles.buttonGlow, glowStyle]} /> : null}
        <LinearGradient
          colors={getColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[localStyles.buttonGradient, !isPrimary && localStyles.secondaryButtonGradient]}
        >
          <View style={[localStyles.buttonContent, isPrimary && localStyles.primaryButtonContent]}>
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
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const heroHeight = Math.min(210, Math.max(138, windowHeight * 0.22));
  const phoneNumber = '+358407362403';
  const navigation = useNavigation();
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
        colors={['rgba(12, 12, 12, 0.85)', theme.colors.overlay, theme.colors.background]}
        style={localStyles.backgroundOverlay}
      />


      <ScrollView
        contentContainerStyle={[localStyles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <NotificationLabel />


        {isEligibleForFree && (
          <TouchableOpacity
            style={localStyles.freeBanner}
            onPress={handleOrderButtonPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Ensimmäinen tilaus ilmainen. Siirry tilaamaan."
          >
            <View style={localStyles.freeBannerPrice} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Text style={localStyles.freeBannerAmount}>0</Text>
              <Text style={localStyles.freeBannerCurrency}>€</Text>
            </View>
            <View style={localStyles.freeBannerCopy}>
              <Text style={localStyles.freeBannerTitle}>Ensimmäinen tilaus</Text>
              <Text style={localStyles.freeBannerSubtitle}>Ilmainen uusille asiakkaille.</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        )}

        <View style={localStyles.menuContainer}>
          <View style={[localStyles.heroBlock, { height: heroHeight }]}>
            <Image
              source={HeaderImage}
              style={[localStyles.heroLogo, { height: heroHeight }]}
              resizeMode="contain"
              accessible
              accessibilityLabel="Lumityötä tekevä traktori"
            />
          </View>
          <ModernButton
            title="Tilaa Lumityö"
            onPress={handleOrderButtonPress}
            iconName="snow"
            variant="primary"
            subtitle="Luo palvelutilaus tästä"
            entranceStyle={makeEntranceStyle(buttonAnim1)}

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
    backgroundColor: theme.colors.background,
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
    paddingBottom: 24,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  heroBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    width: '100%',
  },
  heroLogo: {
    width: '100%',
    maxWidth: 366,
    opacity: 0.97,
  },
  freeBanner: {
    marginHorizontal: 20,
    marginBottom: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 14,
  },
  freeBannerPrice: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  freeBannerAmount: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '500',
    letterSpacing: -1.5,
    color: theme.colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  freeBannerCurrency: {
    fontSize: 18,
    color: theme.colors.textMuted,
  },
  freeBannerCopy: {
    flex: 1,
    gap: 4,
  },
  freeBannerTitle: {
    color: theme.colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 21,
  },
  freeBannerSubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  menuContainer: {
    marginHorizontal: 18,
    gap: 10,
  },
  buttonWrapper: {
    marginBottom: 0,
  },
  buttonGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    transform: [{ scale: 1.02 }],
  },
  buttonGradient: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  secondaryButtonGradient: {
    borderColor: theme.colors.border,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 68,
  },
  primaryButtonContent: {
    minHeight: 76,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  buttonTitle: {
    ...Platform.select({
      ios: { fontFamily: 'Avenir Next', fontWeight: '500' },
      android: { fontFamily: 'sans-serif-medium', fontWeight: 'normal' },
      default: { fontFamily: 'sans-serif', fontWeight: '500' },
    }),
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  buttonSubtitle: {
    fontFamily: Platform.OS === 'ios' ? 'Avenir Next' : 'sans-serif',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: 0,
  },
});

export default HomeScreen;
