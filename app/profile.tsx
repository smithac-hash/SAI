
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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { saveProfile } from '../lib/assessmentStore';

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');

  const { width } = useWindowDimensions();

  const handleContinue = async () => {
    const cleanName = name.trim();
    const cleanAge = age.trim();
    const cleanGender = gender.trim();
    const cleanWeight = weight.trim();

    if (!cleanName || !cleanAge || !cleanGender || !cleanWeight) {
      Alert.alert('Missing Information', 'Please fill in all fields.');
      return;
    }

    const ageNumber = Number(cleanAge);
    const weightNumber = Number(cleanWeight);

    if (
      !Number.isInteger(ageNumber) ||
      ageNumber < 5 ||
      ageNumber > 100
    ) {
      Alert.alert(
        'Invalid Age',
        'Please enter an age between 5 and 100.'
      );
      return;
    }

    if (
      !Number.isFinite(weightNumber) ||
      weightNumber < 10 ||
      weightNumber > 300
    ) {
      Alert.alert(
        'Invalid Weight',
        'Please enter a valid weight between 10 and 300 kg.'
      );
      return;
    }

    try {
      await saveProfile({
        name: cleanName,
        age: cleanAge,
        gender: cleanGender,
        weight: cleanWeight,
      });

      router.push({
        pathname: '/assessment',
        params: {
          name: cleanName,
          age: cleanAge,
          gender: cleanGender,
          weight: cleanWeight,
        },
      });
    } catch (error) {
      console.error('Profile save error:', error);
      Alert.alert(
        'Error',
        'Could not save your profile. Please try again.'
      );
    }
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
            <View style={styles.header}>
              <Text style={styles.logo}>SAI</Text>

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
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your name"
                placeholderTextColor="#666666"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
                accessibilityLabel="Name"
              />

              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your age"
                placeholderTextColor="#666666"
                keyboardType="number-pad"
                value={age}
                onChangeText={setAge}
                returnKeyType="next"
                accessibilityLabel="Age"
              />

              <Text style={styles.label}>Gender</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your gender"
                placeholderTextColor="#666666"
                value={gender}
                onChangeText={setGender}
                autoCapitalize="words"
                returnKeyType="next"
                accessibilityLabel="Gender"
              />

              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your weight in kg"
                placeholderTextColor="#666666"
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

            <Text style={styles.footer}>
              SAI - Sports Assessment and Improvement
            </Text>
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
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    fontSize: 34,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 3,
    marginBottom: 12,
  },
  title: {
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 10,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 7,
  },
  input: {
    width: '100%',
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#A0A0A0',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 18,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#000000',
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
  footer: {
    color: '#000000',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 28,
  },
});
