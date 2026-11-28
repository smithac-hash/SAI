import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AccountRole, apiRequest, AuthUser, saveAuth } from '../lib/api';

type AuthResponse = { token: string; user: AuthUser };

export default function AccountScreen() {
  const [role, setRole] = useState<AccountRole>('athlete');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [organization, setOrganization] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      Alert.alert('Missing details', 'Enter your full name.');
      return;
    }
    if (mode === 'register' && password.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }

    const body: Record<string, unknown> = {
      email: email.trim().toLowerCase(),
      password,
      role,
    };

    if (mode === 'register') {
      body.name = name.trim();
      if (role === 'athlete') {
        if (!age.trim() || !gender.trim() || !weight.trim()) {
          Alert.alert('Missing details', 'Enter your age, gender and weight.');
          return;
        }
        body.age = Number(age);
        body.gender = gender.trim();
        body.weight = Number(weight);
      } else {
        body.organization = organization.trim();
        body.specialization = specialization.trim();
      }
    }

    setLoading(true);
    try {
      const result = await apiRequest<AuthResponse>(
        mode === 'register' ? '/api/auth/register' : '/api/auth/login',
        { method: 'POST', body, authenticated: false }
      );
      await saveAuth(result.token, result.user);

      if (result.user.role === 'coach') {
        router.replace('/coach/dashboard' as any);
      } else {
        router.replace('/athlete/dashboard' as any);
      }
    } catch (error) {
      Alert.alert('Account error', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <Text style={styles.logo}>SAI</Text>
            <Text style={styles.title}>Welcome to SAI</Text>
            <Text style={styles.subtitle}>Sign in or create your account</Text>

            <Text style={styles.label}>I am a</Text>
            <View style={styles.segment}>
              <Pressable
                onPress={() => setRole('athlete')}
                style={[styles.segmentButton, role === 'athlete' && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, role === 'athlete' && styles.segmentTextActive]}>Athlete</Text>
              </Pressable>
              <Pressable
                onPress={() => setRole('coach')}
                style={[styles.segmentButton, role === 'coach' && styles.segmentActive]}
              >
                <Text style={[styles.segmentText, role === 'coach' && styles.segmentTextActive]}>Coach</Text>
              </Pressable>
            </View>

            <View style={styles.modeRow}>
              <Pressable onPress={() => setMode('login')}>
                <Text style={[styles.modeText, mode === 'login' && styles.modeSelected]}>Login</Text>
              </Pressable>
              <Text style={styles.modeDivider}>|</Text>
              <Pressable onPress={() => setMode('register')}>
                <Text style={[styles.modeText, mode === 'register' && styles.modeSelected]}>Create account</Text>
              </Pressable>
            </View>

            {mode === 'register' && (
              <>
                <Text style={styles.label}>Full name</Text>
                <TextInput style={styles.input} placeholder="Enter your name" value={name} onChangeText={setName} />
              </>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {mode === 'register' && role === 'athlete' && (
              <>
                <Text style={styles.label}>Age</Text>
                <TextInput style={styles.input} placeholder="Age" value={age} onChangeText={setAge} keyboardType="number-pad" />
                <Text style={styles.label}>Gender</Text>
                <TextInput style={styles.input} placeholder="Gender" value={gender} onChangeText={setGender} />
                <Text style={styles.label}>Weight (kg)</Text>
                <TextInput style={styles.input} placeholder="Weight in kg" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
              </>
            )}

            {mode === 'register' && role === 'coach' && (
              <>
                <Text style={styles.label}>Organization (optional)</Text>
                <TextInput style={styles.input} placeholder="Academy / organization" value={organization} onChangeText={setOrganization} />
                <Text style={styles.label}>Specialization (optional)</Text>
                <TextInput style={styles.input} placeholder="e.g. Athletics, Football" value={specialization} onChangeText={setSpecialization} />
              </>
            )}

            <Pressable style={[styles.primaryButton, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{mode === 'login' ? 'Login' : 'Create account'}</Text>}
            </Pressable>
            <Pressable style={styles.backButton} onPress={() => router.replace('/')}>
              <Text style={styles.backText}>Back to home</Text>
            </Pressable>
            <Text style={styles.note}>Athlete profiles are private until the athlete chooses to be discoverable.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { flexGrow: 1, padding: 20, justifyContent: 'center' },
  container: { width: '100%', maxWidth: 500, alignSelf: 'center' },
  logo: { fontSize: 34, fontWeight: '900', color: '#14213D', letterSpacing: 4, textAlign: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: '#14213D', textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 6, marginBottom: 24 },
  label: { color: '#14213D', fontWeight: '700', marginBottom: 7, marginTop: 10 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 14, minHeight: 50, color: '#14213D' },
  segment: { flexDirection: 'row', backgroundColor: '#E2E8F0', padding: 4, borderRadius: 12 },
  segmentButton: { flex: 1, padding: 12, alignItems: 'center', borderRadius: 9 },
  segmentActive: { backgroundColor: '#14213D' },
  segmentText: { color: '#475569', fontWeight: '700' },
  segmentTextActive: { color: '#fff' },
  modeRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, marginVertical: 20 },
  modeText: { color: '#64748B', fontWeight: '700' },
  modeSelected: { color: '#14213D', textDecorationLine: 'underline' },
  modeDivider: { color: '#94A3B8' },
  primaryButton: { backgroundColor: '#14213D', minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  backButton: { alignItems: 'center', padding: 14 },
  backText: { color: '#475569', fontWeight: '600' },
  note: { color: '#64748B', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
});
