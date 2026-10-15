import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function SquatScreen() {
  const { width } = useWindowDimensions();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text
            style={[
              styles.title,
              { fontSize: Math.min(width * 0.08, 30) },
            ]}
          >
            🏋️ Squat Test
          </Text>

          <Text style={styles.instruction}>
            Get ready to perform your squats.
          </Text>

          <View style={styles.instructionBox}>
            <Text style={styles.boxTitle}>Before You Start</Text>

            <Text style={styles.step}>
              1. Place your phone in a stable position.
            </Text>

            <Text style={styles.step}>
              2. Make sure your full body is visible.
            </Text>

            <Text style={styles.step}>
              3. Stand about 2–3 metres away.
            </Text>

            <Text style={styles.step}>
              4. Make sure the area is well lit.
            </Text>
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>Safety First</Text>
            <Text style={styles.note}>
              Use a clear, non-slip space and perform only movements
              that are comfortable for you.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { width: Math.min(width * 0.9, 400) },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/assessment')}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Start Test</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: '5%',
    paddingVertical: 24,
    justifyContent: 'center',
  },

  title: {
    fontWeight: 'bold',
    color: '#14213D',
    textAlign: 'center',
    marginBottom: 16,
  },

  instruction: {
    fontSize: 17,
    lineHeight: 25,
    color: '#526078',
    textAlign: 'center',
    marginBottom: 24,
  },

  instructionBox: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },

  boxTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#14213D',
    marginBottom: 16,
  },

  step: {
    fontSize: 15,
    lineHeight: 23,
    color: '#334155',
    marginBottom: 12,
  },

  noteBox: {
    width: '100%',
    padding: 16,
    backgroundColor: '#E8EEF8',
    borderRadius: 12,
    marginBottom: 22,
  },

  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#14213D',
    marginBottom: 6,
  },

  note: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
  },

  button: {
    alignSelf: 'center',
    minHeight: 52,
    backgroundColor: '#14213D',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
});