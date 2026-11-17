import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Easing, Image, Linking, Platform, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
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
import { PACKAGE_PREVIEW_ENABLED, getPackageSession, getPackages } from '../PackageAPI';
import tractor from '../assets/image.png';
import tractorGround from '../assets/tractor-ground.png';
import snowField from '../assets/home-snowfield.png';

const TRACTOR_OFFSET_Y = 22;
// The upper edge of the rear wheel in the tractor artwork.

function HomeAction({ title, subtitle, icon, onPress, primary, neutral, theme, tile = false }) {
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
      style={[theme.shadows.sm, tile && styles.actionTileWrapper]}
    >
      <View style={[styles.action, tile && styles.actionTile, {
        backgroundColor: background,
        borderColor: neutral ? 'rgba(0, 0, 0, 0.12)' : theme.colors.border,
      }]}>
        {tile ? <>
          <View style={[styles.actionTileIcon, { borderRightColor: dividerColor }]}>
            <Ionicons name={icon} size={22} color={foreground} />
          </View>
          <View style={styles.actionTileCopy}>
            <Text style={[styles.actionTileTitle, { color: foreground }]} numberOfLines={2}>{title}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={foreground} style={styles.actionTileArrow} />
        </> : <>
          <View style={[styles.icon, { borderRightColor: dividerColor }]}>
            <Ionicons name={icon} size={24} color={foreground} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={[styles.actionTitle, { color: foreground }]}>{title}</Text>
            {!!subtitle && <Text style={[styles.actionSubtitle, { color: subtitleColor }]}>{subtitle}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={21} color={foreground} />
        </>}
      </View>
    </TouchableOpacity>
  );
}

