import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleSheet, View } from 'react-native';
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
            <View style={[
              focused && {
                backgroundColor: 'rgba(76, 132, 175, 0.25)',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(76, 132, 175, 0.45)',
                paddingHorizontal: 14,
                paddingVertical: 6,
              }
            ]}>
              <Ionicons name={iconName} size={24} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: '#4c84af',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.5)',
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 24 : 16,
          left: 24,
          right: 24,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 64,
        },
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: 32,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(15, 23, 42, 0.82)',
              },
            ]}
          />
        ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarItemStyle: {
          height: 64,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 10,
          flex: 1,
        },
        tabBarIconStyle: {
          marginBottom: 0,
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