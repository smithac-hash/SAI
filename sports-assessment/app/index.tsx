import { StyleSheet, Text, View, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function HomeScreen() {
  const { width } = useWindowDimensions();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          <Text style={[styles.title, { fontSize: Math.min(width * 0.085, 32) }]}>
            🏆 SPORTASSESS
          </Text>

          <Text style={styles.subtitle}>
            Discover your athletic potential
          </Text>

          <Pressable
            style={[styles.button, { width: Math.min(width * 0.85, 340) }]}
            onPress={() => router.push('/profile')}
          >
            <Text style={styles.buttonText}>Start Assessment</Text>
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: '6%',
    paddingVertical: 30,
  },

  title: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#14213D',
  },

  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
    color: '#526078',
    lineHeight: 26,
  },

  button: {
    backgroundColor: '#14213D',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});