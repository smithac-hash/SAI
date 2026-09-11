import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏆 SPORTASSESS</Text>

      <Text style={styles.subtitle}>
        Discover your athletic potential
      </Text>

      <Pressable
        style={styles.button}
        onPress={() => router.push('/profile')}
      >
        <Text style={styles.buttonText}>Start Assessment</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 15,
  },

  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
  },

  button: {
    backgroundColor: '#000',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});