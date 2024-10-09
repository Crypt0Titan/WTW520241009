import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { API_URL, SOCKET_URL } from '../config';

const socket = io(SOCKET_URL);

export default function PlayGameScreen({ route, navigation }) {
  const { gameId } = route.params;
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [ethereumAddress, setEthereumAddress] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchGameData = useCallback(async () => {
    try {
      setLoading(true);
      const [questionsResponse, gameResponse] = await Promise.all([
        fetch(`${API_URL}/api/games/${gameId}/questions`),
        fetch(`${API_URL}/api/games/${gameId}`)
      ]);

      if (!questionsResponse.ok || !gameResponse.ok) {
        throw new Error('Network response was not ok');
      }

      const questionsData = await questionsResponse.json();
      const gameData = await gameResponse.json();

      setQuestions(questionsData);

      // Calculate time left based on current time and game end time
      const now = new Date();
      const endTime = new Date(gameData.end_time);
      const timeLeftInSeconds = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(timeLeftInSeconds);

      const address = await AsyncStorage.getItem('ethereumAddress');
      if (address) setEthereumAddress(address);
    } catch (error) {
      console.error('Error fetching game data:', error);
      Alert.alert('Error', 'Unable to fetch game data. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    fetchGameData();

    const timer = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          clearInterval(timer);
          submitAnswers();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    socket.on('game_complete', (data) => {
      if (data.game_id === gameId) {
        navigation.navigate('GameResult', { gameId });
      }
    });

    return () => {
      clearInterval(timer);
      socket.off('game_complete');
    };
  }, [gameId, fetchGameData, navigation]);

  const handleAnswerChange = (questionId, text) => {
    setAnswers(prevAnswers => ({
      ...prevAnswers,
      [questionId]: text,
    }));
  };

  const submitAnswers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/games/${gameId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ethereum_address: ethereumAddress,
          answers: Object.entries(answers).map(([questionId, answer]) => ({
            question_id: questionId,
            answer,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const result = await response.json();
      Alert.alert('Result', result.message);

      if (result.game_complete) {
        navigation.navigate('GameResult', { gameId });
      }
    } catch (error) {
      console.error('Error submitting answers:', error);
      Alert.alert('Error', 'Unable to submit answers. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Game #{gameId}</Text>
      <Text style={styles.timer}>Time left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</Text>
      {questions.map(question => (
        <View key={question.id} style={styles.questionContainer}>
          <Text style={styles.question}>{question.phrase}</Text>
          <TextInput
            style={styles.input}
            onChangeText={text => handleAnswerChange(question.id, text)}
            value={answers[question.id] || ''}
            placeholder="Your answer"
          />
        </View>
      ))}
      <TouchableOpacity style={styles.submitButton} onPress={submitAnswers}>
        <Text style={styles.submitButtonText}>Submit Answers</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // ... (styles remain unchanged)
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  timer: {
    fontSize: 18,
    marginBottom: 20,
  },
  questionContainer: {
    marginBottom: 20,
  },
  question: {
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
