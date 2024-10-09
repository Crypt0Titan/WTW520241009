import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../config';

const socket = io(SOCKET_URL);

export default function HomeScreen({ navigation }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchGames = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/games`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      setGames(data);
    } catch (error) {
      console.error('Error fetching games:', error);
      Alert.alert('Error', 'Unable to fetch games. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGames();

    socket.on('new_game', (game) => {
      setGames(prevGames => [...prevGames, game]);
    });

    socket.on('game_updated', (updatedGame) => {
      setGames(prevGames => prevGames.map(game =>
        game.id === updatedGame.id ? updatedGame : game
      ));
    });

    return () => {
      socket.off('new_game');
      socket.off('game_updated');
    };
  }, [fetchGames]);

  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      timeZoneName: 'short' 
    });
  };

  const getGameStatus = (game) => {
    const now = new Date();
    const startTime = new Date(game.start_time);
    if (game.is_complete) return 'Completed';
    if (game.has_started) return 'In Progress';
    if (startTime > now) return 'Not Started';
    return 'Starting Soon';
  };

  const renderGameItem = ({ item }) => (
    <TouchableOpacity
      style={styles.gameItem}
      onPress={() => navigation.navigate('GameLobby', { gameId: item.id })}
    >
      <Text style={styles.gameTitle}>Game #{item.id}</Text>
      <Text>Pot Size: ${item.pot_size.toFixed(2)}</Text>
      <Text>Players: {item.players.length} / {item.max_players}</Text>
      <Text>Start Time: {formatDateTime(item.start_time)}</Text>
      <Text>Status: {getGameStatus(item)}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Available Games</Text>
      {games.length > 0 ? (
        <FlatList
          data={games}
          renderItem={renderGameItem}
          keyExtractor={item => item.id.toString()}
          refreshing={loading}
          onRefresh={fetchGames}
        />
      ) : (
        <Text style={styles.noGames}>No games available at the moment.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // ... (styles remain unchanged)
});