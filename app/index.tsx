
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function HomeScreen() {
  const { width } = useWindowDimensions();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Text style={[styles.logo, { fontSize: Math.min(width * 0.16, 58) }]}>
              SAI
            </Text>
            <View style={styles.logoUnderline} />
          </View>

          <Text style={styles.title}>
            Sports Assessment & Improvement
          </Text>

          <Text style={styles.subtitle}>
            Discover your athletic potential. Measure, understand and improve.
          </Text>

          <View style={styles.illustration}>
            <Text style={styles.illustrationIcon}>🏃‍♂️</Text>
            <Text style={styles.illustrationText}>
              Your journey to better performance starts here.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/account' as any)}
            accessibilityRole="button"
          >
            <Text style={styles.loginButtonText}>
              Login / Create Account
            </Text>
            <Text style={styles.arrow}>→</Text>
          </Pressable>

          <Text style={styles.loginDescription}>
            Access your athlete or coach account
          </Text>
        </View>

        <Text style={styles.footer}>
          SAI • Athlete development starts with good measurements.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 45,
    paddingBottom: 20,
  },
  content: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  logo: {
    fontWeight: '900',
    color: '#14213D',
    letterSpacing: 7,
  },
  logoUnderline: {
    width: 55,
    height: 4,
    borderRadius: 5,
    backgroundColor: '#2563EB',
    marginTop: 8,
  },
  title: {
    fontSize: 23,
    fontWeight: '900',
    color: '#14213D',
    textAlign: 'center',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
  },
  illustration: {
    backgroundColor: '#E8EEF8',
    borderRadius: 22,
    padding: 30,
    alignItems: 'center',
    marginTop: 38,
    marginBottom: 30,
  },
  illustrationIcon: {
    fontSize: 65,
  },
  illustrationText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 14,
  },
  loginButton: {
    backgroundColor: '#14213D',
    borderRadius: 14,
    minHeight: 58,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  arrow: {
    color: '#FFFFFF',
    fontSize: 23,
    marginLeft: 12,
  },
  loginDescription: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 12,
    marginTop: 13,
  },
  footer: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 18,
  },
});
