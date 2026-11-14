import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Easing, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ThemeContext';
import { fonts, typography } from '../theme';
import { SCREEN_TOP_SPACING } from '../components/ScreenHeader';
import NotificationLabel from '../NotificationLabel';
import { Snowfall, useHomeSnow } from '../components/HomeSnow';
import { HomeSnowContext } from '../components/HomeSnowContext';
import OuluWeatherBadge, { useOuluForecast } from '../components/OuluWeatherBadge';
import { getDeviceId } from '../FreeOrderUtils';
import { getUserProfile, hasClaimedFreeOrder } from '../SupabaseAPI';
import tractor from '../assets/image.png';
import tractorGround from '../assets/tractor-ground.png';
import snowField from '../assets/home-snowfield.png';
import snowMountain from '../assets/home-snow-mountain.png';
import tractorSnow from '../assets/tractor-snowfall.png';

const TRACTOR_OFFSET_Y = 22;
// The upper edge of the rear wheel in the tractor artwork.
const WHEEL_TOP_RATIO = 0.4;

function HomeAction({ title, subtitle, icon, onPress, primary, neutral, theme }) {
  const background = primary ? theme.colors.primary : neutral ? '#F5F5F5' : '#151515';
  const foreground = neutral ? '#202020' : theme.colors.onPrimary;
  const subtitleColor = primary ? '#E6EEF4' : neutral ? '#505050' : '#C4C4C4';
  const dividerColor = neutral ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.22)';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      activeOpacity={0.8}
      style={theme.shadows.sm}
    >
      <View style={[styles.action, {
        backgroundColor: background,
        borderColor: neutral ? 'rgba(0, 0, 0, 0.12)' : theme.colors.border,
      }]}>
        <View style={[styles.icon, { borderRightColor: dividerColor }]}>
          <Ionicons name={icon} size={24} color={foreground} />
        </View>
        <View style={styles.actionCopy}>
          <Text style={[styles.actionTitle, { color: foreground }]}>{title}</Text>
          {!!subtitle && <Text style={[styles.actionSubtitle, { color: subtitleColor }]}>{subtitle}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={21} color={foreground} />
      </View>
    </TouchableOpacity>
  );
}

