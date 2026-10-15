import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');

  const { width } = useWindowDimensions();

  const handleContinue = () => {
    router.push({
      pathname: '/assessment',
      params: {
        name,
        age,
        gender,
        weight,
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.container,
              { paddingHorizontal: Math.max(20, width * 0.06) },
            ]}
          >
            <Text
              style={[
                styles.title,
                { fontSize: Math.min(width * 0.08, 30) },
              ]}
            >
              Your Profile
            </Text>

            <Text style={styles.subtitle}>
              Tell us a little about yourself
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              accessibilityLabel="Name"
            />

            <TextInput
              style={styles.input}
              placeholder="Age"
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
              returnKeyType="next"
              accessibilityLabel="Age"
            />

            <TextInput
              style={styles.input}
              placeholder="Gender"
              value={gender}
              onChangeText={setGender}
              returnKeyType="next"
              accessibilityLabel="Gender"
            />

            <TextInput
              style={styles.input}
              placeholder="Weight (kg)"
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
              returnKeyType="done"
              accessibilityLabel="Weight in kilograms"
            />

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleContinue}
              accessibilityRole="button"
            >
              <Text style={styles.buttonText}>Continue</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  keyboardView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 28,
    width: '100%',
    alignSelf: 'center',
    maxWidth: 500,
  },

  title: {
    fontWeight: 'bold',
    color: '#14213D',
    textAlign: 'center',
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 30,
  },

  input: {
    width: '100%',
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#14213D',
  },

  button: {
    width: '100%',
    minHeight: 52,
    backgroundColor: '#14213D',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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