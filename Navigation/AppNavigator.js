import React from 'react';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../ThemeContext';
import HomeScreen from '../screens/HomeScreen';
import OrderScreen from '../screens/OrderScreen';
import OmatTiedotScreen from '../screens/OmatTiedotScreen';
import OrderHistoryScreen from '../screens/ExtraScreen';

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Koti"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
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
            <View style={{ borderRadius: 14, backgroundColor: focused ? theme.colors.surfaceRaised : 'transparent', paddingHorizontal: 18, paddingVertical: 5 }}>
              <Ionicons name={iconName} size={23} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderLight,
          elevation: 0,
          height: 72 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginTop: 3 },
        tabBarItemStyle: { paddingVertical: 2 },
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
        options={{ title: 'Omat sivut' }}
      />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { theme } = useTheme();
  const baseTheme = theme.mode === 'light' ? DefaultTheme : DarkTheme;
  return (
    <NavigationContainer theme={{ ...baseTheme, colors: { ...baseTheme.colors, background: theme.colors.background, card: theme.colors.surface, text: theme.colors.textPrimary, border: theme.colors.border, primary: theme.colors.primaryLight } }}>
      <TabNavigator />
    </NavigationContainer>
  );
};

export default AppNavigator;
