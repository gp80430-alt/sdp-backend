import React from 'react';
import { NavigationContainer }    from '@react-navigation/native';
import { createStackNavigator }   from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider }       from 'react-native-safe-area-context';
import { StatusBar }              from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen   from './src/screens/LoginScreen';
import HomeScreen    from './src/screens/HomeScreen';
import ARScreen      from './src/screens/ARScreen';
import QRScreen      from './src/screens/QRScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createStackNavigator();

function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null; // splash

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: true }}>
      {!user
        ? <Stack.Screen name="Login"   component={LoginScreen} />
        : <>
            <Stack.Screen name="Home"    component={HomeScreen} />
            <Stack.Screen
              name="AR"
              component={ARScreen}
              options={{ animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="QR"      component={QRScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
          </>
      }
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
