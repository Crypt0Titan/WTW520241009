import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './screens/HomeScreen';
import GameLobbyScreen from './screens/GameLobbyScreen';
import PlayGameScreen from './screens/PlayGameScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="GameLobby" component={GameLobbyScreen} />
        <Stack.Screen name="PlayGame" component={PlayGameScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
