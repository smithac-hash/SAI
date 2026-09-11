import { StyleSheet, Text, View, Pressable } from 'react-native';

export default function SquatScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🏋️ Squat Test</Text>

      <Text style={styles.instruction}>
        Get ready to perform your squats.
      </Text>

      <View style={styles.instructionBox}>
        <Text style={styles.step}>
          1. Place your phone at a stable position.
        </Text>

        <Text style={styles.step}>
          2. Make sure your full body is visible.
        </Text>

        <Text style={styles.step}>
          3. Stand about 2–3 metres away.
        </Text>

        <Text style={styles.step}>
          4. Keep the area well lit.
        </Text>
      </View>

      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Start Test</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 25,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },

  instruction: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 25,
  },

  instructionBox: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 20,
    marginBottom: 30,
  },

  step: {
    fontSize: 16,
    marginBottom: 15,
  },

  button: {
    backgroundColor: '#000',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },

  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});