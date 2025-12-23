import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/HomeScreen';
import OrderScreen from '../screens/OrderScreen';
import OmatTiedotScreen from '../screens/OmatTiedotScreen';
import OrderHistoryScreen from '../screens/ExtraScreen';

const Tab = createBottomTabNavigator();

const TabNavigator = () => {
  const insets = useSafeAreaInsets();

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
            <Ionicons 
              name={iconName} 
              size={24} 
              color={color}
            />
          );
        },
        tabBarActiveTintColor: '#4c84af',
        tabBarInactiveTintColor: '#718096',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: 'rgba(76, 132, 175, 0.2)',
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : Math.max(insets.bottom, 5),
          paddingTop: Platform.OS === 'ios' ? 2 : 5,
          height: Platform.OS === 'ios' ? 50 + insets.bottom : 60 + Math.max(insets.bottom, 0),
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: Platform.OS === 'ios' ? 14 : 11,
          fontWeight: '600',
        },
        tabBarItemStyle: {
          paddingVertical: Platform.OS === 'ios' ? 0 : 2,
        },
        tabBarIconStyle: {
          marginTop: Platform.OS === 'android' ? 2 : 0,
        },
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
  );
};

const AppNavigator = () => (
  <NavigationContainer>
    <TabNavigator />
  </NavigationContainer>
);

export default AppNavigator;