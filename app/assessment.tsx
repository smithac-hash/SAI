
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

export default function AssessmentScreen() {
  const { name } = useLocalSearchParams<{ name?: string }>();
  const { width } = useWindowDimensions();

  const athleteName = Array.isArray(name)
    ? name[0]
    : name || 'Athlete';

  const tests = [
    {
      icon: '📏',
      title: 'Height',
      description: 'Measure your height',
      route: '/height',
    },
    {
      icon: '🏋️',
      title: 'Squats',
      description: 'Test lower-body strength',
      route: '/squat',
    },
    {
      icon: '🤸',
      title: 'Sit-ups',
      description: 'Test abdominal strength and endurance',
      route: '/situps',
    },
    {
      icon: '🧍',
      title: 'Single-Leg Balance',
      description: 'Test balance and postural stability',
      route: '/singlelegbalance',
    },
    {
      icon: '💪',
      title: 'Push-ups',
      description: 'Test upper-body strength',
      route: '/pushups',
    },
    {
      icon: '🦘',
      title: 'Vertical Jump',
      description: 'Test explosive power',
      route: '/verticaljump',
    },
    {
      icon: '🧘',
      title: 'Plank',
      description: 'Test core strength and endurance',
      route: '/plank',
    },
    {
      icon: '🪑',
      title: 'Wall Sit',
      description: 'Measure lower-body muscular endurance',
      route: '/wallsit',
    },
    {
      icon: '🏃',
      title: 'High Knees',
      description: 'Test speed and cardiovascular endurance',
      route: '/highknees',
    },
    {
      icon: '⚡',
      title: 'Agility',
      description: 'Test speed and agility',
      route: '/agility',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.container,
            { paddingHorizontal: width < 360 ? 16 : 20 },
          ]}
        >
          <Text
            style={[
              styles.title,
              { fontSize: Math.min(width * 0.075, 30) },
            ]}
          >
            Fitness Assessment
          </Text>

          <Text style={styles.welcome}>
            Welcome, {athleteName}!
          </Text>

          <Text style={styles.subtitle}>
            Complete the following tests to build your fitness profile.
          </Text>

          {tests.map(test => (
            <Pressable
              key={test.title}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
              onPress={() => router.push(test.route as any)}
              accessibilityRole="button"
              accessibilityLabel={`${test.title}: ${test.description}`}
            >
              <Text style={styles.icon}>{test.icon}</Text>

              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>
                  {test.title}
                </Text>

                <Text style={styles.cardText}>
                  {test.description}
                </Text>
              </View>

              <Text style={styles.arrow}>›</Text>
            </Pressable>
          ))}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/results')}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>View Results</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.historyButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/history')}
            accessibilityRole="button"
          >
            <Text style={styles.historyButtonText}>
              Assessment History
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingTop: 16,
    paddingBottom: 28,
  },
  title: {
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 10,
  },
  welcome: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666666',
    marginBottom: 18,
  },
  card: {
    width: '100%',
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  cardPressed: {
    opacity: 0.75,
  },
  icon: {
    width: 52,
    fontSize: 29,
    marginRight: 12,
    textAlign: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  cardText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666666',
    marginTop: 4,
    flexShrink: 1,
  },
  arrow: {
    fontSize: 28,
    color: '#64748B',
    marginLeft: 8,
  },
  button: {
    width: '100%',
    minHeight: 52,
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  historyButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyButtonText: {
    color: '#14213D',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
