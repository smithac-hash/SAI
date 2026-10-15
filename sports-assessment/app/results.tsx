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

export default function ResultsScreen() {
  const { width } = useWindowDimensions();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text
            style={[
              styles.title,
              { fontSize: Math.min(width * 0.08, 30) },
            ]}
          >
            Your Results
          </Text>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Fitness Score</Text>
            <Text style={styles.score}>78 / 100</Text>
            <Text style={styles.scoreHint}>
              Your overall assessment summary
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Performance Breakdown</Text>

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

          <View style={styles.sportCard}>
            <Text style={styles.sport}>🏸  Badminton</Text>
          </View>

          <View style={styles.sportCard}>
            <Text style={styles.sport}>🏃  Athletics</Text>
          </View>

          <View style={styles.sportCard}>
            <Text style={styles.sport}>⚽  Football</Text>
          </View>

          <Text style={styles.disclaimer}>
            These sample scores and sports suggestions are illustrative,
            not validated talent assessments.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { width: Math.min(width * 0.9, 400) },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.replace('/')}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Back to Home</Text>
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

  scrollView: {
    flex: 1,
  },

  content: {
    flexGrow: 1,
  },

  container: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: '5%',
    paddingTop: 16,
    paddingBottom: 32,
  },

  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#14213D',
    marginBottom: 20,
  },

  scoreCard: {
    width: '100%',
    backgroundColor: '#14213D',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    marginBottom: 26,
  },

  scoreLabel: {
    fontSize: 16,
    color: '#E2E8F0',
    textAlign: 'center',
  },

  score: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginVertical: 8,
  },

  scoreHint: {
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#14213D',
    marginBottom: 12,
  },

  resultCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },

  resultTitle: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },

  resultScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#14213D',
  },

  recommendationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#14213D',
    marginTop: 20,
    marginBottom: 12,
  },

  sportCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  sport: {
    fontSize: 16,
    color: '#334155',
  },

  disclaimer: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginTop: 12,
    marginBottom: 8,
  },

  button: {
    alignSelf: 'center',
    backgroundColor: '#14213D',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 52,
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});