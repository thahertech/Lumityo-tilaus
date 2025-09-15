import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';
import HomeScreen from '../screens/HomeScreen';
import OrderScreen from '../screens/OrderScreen';
import OmatTiedotScreen from '../screens/OmatTiedotScreen';
const Stack = createStackNavigator();

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator
      initialRouteName="Lumityö"
      screenOptions={{
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <Stack.Screen
        name="Lumityö"
        component={HomeScreen}
      />
      <Stack.Screen
        name="Tilaus"
        component={OrderScreen}
      />
      <Stack.Screen name="Omat tiedot" component={OmatTiedotScreen} />
     
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;