function AnimatedPromo({ order, eligible, reduceMotion, theme, compact, tight }) {
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
        style={[styles.promo, tight && styles.promoTight, { backgroundColor: theme.colors.homeSurface, borderColor: theme.colors.border }, theme.shadows.sm]}>
        <Text style={[styles.price, tight && styles.priceTight, { color: theme.colors.textPrimary, borderRightColor: theme.colors.border }]}>0 €</Text>
        <View style={styles.actionCopy}>
          <Text style={[styles.promoTitle, tight && styles.promoTitleTight, { color: theme.colors.textPrimary }]}>{tight ? 'Ensimmäinen tilaus · ilmainen' : 'Ensimmäinen tilaus'}</Text>
          {!tight && <Text style={[styles.promoSubtitle, { color: theme.colors.textSecondary }]}>Ilmainen uusille asiakkaille.</Text>}
        </View>
        <Ionicons name="arrow-forward" size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function TractorAndSnow({ height, width, accumulation, snowing, forecast, compact, tight, availableHeight }) {
  // Aggressive sizing caps - tractor CANNOT exceed these sizes
  let imageHeightPercent, minHeight, maxHeight;
  
  if (tight) {
    imageHeightPercent = 0.12;
    minHeight = 50;
    maxHeight = 85;
  } else if (compact) {
    imageHeightPercent = 0.14;
    minHeight = 85;
    maxHeight = 125;
  } else {
    imageHeightPercent = 0.18;
    minHeight = 100;
    maxHeight = 150;
  }
  
  // Ultra-conservative constraint - this is the HARD limit
  const constrainedMaxHeight = Math.min(maxHeight, Math.max(minHeight, (availableHeight - 260) * 0.9));
  const imageHeight = Math.min(constrainedMaxHeight, Math.max(minHeight, height * imageHeightPercent));
  const imageWidth = Math.min(Math.max(0, Math.min(width, 600) - 40) * 1.65, 850, imageHeight * 724 / 241);
  const artworkHeight = imageWidth * 241 / 724;
  const snowfallHeight = artworkHeight * 1.7;
  const groundHeight = artworkHeight * 0.18;

  return (
    <View style={[styles.hero, compact && styles.heroCompact, tight && styles.heroTight]}>
      <View pointerEvents="box-none" style={[styles.weatherSpace, compact && styles.weatherSpaceCompact, tight && styles.weatherSpaceTight]}>
        <OuluWeatherBadge forecast={forecast} compact={compact} tight={tight} />
      </View>
      <View style={styles.heroArtwork}>
        <View style={[styles.tractor, { height: imageHeight }]} accessible accessibilityLabel="Lumityötä tekevä traktori"
        >
          <View style={[styles.tractorArtboard, { width: imageWidth }]}>
            <Image pointerEvents="none" source={tractorGround} style={styles.tractorGround} resizeMode="stretch" />
            {Platform.OS !== 'android' && <View pointerEvents="none" style={[styles.snowGround, {
              width: Math.min(imageWidth * 0.78, Math.max(0, width - 40)),
              height: groundHeight,
              bottom: -artworkHeight * 0.03,
              borderRadius: groundHeight / 2,
            }]}>
              <Image source={snowField} resizeMode="cover" style={styles.snowGroundTexture} />
              {accumulation && <Animated.View style={[styles.snowGroundFresh, {
                opacity: accumulation.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0, 0.25], extrapolate: 'clamp' }),
              }]} />}
            </View>}
            <Image source={tractor} style={styles.tractorImage} resizeMode="contain" />
          </View>
        </View>
        {snowing && <Animated.View pointerEvents="none" style={[styles.snowfallFrame, {
          width: imageWidth,
          height: snowfallHeight,
          opacity: accumulation.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
          transform: [{ translateY: TRACTOR_OFFSET_Y + artworkHeight / 2 - snowfallHeight }],
        }]}><Snowfall artworkHeight={artworkHeight} /></Animated.View>}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const [eligible, setEligible] = useState(null);
  const [reduceMotion, setReduceMotion] = useState(null);
  const [needsProfile, setNeedsProfile] = useState(null);
  const [homeHeight, setHomeHeight] = useState(0);
  const tight = homeHeight < 580;
  const compact = homeHeight < 720;
  const [packageBalance, setPackageBalance] = useState(null);
  const [packageError, setPackageError] = useState(false);
  const forecast = useOuluForecast();
  const { accumulation, mountain, snowing } = useHomeSnow(reduceMotion);
  const setNavigationSnow = useContext(HomeSnowContext);
  useEffect(() => {
    if (!setNavigationSnow) return undefined;
    setNavigationSnow(mountain);
    return () => setNavigationSnow(null);
  }, [mountain, setNavigationSnow]);

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
    if (PACKAGE_PREVIEW_ENABLED) {
      (async () => {
        try {
          const session = await getPackageSession();
          const packages = session?.user ? await getPackages() : [];
          const available = packages.find(item => item.remaining > 0 && Date.parse(item.expires_at) > Date.now());
          if (active) {
            setPackageBalance(available || packages[0] || null);
            setPackageError(false);
          }
        } catch (error) {
          console.error('Package balance could not be loaded:', error);
          if (active) { setPackageBalance(null); setPackageError(true); }
        }
      })();
    }
    return () => { active = false; };
  }, []));

  const order = (service) => navigation.navigate('Tilaus', service ? { requestedService: service, requestId: Date.now() } : undefined);
  const call = () => Linking.openURL('tel:+358407362403').catch(() => {
    Alert.alert('Virhe', 'Puhelun soittaminen epäonnistui.');
  });

  return (
    <View style={styles.screen} onLayout={({ nativeEvent: { layout } }) => setHomeHeight(layout.height)}>
      <View style={[styles.content, { paddingTop: Math.min(insets.top + SCREEN_TOP_SPACING, Math.max(8, homeHeight * (tight ? 0.1 : 0.14))) }]}>
        <NotificationLabel />
        {PACKAGE_PREVIEW_ENABLED && packageBalance && <TouchableOpacity style={[styles.packageBanner, compact && styles.packageBannerCompact, tight && styles.packageBannerTight]} accessibilityRole="button"
          accessibilityLabel={`Lumityöpaketti. ${Date.parse(packageBalance.expires_at) > Date.now() ? packageBalance.remaining : 0} kertaa jäljellä kymmenestä.`}
          onPress={() => navigation.navigate('Tilaus', { openPackage: true, requestId: Date.now() })}>
          <Ionicons name="snow-outline" size={tight ? 20 : compact ? 22 : 25} color={theme.colors.primaryLight} />
          <View style={styles.packageBannerCopy}>
            <Text style={[styles.packageBannerEyebrow, { color: theme.colors.textSecondary }]}>PAKETTISI</Text>
            <Text style={[styles.packageBannerTitle, tight && styles.packageBannerTitleTight, { color: theme.colors.textPrimary }]}>Lumityöpaketti</Text>
          </View>
          <View style={styles.packageBannerBalance}>
            <Text style={[styles.packageBannerCount, tight && styles.packageBannerCountTight, { color: theme.colors.textPrimary }]}>
              {Date.parse(packageBalance.expires_at) > Date.now() ? packageBalance.remaining : 0}<Text style={[styles.packageBannerTotal, { color: theme.colors.textSecondary }]}> / 10</Text>
            </Text>
            <Text style={[styles.packageBannerMeta, tight && styles.packageBannerMetaTight, { color: theme.colors.textSecondary }]}>kertaa jäljellä</Text>
          </View>
          <Ionicons name="chevron-forward" size={tight ? 16 : 19} color={theme.colors.textSecondary} />
        </TouchableOpacity>}
        {PACKAGE_PREVIEW_ENABLED && packageError && <Text style={styles.packageTrackerError}>Pakettitietoja ei voitu ladata. Yritä myöhemmin uudelleen.</Text>}
        <AnimatedPromo order={order} eligible={eligible} reduceMotion={reduceMotion} theme={theme} compact={compact} tight={tight} />
        <TractorAndSnow
          height={homeHeight}
          width={width}
          accumulation={accumulation}
          forecast={forecast}
          snowing={snowing}
          compact={compact}
          tight={tight}
          availableHeight={homeHeight}
        />
        <View style={styles.actions}>
          <HomeAction title="Tilaa Lumityö" subtitle="Luo palvelutilaus tästä" icon="snow-outline" onPress={() => order()} primary theme={theme} />
          <View style={styles.secondaryActions}>
            <HomeAction title="Omat tiedot" subtitle={needsProfile ? 'Täydennä tiedot' : 'Päivitä tiedot'} icon="person-outline" onPress={() => navigation.navigate('Profiili')} neutral theme={theme} tile />
            <HomeAction title="Soita tästä" subtitle="Asiakaspalvelu" icon="call-outline" onPress={call} theme={theme} tile />
            <View pointerEvents="none" style={[styles.secondaryDivider, { backgroundColor: theme.colors.border }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  packageBanner: { minHeight: 58, marginHorizontal: 26, marginBottom: 4, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.24)' },
  packageBannerCompact: { minHeight: 46, marginBottom: 2, paddingVertical: 2, gap: 8 },
  packageBannerTight: { minHeight: 40, marginHorizontal: 20, marginBottom: 0, paddingVertical: 2, gap: 8 },
  packageBannerCopy: { flex: 1, minWidth: 0 },
  packageBannerEyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: '600' },
  packageBannerTitle: { fontSize: 16, fontWeight: '600' },
  packageBannerTitleTight: { fontSize: 14 },
  packageBannerBalance: { flexShrink: 0, alignItems: 'flex-end' },
  packageBannerCount: { fontSize: 22, lineHeight: 25, fontWeight: '700' },
  packageBannerCountTight: { fontSize: 18, lineHeight: 20 },
  packageBannerTotal: { fontSize: 16, fontWeight: '500' },
  packageBannerMeta: { fontSize: 12 },
  packageBannerMetaTight: { fontSize: 10 },
  packageTrackerError: { marginHorizontal: 20, marginBottom: 6, color: '#FFFFFF', fontSize: 13, lineHeight: 17 },
  content: { flex: 1, paddingBottom: 10, width: '100%', maxWidth: 600, alignSelf: 'center', overflow: 'visible' },
  hero: { flex: 1, minHeight: 0, marginHorizontal: 20, paddingBottom: 2, alignItems: 'center', overflow: 'visible' },
  heroCompact: { paddingBottom: 2 },
  heroTight: { paddingBottom: 0 },
  weatherSpace: { width: '100%', flexShrink: 0, marginBottom: 2, zIndex: 2, alignItems: 'flex-start' },
  weatherSpaceCompact: { marginBottom: 2 },
  weatherSpaceTight: { marginBottom: 0 },
  heroArtwork: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  snowField: { position: 'absolute', bottom: -16, alignSelf: 'center' },
  snowDrift: { position: 'absolute', alignSelf: 'center', bottom: -5, overflow: 'visible' },
  snowDriftPuff: { position: 'absolute', bottom: 0, width: '47%', height: '70%', borderRadius: 999, backgroundColor: '#F5FAFF', shadowColor: '#A9C5D8', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.24, shadowRadius: 7, elevation: 2 },
  snowDriftLeft: { left: '2%' },
  snowDriftRight: { right: '2%' },
  snowDriftBase: { position: 'absolute', left: '12%', right: '12%', bottom: 0, height: '42%', borderRadius: 999, backgroundColor: '#EAF4FC' },
  snowfallFrame: { position: 'absolute', top: 0, bottom: 0, alignSelf: 'center' },
  tractor: {
    width: '100%',
    maxWidth: 600,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    transform: [{ translateY: TRACTOR_OFFSET_Y }],
  },
  tractorArtboard: { aspectRatio: 724 / 241 },
  tractorImage: { width: '100%', height: '100%' },
  tractorSnowOverlay: { position: 'absolute', top: 0, bottom: 0, left: '16.6667%', width: '66.6667%' },
  snowCap: { position: 'absolute', height: '2.4%', minHeight: 2, borderRadius: 999, backgroundColor: '#F8FCFF', shadowColor: '#FFFFFF', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.9, shadowRadius: 2, elevation: 1 },
  roofSnow: { top: '4%', left: '53%', width: '40%' },
  hoodSnow: { top: '31%', left: '35%', width: '34%' },
  bucketSnow: { top: '62%', left: '3%', width: '33%' },
  rearWheelSnow: { top: '48%', left: '68%', width: '23%', height: '3%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  frontWheelSnow: { top: '61%', left: '53%', width: '18%', height: '2%', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  tractorGround: {
    position: 'absolute',
    top: 10,
    width: '100%',
    height: '106.224%',
    opacity: 0.4,
  },
  actions: { marginHorizontal: 20, marginBottom: 12, marginTop: 0, gap: 8, flexShrink: 0 },
  secondaryActions: { position: 'relative', flexDirection: 'row', gap: 12 },
  secondaryDivider: { position: 'absolute', top: 10, bottom: 10, left: '50%', width: StyleSheet.hairlineWidth, transform: [{ translateX: -0.5 }], opacity: 0.65 },
  actionTileWrapper: { flex: 1, minWidth: 0 },
  action: { flexDirection: 'row', alignItems: 'center', minHeight: 76, paddingLeft: 0, paddingRight: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, gap: 12 },
  actionTile: { minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 12, paddingRight: 12, paddingVertical: 8, gap: 0 },
  actionTileIcon: { width: 34, alignSelf: 'stretch', alignItems: 'flex-start', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth },
  actionTileCopy: { flex: 1, minWidth: 0, paddingLeft: 12, paddingRight: 12, alignItems: 'flex-end' },
  actionTileTitle: { fontSize: 13, lineHeight: 16, fontWeight: '600', textAlign: 'right' },
  actionTileArrow: { flexShrink: 0 },
  icon: { width: 72, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderRightWidth: StyleSheet.hairlineWidth },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { ...typography.cardTitle, letterSpacing: -0.3 },
  actionSubtitle: { ...typography.bodySmall },
  promoTitle: { ...typography.cardTitle, letterSpacing: -0.3 },
  promoSubtitle: { ...typography.bodySmall },
  promo: { marginHorizontal: 20, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  promoCompact: { marginBottom: 2, gap: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 13 },
  promoTight: { marginBottom: 0, gap: 6, paddingVertical: 3, paddingHorizontal: 8 },
  promoTitleCompact: { fontSize: 15, lineHeight: 18 },
  promoTitleTight: { fontSize: 13, lineHeight: 16 },
  promoSubtitleCompact: { fontSize: 11, lineHeight: 13 },
  price: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.2, paddingRight: 12, borderRightWidth: 1 },
  priceTight: { fontSize: 18, paddingRight: 8 },
});
