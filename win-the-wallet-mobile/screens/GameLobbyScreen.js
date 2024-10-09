import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../config';

const socket = io(SOCKET_URL);

export default function GameLobbyScreen({ route, navigation }) {
  const { gameId } = route.params;
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [countdown, setCountdown] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGameDetails();
    socket.emit('join', { game_id: gameId });

    socket.on('player_joined', data => {
      if (data.game_id === gameId) {
        setPlayers(prevPlayers => [...prevPlayers, data.player]);
      }
    });

    socket.on('game_started', data => {
      if (data.game_id === gameId) {
        console.log('Redirecting to play game.');
        navigation.navigate('PlayGameScreen', { gameId });
      } else {
        console.log('Game ID mismatch or not received:', data.game_id);
      }
    });

    return () => {
      socket.off('player_joined');
      socket.off('game_started');
    };
  }, [gameId, navigation]);

  useEffect(() => {
    let timer;
    if (game && game.start_time) {
      updateCountdown();
      timer = setInterval(updateCountdown, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [game]);

  const fetchGameDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/games/${gameId}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setGame(data);
      setPlayers(data.players);
    } catch (error) {
      console.error('Error fetching game details:', error);
      Alert.alert('Error', 'Unable to fetch game details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const updateCountdown = () => {
    if (game && game.start_time) {
      const now = new Date();
      const startTime = new Date(game.start_time);
      if (isNaN(startTime.getTime())) {
        console.error('Invalid start time:', game.start_time);
        setCountdown('Invalid start time');
        return;
      }
      const timeLeft = startTime - now;
      if (timeLeft > 0) {
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        setCountdown(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      } else {
        setCountdown('Game starting...');
        // You might want to trigger navigation to the game screen here
        navigation.navigate('PlayGameScreen', { gameId });
      }
    } else {
      setCountdown('');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Game Lobby</Text>
      <Text style={styles.countdown}>Time until start: {countdown}</Text>
      <Text style={styles.subtitle}>Players in Lobby</Text>
      <FlatList
        data={players}
        renderItem={({ item }) => <Text style={styles.playerItem}>{item.ethereum_address}</Text>}
        keyExtractor={item => item.id.toString()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // ... (styles remain unchanged)
});