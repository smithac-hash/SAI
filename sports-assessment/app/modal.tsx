import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from '@/components/Themed';
import { router } from 'expo-router';

export default function ModalScreen() {
  const { width } = useWindowDimensions();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="auto" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text
            style={[
              styles.title,
              { fontSize: Math.min(width * 0.07, 26) },
            ]}
          >
            View Results
          </Text>

          <View style={styles.card}>
            <Text style={styles.heading}>Your Assessment</Text>
            <Text style={styles.description}>
              Your sports assessment results will appear here.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Performance Summary</Text>
            <Text style={styles.description}>
              Complete an assessment to view your performance
              measurements and improvement suggestions.
            </Text>
          </View>

          <View
            style={styles.button}
            onTouchEnd={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </View>
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
    flex: 1,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: '5%',
    paddingVertical: 24,
  },
  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    width: '100%',
    padding: 18,
    marginBottom: 16,
    borderRadius: 14,
    backgroundColor: '#E9EEF5',
  },
  heading: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#14213D',
  },
  description: {
    fontSize: 15,
    lineHeight: 23,
    color: '#526078',
  },
  button: {
    width: '100%',
    maxWidth: 340,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#14213D',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});