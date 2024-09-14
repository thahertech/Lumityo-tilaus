import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import HomeScreen from '../screens/HomeScreen';
import OrderScreen from '../screens/OrderScreen';
import OrderHistoryScreen from '../screens/ExtraScreen';


const Stack = createStackNavigator();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator initialRouteName="Koti">
      <Stack.Screen name="Lumityö" component={HomeScreen} />
      <Stack.Screen name="Tilaus" component={OrderScreen} />
      <Stack.Screen name="Historia" component={OrderHistoryScreen} />

    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
