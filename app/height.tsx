import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import { PoseCameraView } from 'expo-mediapipe-pose';
import { router } from 'expo-router';
import { saveResult } from '../lib/assessmentStore';

type PoseFrame = Parameters<
  NonNullable<React.ComponentProps<typeof PoseCameraView>['onLandmark']>
>[0];

type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
};

const MIN_SAMPLES = 12;
const TARGET_SAMPLES = 30;
const MIN_CONFIDENCE = 0.55;
const ESTIMATED_CROWN_OFFSET_METRES = 0.12;

export default function HeightScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [poseStatus, setPoseStatus] = useState('Waiting for camera...');
  const [cameraError, setCameraError] = useState('');
  const [sampleCount, setSampleCount] = useState(0);
  const [estimatedHeight, setEstimatedHeight] = useState<number | null>(null);

  const scanningRef = useRef(false);
  const samplesRef = useRef<number[]>([]);

  const finishScan = () => {
    scanningRef.current = false;
    setScanning(false);

    const samples = [...samplesRef.current].sort((a, b) => a - b);

    if (samples.length < MIN_SAMPLES) {
      setPoseStatus(
        'Not enough clear measurements. Move farther back and keep your full body visible.'
      );
      return;
    }

    const middle = Math.floor(samples.length / 2);
    const median =
      samples.length % 2 === 0
        ? (samples[middle - 1] + samples[middle]) / 2
        : samples[middle];

    const centimetres = Math.round(median * 1000) / 10;

    if (
      !Number.isFinite(centimetres) ||
      centimetres < 50 ||
      centimetres > 250
    ) {
      setPoseStatus(
        'The estimate was outside the expected range. Please scan again.'
      );
      return;
    }

    setEstimatedHeight(centimetres);
    setPoseStatus('Scan complete — review your estimated height below.');
  };

  useEffect(() => {
    if (!scanning) return;

    const timeout = setTimeout(() => {
      if (scanningRef.current) finishScan();
    }, 10000);

    return () => clearTimeout(timeout);
  }, [scanning]);

  const handlePose = (frame: PoseFrame) => {
    const landmarks = frame.worldLandmarks as unknown as
      | Landmark[]
      | undefined;

    if (!landmarks || landmarks.length < 33) {
      setPoseStatus('Looking for your full body...');
      return;
    }

    const required = [
      landmarks[0],
      landmarks[7],
      landmarks[8],
      landmarks[29],
      landmarks[30],
      landmarks[31],
      landmarks[32],
    ];

    const visible = required.every((point) => {
      const confidence = point?.visibility ?? point?.presence ?? 1;

      return (
        point &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        confidence >= MIN_CONFIDENCE
      );
    });

    if (!visible) {
      setPoseStatus(
        'Keep your head and both feet fully visible in the camera.'
      );
      return;
    }

    setPoseStatus(
      scanningRef.current
        ? 'Measuring — stay still and stand straight.'
        : 'Body detected — ready to scan.'
    );

    if (!scanningRef.current) return;

    const nose = landmarks[0];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];

    const feet = [
      landmarks[29],
      landmarks[30],
      landmarks[31],
      landmarks[32],
    ];

    const headY = (nose.y + leftEar.y + rightEar.y) / 3;

const footY =
  feet.reduce((total, point) => total + point.y, 0) /
  feet.length;

