import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

export default function AssessmentScreen() {
  const { name } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fitness Assessment</Text>

      <Text style={styles.welcome}>
        Welcome, {name || 'Athlete'}!
      </Text>

      <Text style={styles.subtitle}>
        Complete the following tests to build your fitness profile.
      </Text>

      {/* Height */}
      <Pressable style={styles.card}>
        <Text style={styles.icon}>📏</Text>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Height</Text>
          <Text style={styles.cardText}>
            Measure your height
          </Text>
        </View>
      </Pressable>

      {/* Squats */}
      <Pressable
        style={styles.card}
        onPress={() => router.push('/squat')}
      >
        <Text style={styles.icon}>🏋️</Text>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Squats</Text>
          <Text style={styles.cardText}>
            Test lower-body strength
          </Text>
        </View>
      </Pressable>

      {/* Push-ups */}
      <Pressable style={styles.card}>
        <Text style={styles.icon}>💪</Text>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Push-ups</Text>
          <Text style={styles.cardText}>
            Test upper-body strength
          </Text>
        </View>
      </Pressable>

      {/* Vertical Jump */}
      <Pressable style={styles.card}>
        <Text style={styles.icon}>🦘</Text>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Vertical Jump</Text>
          <Text style={styles.cardText}>
            Test explosive power
          </Text>
        </View>
      </Pressable>

      {/* Agility */}
      <Pressable style={styles.card}>
        <Text style={styles.icon}>🏃</Text>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>Agility</Text>
          <Text style={styles.cardText}>
            Test speed and agility
          </Text>
        </View>
      </Pressable>

      {/* Results Button */}
      <Pressable
        style={styles.button}
        onPress={() => router.push('/results')}
      >
        <Text style={styles.buttonText}>View Results</Text>
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
    marginTop: 25,
    marginBottom: 8,
  },

  welcome: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },

  icon: {
    fontSize: 28,
    marginRight: 15,
  },

  cardContent: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },

  cardText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },

  button: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 5,
    marginBottom: 20,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});