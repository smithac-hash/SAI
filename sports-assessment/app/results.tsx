import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';

export default function ResultsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Results</Text>

      <Text style={styles.scoreLabel}>Fitness Score</Text>

      <Text style={styles.score}>78 / 100</Text>

      <View style={styles.resultCard}>
        <Text style={styles.resultTitle}>Strength</Text>
        <Text style={styles.resultScore}>72 / 100</Text>
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.resultTitle}>Agility</Text>
        <Text style={styles.resultScore}>81 / 100</Text>
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.resultTitle}>Endurance</Text>
        <Text style={styles.resultScore}>76 / 100</Text>
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.resultTitle}>Explosive Power</Text>
        <Text style={styles.resultScore}>83 / 100</Text>
      </View>

      <Text style={styles.recommendationTitle}>
        Recommended Sports
      </Text>

      <Text style={styles.sport}>🏸 Badminton</Text>
      <Text style={styles.sport}>🏃 Athletics</Text>
      <Text style={styles.sport}>⚽ Football</Text>

      <Pressable
        style={styles.button}
        onPress={() => router.replace('/')}
      >
        <Text style={styles.buttonText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 25,
  },

  scoreLabel: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },

  score: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 25,
  },

  resultCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },

  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
  },

  resultScore: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  recommendationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 25,
    marginBottom: 10,
  },

  sport: {
    fontSize: 17,
    marginBottom: 8,
  },

  button: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});