// Absolute difference works regardless of the coordinate direction.
const heightMetres =
  Math.abs(headY - footY) + ESTIMATED_CROWN_OFFSET_METRES;
    if (
      !Number.isFinite(heightMetres) ||
      heightMetres < 0.5 ||
      heightMetres > 2.5
    ) {
      return;
    }

    samplesRef.current.push(heightMetres);
    setSampleCount(samplesRef.current.length);

    if (samplesRef.current.length >= TARGET_SAMPLES) {
      finishScan();
    }
  };

  const startScan = () => {
    samplesRef.current = [];
    setSampleCount(0);
    setEstimatedHeight(null);
    setCameraError('');
    scanningRef.current = true;
    setScanning(true);
    setPoseStatus('Measuring — stand straight and keep still.');
  };

  const handleSave = async () => {
    if (estimatedHeight === null) return;

    setSaving(true);

    try {
      await saveResult({
        test: 'Height',
        value: estimatedHeight,
        unit: 'cm',
        details: {
          measurementMethod: 'Camera-based MediaPipe pose estimate',
          measurementType: 'Estimated standing body height',
          isEstimated: 'true',
          calibration: 'Uncalibrated AI estimate',
          sampleCount: samplesRef.current.length,
        },
      });

      Alert.alert(
        'Height Saved',
        `Your estimated height is ${estimatedHeight.toFixed(1)} cm.`,
        [
          {
            text: 'View Results',
            onPress: () => router.replace('/results'),
          },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Saving Failed',
        'Unable to save your height. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.icon}>📏</Text>
          <Text style={styles.title}>Camera Height Assessment</Text>
          <Text style={styles.subtitle}>
            Stand upright while the camera detects your body landmarks.
          </Text>
        </View>

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
                Allow camera access to scan your standing height.
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
            <PoseCameraView
              style={styles.camera}
              isActive
              cameraFacing="back"
              frameLimit={15}
              callbackFps={10}
              skeleton={{
                color: '#22C55E',
                jointRadius: 5,
                lineWidth: 3,
                minVisibility: 0.6,
                bodyParts: ['torso', 'leftLeg', 'rightLeg'],
              }}
              onLandmark={handlePose}
              onInferenceError={(error) => {
                setCameraError(error.code);
                setPoseStatus('Pose detection error');
              }}
              onCameraConfigured={() => {
                setCameraError('');
                setPoseStatus(
                  'Camera ready — stand where your full body is visible.'
                );
              }}
            />
          )}
        </View>

        {permission?.granted && (
          <>
            <View style={styles.statusCard}>
              <View
                style={[
                  styles.statusDot,
                  cameraError
                    ? styles.statusWaiting
                    : styles.statusReady,
                ]}
              />

              <Text style={styles.statusText}>
                {cameraError
                  ? `${poseStatus}: ${cameraError}`
                  : poseStatus}
              </Text>
            </View>

            {scanning && (
              <View style={styles.sampleCard}>
                <ActivityIndicator color="#14213D" />
                <Text style={styles.sampleText}>
                  Captured frames: {sampleCount}/{TARGET_SAMPLES}
                </Text>
              </View>
            )}

            {!scanning && (
              <Pressable
                style={styles.primaryButton}
                onPress={startScan}
              >
                <Text style={styles.primaryButtonText}>
                  {estimatedHeight === null
                    ? 'Start Height Scan'
                    : 'Scan Again'}
                </Text>
              </Pressable>
            )}

            {scanning && (
              <Pressable
                style={styles.stopButton}
                onPress={finishScan}
              >
                <Text style={styles.stopButtonText}>
                  Finish Scan
                </Text>
              </Pressable>
            )}

            {estimatedHeight !== null && !scanning && (
              <View style={styles.resultCard}>
                <Text style={styles.resultLabel}>
                  Estimated Standing Height
                </Text>

                <Text style={styles.resultValue}>
                  {estimatedHeight.toFixed(1)} cm
                </Text>

                <Text style={styles.note}>
                  This is an uncalibrated AI estimate, not a verified
                  physical measurement. Camera angle, distance, posture
                  and landmark detection can affect the result.
                </Text>

                <Pressable
                  style={[
                    styles.primaryButton,
                    saving && styles.disabledButton,
                  ]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.primaryButtonText}>
                    {saving ? 'Saving...' : 'Confirm & Save Height'}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Before you begin</Text>
          <Text style={styles.infoText}>
            • Place your phone on a stable surface.
          </Text>
          <Text style={styles.infoText}>
            • Stand several steps away from the camera.
          </Text>
          <Text style={styles.infoText}>
            • Keep your head and both feet inside the frame.
          </Text>
          <Text style={styles.infoText}>
            • Stand straight, face forward and avoid moving during the scan.
          </Text>
          <Text style={styles.infoText}>
            • Use good lighting and avoid loose or obstructive clothing.
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          Height is estimated from MediaPipe 3D pose landmarks. The model's
          world landmarks are expressed in metres, but this camera-only
          estimate is not calibrated and should not be used for medical or
          official measurements.
        </Text>
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
    color: '#14213D',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 42,
    marginBottom: 10,
  },
  title: {
    fontSize: 27,
    fontWeight: '800',
    color: '#14213D',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
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
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#14213D',
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stopButton: {
    backgroundColor: '#B91C1C',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
    color: '#14213D',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  sampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginTop: 14,
  },
  sampleText: {
    color: '#14213D',
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#DCE3EC',
  },
  resultLabel: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '700',
  },
  resultValue: {
    color: '#14213D',
    fontSize: 38,
    fontWeight: '900',
    marginTop: 8,
  },
  note: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.6,
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
    color: '#14213D',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#334155',
  },
  disclaimer: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 16,
    textAlign: 'center',
  },
});