function AnimatedPromo({ order, eligible, reduceMotion, theme }) {
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(-width)).current;
  const visible = eligible === true && reduceMotion !== null;

  useFocusEffect(useCallback(() => {
    if (!visible) {
      translateX.setValue(-width);
      return;
    }
    if (reduceMotion !== false) {
      translateX.setValue(0);
      return;
    }
    translateX.setValue(-width);
    const animation = Animated.sequence([
      Animated.timing(translateX, {
        toValue: 8,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => {
      animation.stop();
      translateX.setValue(0);
    };
  }, [translateX, reduceMotion, visible, width]));

  return (
    <Animated.View
      style={{ opacity: visible ? 1 : 0, transform: [{ translateX: reduceMotion === true ? 0 : translateX }] }}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      <TouchableOpacity onPress={() => order()} accessibilityRole="button" accessibilityLabel="Ensimmäinen tilaus ilmainen. Siirry tilaamaan."
        style={[styles.promo, { backgroundColor: theme.colors.homeSurface, borderColor: theme.colors.border }, theme.shadows.sm]}>
        <Text style={[styles.price, { color: theme.colors.textPrimary, borderRightColor: theme.colors.border }]}>0 €</Text>
        <View style={styles.actionCopy}>
          <Text style={[styles.promoTitle, { color: theme.colors.textPrimary }]}>Ensimmäinen tilaus</Text>
          <Text style={[styles.promoSubtitle, { color: theme.colors.textSecondary }]}>Ilmainen uusille asiakkaille.</Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function TractorAndSnow({ height, width, accumulation, snowing, forecast, onTractorLayout }) {
  const imageHeight = Math.min(240, Math.max(170, height * 0.25));
  const imageWidth = Math.min(Math.max(0, Math.min(width, 600) - 40) * 1.65, 850, imageHeight * 724 / 241);

  return (
    <View style={styles.hero} onLayout={({ nativeEvent: { layout } }) => onTractorLayout('hero', layout)}>
      {accumulation && <Animated.Image
        pointerEvents="none"
        source={snowField}
        resizeMode="stretch"
        style={[styles.snowField, {
          opacity: accumulation,
          transform: [{ translateY: accumulation.interpolate({ inputRange: [0, 1], outputRange: [47, 12] }) }],
        }]}
      />}
      <View pointerEvents="box-none" style={styles.weatherSpace}>
        <OuluWeatherBadge forecast={forecast} />
      </View>
      <View style={styles.heroArtwork} onLayout={({ nativeEvent: { layout } }) => onTractorLayout('artwork', layout)}>
        <View style={[styles.tractor, { height: imageHeight }]} accessible accessibilityLabel="Lumityötä tekevä traktori"
          onLayout={({ nativeEvent: { layout } }) => onTractorLayout('tractor', layout)}>
          <View style={[styles.tractorArtboard, { width: imageWidth }]} onLayout={({ nativeEvent: { layout } }) => onTractorLayout('image', layout)}>
            <Image pointerEvents="none" source={tractorGround} style={styles.tractorGround} resizeMode="stretch" />
            <Image source={tractor} style={styles.tractorImage} resizeMode="contain" />
            {accumulation && <Animated.Image pointerEvents="none" source={tractorSnow} resizeMode="stretch" style={[styles.tractorSnow, { opacity: accumulation }]} />}
          </View>
        </View>
        {snowing && <Snowfall />}
      </View>
    </View>
  );
}

function SnowMountain({ height, progress, maxHeight }) {
  const mountainHeight = height * 0.88;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.snowMountain, {
        height: mountainHeight,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [mountainHeight, mountainHeight - maxHeight] }) },
          { translateX: progress.interpolate({
            inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
            outputRange: [0, -8, 7, -6, 8, 0],
          }) },
        ],
      }]}
    >
      <Image source={snowMountain} resizeMode="stretch" style={styles.mountainTexture} />
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { height, width } = useWindowDimensions();
  const [eligible, setEligible] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(null);
  const [needsProfile, setNeedsProfile] = useState(null);
  const [homeHeight, setHomeHeight] = useState(0);
  const [tractorLayout, setTractorLayout] = useState({});
  const [scrollY, setScrollY] = useState(0);
  const forecast = useOuluForecast();
  const { accumulation, mountain, snowing } = useHomeSnow(reduceMotion);
  const setNavigationSnow = useContext(HomeSnowContext);
  const updateTractorLayout = useCallback((part, layout) => {
    setTractorLayout((current) => {
      const previous = current[part];
      if (previous?.y === layout.y && previous?.height === layout.height) return current;
      return { ...current, [part]: { y: layout.y, height: layout.height } };
    });
  }, []);
  const mountainHeight = homeHeight * 0.88;
  const hasSnowToday = Array.isArray(forecast?.days[0]?.snowTimes) && forecast.days[0].snowTimes.length > 0;
  const { hero, artwork, tractor: tractorFrame, image } = tractorLayout;
  const wheelTop = hero && artwork && tractorFrame && image
    ? hero.y + artwork.y + tractorFrame.y + TRACTOR_OFFSET_Y + image.y + image.height * WHEEL_TOP_RATIO - scrollY
    : null;
  const maxMountainHeight = hasSnowToday
    ? mountainHeight
    : wheelTop === null ? 0 : Math.max(0, Math.min(mountainHeight, homeHeight - wheelTop));
  const hasVisibleMountain = maxMountainHeight > 0;

  useEffect(() => {
    if (!setNavigationSnow) return undefined;
    setNavigationSnow(hasVisibleMountain ? mountain : null);
    return () => setNavigationSnow(null);
  }, [mountain, setNavigationSnow, hasVisibleMountain]);

  useEffect(() => {
    let active = true;
    let changed = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      changed = true;
      setReduceMotion(enabled);
    });
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active && !changed) setReduceMotion(enabled);
    }).catch((error) => {
      console.error('Error checking reduced motion setting:', error);
      if (active && !changed) setReduceMotion(true);
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setNeedsProfile(null);
    const loadProfile = async (deviceId) => {
      try {
        const profile = await getUserProfile(deviceId, { throwOnError: true });
        if (active) {
          setNeedsProfile(!profile || ![profile.name, profile.address, profile.phone]
            .every((value) => typeof value === 'string' && value.trim()));
        }
      } catch (error) {
        if (active) setNeedsProfile(null);
      }
    };
    const load = async () => {
      try {
        const deviceId = await getDeviceId();
        loadProfile(deviceId);
        const claimed = await hasClaimedFreeOrder(deviceId);
        if (active) {
          setEligible(!claimed);
        }
      } catch (error) {
        console.error('Error loading home information:', error);
        if (active) setEligible(false);
      }
    };
    load();
    return () => { active = false; };
  }, []));

  const order = (service) => navigation.navigate('Tilaus', service ? { requestedService: service, requestId: Date.now() } : undefined);
  const call = () => Linking.openURL('tel:+358407362403').catch(() => {
    Alert.alert('Virhe', 'Puhelun soittaminen epäonnistui.');
  });

  return (
    <View style={styles.screen} onLayout={({ nativeEvent: { layout } }) => setHomeHeight(layout.height)}>
      {homeHeight > 0 && <SnowMountain height={homeHeight} progress={mountain} maxHeight={maxMountainHeight} />}
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + SCREEN_TOP_SPACING }]} showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent: { contentOffset } }) => setScrollY(contentOffset.y)} scrollEventThrottle={32}>
        <NotificationLabel />
        <AnimatedPromo order={order} eligible={eligible} reduceMotion={reduceMotion} theme={theme} />
        <TractorAndSnow
          height={height}
          width={width}
          accumulation={accumulation}
          forecast={forecast}
          onTractorLayout={updateTractorLayout}
          snowing={snowing && forecast?.days[0]?.snow === true}
        />
        <View style={styles.actions}>
          <HomeAction title="Tilaa Lumityö" subtitle="Luo palvelutilaus tästä" icon="snow-outline" onPress={() => order()} primary theme={theme} />
          <HomeAction title="Omat tiedot" subtitle={needsProfile ? 'Täydennä yhteystietosi' : 'Päivitä yhteystiedot'} icon="person-outline" onPress={() => navigation.navigate('Profiili')} neutral theme={theme} />
          <HomeAction title="Soita tästä" subtitle="Asiakaspalvelu" icon="call-outline" onPress={call} theme={theme} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  snowMountain: { position: 'absolute', left: -14, right: -14, bottom: 0, overflow: 'hidden' },
  mountainTexture: { width: '100%', height: '100%' },
  content: { flexGrow: 1, paddingBottom: 24, width: '100%', maxWidth: 600, alignSelf: 'center' },
  hero: { flexGrow: 1, marginHorizontal: 20, paddingBottom: 46, alignItems: 'center' },
  weatherSpace: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 },
  heroArtwork: { flexGrow: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  snowField: { position: 'absolute', bottom: 0, width: '120%', height: 150 },
  tractor: { width: '165%', maxWidth: 850, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: TRACTOR_OFFSET_Y }] },
  tractorArtboard: { aspectRatio: 724 / 241 },
  tractorImage: { width: '100%', height: '100%' },
  tractorGround: { position: 'absolute', top: 0, width: '100%', height: '106.224%' },
  tractorSnow: { position: 'absolute', top: 0, width: '100%', height: '100%' },
  actions: { marginHorizontal: 20, gap: 12 },
  action: { flexDirection: 'row', alignItems: 'center', minHeight: 76, paddingLeft: 0, paddingRight: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, gap: 12 },
  icon: { width: 72, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { ...typography.cardTitle, letterSpacing: -0.3 },
  actionSubtitle: { ...typography.bodySmall },
  promoTitle: { ...typography.cardTitle, letterSpacing: -0.3 },
  promoSubtitle: { ...typography.bodySmall },
  promo: { marginHorizontal: 20, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  price: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.2, paddingRight: 12, borderRightWidth: 1 },
});
