
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { apiRequest } from '../../lib/api';

type CoachProfile = {
  name: string;
  email: string;
  organization?: string;
  specialization?: string;
  bio?: string;
};

export default function CoachProfileScreen() {
  const [profile, setProfile] = useState<CoachProfile>({
    name: '',
    email: '',
    organization: '',
    specialization: '',
    bio: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const response = await apiRequest<{ coach: CoachProfile }>(
        '/api/coaches/profile'
      );

      setProfile({
        name: response.coach.name || '',
        email: response.coach.email || '',
        organization: response.coach.organization || '',
        specialization: response.coach.specialization || '',
        bio: response.coach.bio || '',
      });
    } catch (error) {
      Alert.alert(
        'Unable to load profile',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof CoachProfile, value: string) => {
    setProfile((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const saveProfile = async () => {
    if (!profile.name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }

    setSaving(true);

    try {
      const response = await apiRequest<{ coach: CoachProfile }>(
        '/api/coaches/profile',
        {
          method: 'PATCH',
          body: {
            name: profile.name.trim(),
            organization: profile.organization?.trim() || '',
            specialization: profile.specialization?.trim() || '',
            bio: profile.bio?.trim() || '',
          },
        }
      );

      setProfile({
        ...profile,
        ...response.coach,
      });

      Alert.alert(
        'Profile updated',
        'Your coach profile has been saved successfully.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Update failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14213D" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>← Back to Dashboard</Text>
          </Pressable>

          <Text style={styles.kicker}>COACH PORTAL</Text>
          <Text style={styles.title}>My Profile</Text>
          <Text style={styles.subtitle}>
            Manage your professional information.
          </Text>

          <View style={styles.form}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={profile.name}
              onChangeText={(value) => updateField('name', value)}
              placeholder="Enter your name"
              maxLength={80}
            />

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={profile.email}
              editable={false}
            />
            <Text style={styles.hint}>
              Email address cannot be changed here.
            </Text>

            <Text style={styles.label}>Organization</Text>
            <TextInput
              style={styles.input}
              value={profile.organization || ''}
              onChangeText={(value) =>
                updateField('organization', value)
              }
              placeholder="Enter organization or academy"
              maxLength={120}
            />

            <Text style={styles.label}>Specialization</Text>
            <TextInput
              style={styles.input}
              value={profile.specialization || ''}
              onChangeText={(value) =>
                updateField('specialization', value)
              }
              placeholder="e.g. Athletics, Strength and Conditioning"
              maxLength={120}
            />

            <Text style={styles.label}>Professional Bio</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={profile.bio || ''}
              onChangeText={(value) => updateField('bio', value)}
              placeholder="Tell athletes about your coaching experience..."
              multiline
              textAlignVertical="top"
              maxLength={500}
            />

            <Text style={styles.counter}>
              {(profile.bio || '').length}/500 characters
            </Text>

            <Pressable
              style={[
                styles.saveButton,
                saving && { opacity: 0.6 },
              ]}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>Save Changes</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 22,
    paddingBottom: 40,
  },
  back: {
    color: '#475569',
    fontWeight: '700',
    marginBottom: 28,
    fontSize: 14,
  },
  kicker: {
    color: '#64748B',
    fontWeight: '800',
    letterSpacing: 2,
    fontSize: 11,
  },
  title: {
    color: '#14213D',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 8,
  },
  subtitle: {
    color: '#64748B',
    marginTop: 6,
    marginBottom: 24,
  },
  form: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: {
    color: '#14213D',
    fontWeight: '800',
    fontSize: 13,
    marginTop: 15,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: '#14213D',
    fontSize: 14,
  },
  disabledInput: {
    color: '#64748B',
    backgroundColor: '#E2E8F0',
  },
  hint: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 5,
  },
  bioInput: {
    minHeight: 110,
  },
  counter: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 5,
  },
  saveButton: {
    backgroundColor: '#14213D',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 25,
  },
  saveText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },
});
