import React, { useState } from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';
import HomeScreen from '../screens/HomeScreen';
import OrderScreen from '../screens/OrderScreen';
import OmatTiedotScreen from '../screens/OmatTiedotScreen';
import OrderHistoryScreen from '../screens/ExtraScreen';
import WinterBackground from '../components/WinterBackground';
import { HomeSnowContext, SNOW_BACKGROUND } from '../components/HomeSnowContext';

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [mountain, setMountain] = useState(null);

  return (
    <HomeSnowContext.Provider value={setMountain}>
    <Tab.Navigator
      initialRouteName="Koti"
      tabBar={(props) => (
        <View style={{ backgroundColor: 'transparent' }}>
          {props.state.routes[props.state.index].name === 'Koti' && mountain && (
            <Animated.View
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[StyleSheet.absoluteFill, {
                backgroundColor: SNOW_BACKGROUND,
                opacity: mountain.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
              }]}
            />
          )}
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          let iconName;

          switch (route.name) {
            case 'Koti':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Tilaus':
              iconName = focused ? 'snow' : 'snow-outline';
              break;
            case 'Historia':
              iconName = focused ? 'receipt' : 'receipt-outline';
              break;
            case 'Profiili':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'ellipsis-horizontal-outline';
          }

          return (
            <View style={{ alignItems: 'center' }}>
              <Ionicons name={iconName} size={23} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: theme.colors.navigationActive,
        tabBarInactiveTintColor: theme.colors.navigationInactive,
        tabBarHideOnKeyboard: true,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          backgroundColor: theme.colors.navigationBackground,
          borderTopWidth: 1,
          borderTopColor: theme.colors.navigationBorder,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          overflow: 'hidden',
          height: 64 + Math.max(insets.bottom, 8) + Math.max(fontScale - 1, 0) * 30,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          elevation: 0,
        },
        tabBarLabelStyle: { fontFamily: theme.fonts.semibold, fontSize: 13 },
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      })}
    >
      <Tab.Screen
        name="Koti"
        component={HomeScreen}
        options={{ title: 'Koti' }}
      />
      <Tab.Screen
        name="Tilaus"
        component={OrderScreen}
        options={{ title: 'Tilaa' }}
      />
      <Tab.Screen
        name="Historia"
        component={OrderHistoryScreen}
        options={{ title: 'Historia' }}
      />
      <Tab.Screen 
        name="Profiili" 
        component={OmatTiedotScreen}
        options={{ title: 'Profiili' }}
      />
    </Tab.Navigator>
    </HomeSnowContext.Provider>
  );
};

const AppNavigator = () => {
  const { theme } = useTheme();
  const [activeRoute, setActiveRoute] = useState('Koti');
  const baseTheme = theme.mode === 'light' ? DefaultTheme : DarkTheme;
  return (
    <View style={{ flex: 1 }}>
      <WinterBackground
        overlayColor={activeRoute === 'Koti' ? theme.colors.homeOverlay : theme.colors.overlay}
        centerOverlayColor={activeRoute === 'Koti' ? theme.colors.homeCenterOverlay : undefined}
      />
      <NavigationContainer
        theme={{ ...baseTheme, colors: { ...baseTheme.colors, background: 'transparent', card: theme.colors.surface, text: theme.colors.textPrimary, border: theme.colors.border, primary: theme.colors.primaryLight } }}
        onStateChange={(state) => {
          if (state) setActiveRoute(state.routes[state.index].name);
        }}
      >
        <TabNavigator />
      </NavigationContainer>
    </View>
  );
};

export default AppNavigator;
