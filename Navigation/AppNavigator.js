import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import OrderScreen from '../screens/OrderScreen';
import OmatTiedotScreen from '../screens/OmatTiedotScreen';
import OrderHistoryScreen from '../screens/ExtraScreen';

const Tab = createBottomTabNavigator();

const AppNavigator = () => (
  <NavigationContainer>
    <Tab.Navigator
      initialRouteName="Koti"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'ellipsis-horizontal-outline'; 

          try {

            switch (route?.name) {
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
            
            // Additional safety check
            if (!iconName || typeof iconName !== 'string') {
              iconName = 'ellipsis-horizontal-outline';
            }

            return <Ionicons name={iconName} size={size || 24} color={color || '#666'} />;
          } catch (error) {
            console.warn('Error in tabBarIcon:', error);
            return <Ionicons name="ellipsis-horizontal-outline" size={24} color="#666" />;
          }
        },
        tabBarActiveTintColor: '#4c84af',
        tabBarInactiveTintColor: '#718096',
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.98)',
          borderTopWidth: 1,
          borderTopColor: 'rgba(76, 132, 175, 0.2)',
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: 10,
          height: Platform.OS === 'ios' ? 85 : 70,
        },
        tabBarLabelStyle: {
          fontSize: 16,
          fontWeight: '600',
          marginTop: 4,
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
  </NavigationContainer>
);

export default AppNavigator;