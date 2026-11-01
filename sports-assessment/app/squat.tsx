
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';

export default function SquatScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>‹  Back</Text>
        </Pressable>

        <Text style={styles.title}>Squat Assessment</Text>
        <Text style={styles.subtitle}>
          Position your phone so your full body is visible.
        </Text>

        <View style={styles.cameraContainer}>
          {!permission ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : !permission.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.permissionTitle}>
                Camera access needed
              </Text>
              <Text style={styles.permissionText}>
                Allow camera access to prepare for your squat test.
              </Text>

              <Pressable
                style={styles.primaryButton}
                onPress={requestPermission}
              >
                <Text style={styles.primaryButtonText}>
                  Allow Camera
                </Text>
              </Pressable>
            </View>
          ) : (
            <CameraView
              style={styles.camera}
              facing="back"
            />
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Before you begin</Text>
          <Text style={styles.infoText}>
            • Keep your full body in the camera frame.
          </Text>
          <Text style={styles.infoText}>
            • Place your phone on a stable surface.
          </Text>
          <Text style={styles.infoText}>
            • Wear comfortable clothing and use a safe space.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View
            style={[
              styles.statusDot,
              permission?.granted
                ? styles.statusReady
                : styles.statusWaiting,
            ]}
          />
          <Text style={styles.statusText}>
            {permission?.granted
              ? 'Camera ready — preview only'
              : 'Waiting for camera permission'}
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          This is a camera preview only. Squat repetition counting
          and AI pose analysis are not enabled yet.
        </Text>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>
            Return to Assessment
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F4F7FB',
  },
  container: {
    padding: 20,
    paddingBottom: 36,
    width: '100%',
    maxWidth: 650,
    alignSelf: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2457C5',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#17243A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
    marginBottom: 20,
  },
  cameraContainer: {
    width: '100%',
    height: 390,
    backgroundColor: '#17243A',
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  permissionBox: {
    alignItems: 'center',
    padding: 24,
    width: '100%',
  },
  cameraIcon: {
    fontSize: 42,
    marginBottom: 12,
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  permissionText: {
    color: '#D7E0EE',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#4F7DF3',
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    marginTop: 20,
    gap: 10,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#17243A',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#475569',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 15,
    borderRadius: 14,
    marginTop: 14,
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusReady: {
    backgroundColor: '#16A34A',
  },
  statusWaiting: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  disclaimer: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
    textAlign: 'center',
  },
  secondaryButton: {
    marginTop: 18,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '700',
  },
});
