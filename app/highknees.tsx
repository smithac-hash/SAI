
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import { PoseCameraView } from 'expo-mediapipe-pose';
import { router } from 'expo-router';
import { saveResult } from '../lib/assessmentStore';

type TestPhase = 'ready' | 'countdown' | 'running' | 'completed';

type PoseFrame = Parameters<
  NonNullable<React.ComponentProps<typeof PoseCameraView>['onLandmark']>
>[0];

type Point = {
  x: number;
  y: number;
  visibility?: number;
};

const COUNTDOWN_SECONDS = 3;
const TEST_DURATION_SECONDS = 30;
const MIN_VISIBILITY = 0.4;

// Starting prototype thresholds. Validate with real camera testing.
const LIFT_THRESHOLD = 0.12;
const RESET_THRESHOLD = 0.02;

export default function HighKneesScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<TestPhase>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [remainingSeconds, setRemainingSeconds] =
    useState(TEST_DURATION_SECONDS);

  const [reps, setReps] = useState(0);
  const [leftLifted, setLeftLifted] = useState(false);
  const [rightLifted, setRightLifted] = useState(false);

  const [poseStatus, setPoseStatus] = useState(
    'Waiting for camera...'
  );
  const [cameraError, setCameraError] = useState('');

  const phaseRef = useRef<TestPhase>('ready');
  const repsRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  const leftArmedRef = useRef(true);
  const rightArmedRef = useRef(true);

  const leftLiftedRef = useRef(false);
  const rightLiftedRef = useRef(false);

  const lastUiUpdateRef = useRef(0);

  const updateStatus = (message: string) => {
    setPoseStatus(message);
  };

  const isVisible = (point?: Point) => {
    return (
      !!point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      (point.visibility ?? 1) >= MIN_VISIBILITY
    );
  };

  const resetTestData = () => {
    repsRef.current = 0;
    startTimeRef.current = null;
    finishedRef.current = false;

    leftArmedRef.current = true;
    rightArmedRef.current = true;

    leftLiftedRef.current = false;
    rightLiftedRef.current = false;

    lastUiUpdateRef.current = 0;

    setReps(0);
    setLeftLifted(false);
    setRightLifted(false);
  };

  const finishTest = async () => {
    if (
      phaseRef.current !== 'running' &&
      phaseRef.current !== 'countdown'
    ) {
      return;
    }

    if (finishedRef.current) return;

    finishedRef.current = true;
    phaseRef.current = 'completed';
    setPhase('completed');

    const duration = startTimeRef.current
      ? Math.min(
          TEST_DURATION_SECONDS,
          Math.max(
            0,
            Math.floor((Date.now() - startTimeRef.current) / 1000)
          )
        )
      : 0;

    setRemainingSeconds(
      Math.max(0, TEST_DURATION_SECONDS - duration)
    );

    updateStatus('High Knees test completed.');

    try {
      await saveResult({
        test: 'High Knees',
        value: repsRef.current,
        unit: 'reps',
        details: {
          durationSeconds: duration,
          totalRepetitions: repsRef.current,
          countingMethod: 'Each correctly detected knee lift counts once',
          measurement: 'Camera-based pose estimate',
        },
      });
    } catch (error) {
      console.error('Unable to save High Knees result:', error);
      updateStatus('Result could not be saved. Please try again.');
    }
  };

  const handlePose = (frame: PoseFrame) => {
    if (phaseRef.current !== 'countdown' &&
        phaseRef.current !== 'running') {
      return;
    }

    const landmarks = frame.landmarks;

    if (!landmarks || landmarks.length < 29) {
      updateStatus('Move fully into camera view.');
      return;
    }

    const leftShoulder = landmarks[11] as Point;
    const rightShoulder = landmarks[12] as Point;
    const leftHip = landmarks[23] as Point;
    const rightHip = landmarks[24] as Point;
    const leftKnee = landmarks[25] as Point;
    const rightKnee = landmarks[26] as Point;

    if (
      !isVisible(leftShoulder) ||
      !isVisible(rightShoulder) ||
      !isVisible(leftHip) ||
      !isVisible(rightHip) ||
      !isVisible(leftKnee) ||
      !isVisible(rightKnee)
    ) {
      updateStatus('Keep your upper body and both knees visible.');
      return;
    }

    const shoulderY =
      (leftShoulder.y + rightShoulder.y) / 2;

    const hipY = (leftHip.y + rightHip.y) / 2;

    const torsoLength = Math.abs(hipY - shoulderY);

    if (torsoLength < 0.05) {
      updateStatus('Move farther from the camera.');
      return;
    }

    // Smaller y values mean the knee is higher in the camera image.
    const leftLift =
      (leftHip.y - leftKnee.y) / torsoLength;

    const rightLift =
      (rightHip.y - rightKnee.y) / torsoLength;

    if (phaseRef.current === 'countdown') {
      updateStatus('Get ready! Start lifting your knees when the timer ends.');
      return;
    }

    let newReps = repsRef.current;
    let leftIsLifted = leftLiftedRef.current;
    let rightIsLifted = rightLiftedRef.current;

    // Count the left knee once per complete lift.
    if (leftLift >= LIFT_THRESHOLD && leftArmedRef.current) {
      leftArmedRef.current = false;
      leftIsLifted = true;
      newReps += 1;
    } else if (leftLift <= RESET_THRESHOLD) {
      leftArmedRef.current = true;
      leftIsLifted = false;
    }

    // Count the right knee once per complete lift.
    if (rightLift >= LIFT_THRESHOLD && rightArmedRef.current) {
      rightArmedRef.current = false;
      rightIsLifted = true;
      newReps += 1;
    } else if (rightLift <= RESET_THRESHOLD) {
      rightArmedRef.current = true;
      rightIsLifted = false;
    }

    if (newReps !== repsRef.current) {
      repsRef.current = newReps;
      setReps(newReps);
    }

    leftLiftedRef.current = leftIsLifted;
    rightLiftedRef.current = rightIsLifted;

    const now = Date.now();

    if (now - lastUiUpdateRef.current > 150) {
      lastUiUpdateRef.current = now;
      setLeftLifted(leftIsLifted);
      setRightLifted(rightIsLifted);
      updateStatus('Good! Keep lifting your knees quickly.');
    }
  };

  const startTest = () => {
    resetTestData();

    setCountdown(COUNTDOWN_SECONDS);
    setRemainingSeconds(TEST_DURATION_SECONDS);
    setCameraError('');

    phaseRef.current = 'countdown';
    setPhase('countdown');

    updateStatus('Get ready for High Knees!');
  };

  const resetTest = () => {
    resetTestData();

    setCountdown(COUNTDOWN_SECONDS);
    setRemainingSeconds(TEST_DURATION_SECONDS);

    phaseRef.current = 'ready';
    setPhase('ready');

    updateStatus('Ready. Position yourself in front of the camera.');
  };

  useEffect(() => {
    if (phase !== 'countdown') return;

    const interval = setInterval(() => {
      setCountdown(previous => {
        if (previous <= 1) {
          clearInterval(interval);

          phaseRef.current = 'running';
          startTimeRef.current = Date.now();

          setPhase('running');
          updateStatus('Go! Lift your knees as fast as possible.');

          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'running') return;

    const interval = setInterval(() => {
      if (startTimeRef.current === null) return;

      const elapsed = Math.floor(
        (Date.now() - startTimeRef.current) / 1000
      );

      const remaining = Math.max(
        0,
        TEST_DURATION_SECONDS - elapsed
      );

      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        void finishTest();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [phase]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>High Knees Test</Text>

        <Text style={styles.subtitle}>
          Complete as many correctly detected knee lifts as possible
          in 30 seconds.
        </Text>

        <View style={styles.instructionCard}>
          <Text style={styles.sectionTitle}>How to perform</Text>

          <Text style={styles.instruction}>
            1. Stand facing the camera with your full body visible.
          </Text>

          <Text style={styles.instruction}>
            2. Keep your upper body upright.
          </Text>

          <Text style={styles.instruction}>
            3. Lift one knee towards your waist, then lower it.
          </Text>

          <Text style={styles.instruction}>
            4. Repeat with the other knee as quickly as possible.
          </Text>

          <Text style={styles.instruction}>
            5. Every correctly detected knee lift counts as one rep.
          </Text>
        </View>

        {!permission ? (
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.statusText}>
              Checking camera permission...
            </Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.cameraPlaceholder}>
            <Text style={styles.statusText}>
              Camera permission is required for pose detection.
            </Text>

            <Pressable
              style={styles.primaryButton}
              onPress={requestPermission}
            >
              <Text style={styles.buttonText}>Allow Camera</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <PoseCameraView
              style={styles.camera}
              isActive={phase !== 'completed'}
              cameraFacing="front"
              frameLimit={30}
              callbackFps={20}
              onLandmark={handlePose}
              onInferenceError={error => {
                setCameraError(error.code);
                updateStatus('Pose detection error.');
              }}
              onCameraConfigured={() => {
                setCameraError('');
                updateStatus('Camera ready. Stand facing the camera.');
              }}
            />
          </View>
        )}

        {!!cameraError && (
          <Text style={styles.errorText}>
            Camera error: {cameraError}
          </Text>
        )}

        <View style={styles.statusCard}>
          <Text style={styles.sectionTitle}>Pose status</Text>
          <Text style={styles.statusText}>{poseStatus}</Text>

          <View style={styles.measurementRow}>
            <View style={[
              styles.measurement,
              leftLifted && styles.activeMeasurement,
            ]}>
              <Text style={styles.measurementLabel}>Left knee</Text>
              <Text style={styles.measurementValue}>
                {leftLifted ? 'Lifted' : 'Ready'}
              </Text>
            </View>

            <View style={[
              styles.measurement,
              rightLifted && styles.activeMeasurement,
            ]}>
              <Text style={styles.measurementLabel}>Right knee</Text>
              <Text style={styles.measurementValue}>
                {rightLifted ? 'Lifted' : 'Ready'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.counterCard}>
          <Text style={styles.counterLabel}>TOTAL REPETITIONS</Text>
          <Text style={styles.counter}>{reps}</Text>
        </View>

        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>
            {phase === 'countdown'
              ? 'Starting in'
              : phase === 'completed'
              ? 'Time remaining'
              : 'Time remaining'}
          </Text>

          <Text style={styles.timer}>
            {phase === 'countdown'
              ? countdown
              : remainingSeconds}
          </Text>

          <Text style={styles.timerUnit}>SECONDS</Text>
        </View>

        {phase === 'ready' && permission?.granted && (
          <Pressable
            style={styles.primaryButton}
            onPress={startTest}
          >
            <Text style={styles.buttonText}>Start High Knees</Text>
          </Pressable>
        )}

        {(phase === 'countdown' || phase === 'running') && (
          <Pressable
            style={styles.stopButton}
            onPress={() => void finishTest()}
          >
            <Text style={styles.buttonText}>Finish Test</Text>
          </Pressable>
        )}

        {phase === 'completed' && (
          <>
            <View style={styles.resultCard}>
              <Text style={styles.sectionTitle}>Test Completed!</Text>

              <Text style={styles.resultValue}>{reps} reps</Text>

              <Text style={styles.statusText}>
                Your High Knees result has been saved.
              </Text>
            </View>

            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/results')}
            >
              <Text style={styles.buttonText}>View Results</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={resetTest}
            >
              <Text style={styles.secondaryButtonText}>Try Again</Text>
            </Pressable>
          </>
        )}
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
    paddingBottom: 40,
    maxWidth: 650,
    width: '100%',
    alignSelf: 'center',
  },
  backText: {
    color: '#2563EB',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#172554',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 15,
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 22,
  },
  instructionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#172554',
    marginBottom: 10,
  },
  instruction: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 23,
  },
  cameraContainer: {
    height: 300,
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#0F172A',
    marginBottom: 16,
  },
  camera: {
    flex: 1,
  },
  cameraPlaceholder: {
    height: 180,
    backgroundColor: '#E2E8F0',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  statusText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
  },
  measurementRow: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 12,
  },
  measurement: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 12,
  },
  activeMeasurement: {
    backgroundColor: '#DCFCE7',
  },
  measurementLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  measurementValue: {
    color: '#172554',
    fontWeight: '800',
    fontSize: 18,
    marginTop: 5,
  },
  counterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  counterLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  counter: {
    color: '#2563EB',
    fontSize: 54,
    fontWeight: '900',
    marginTop: 5,
    fontVariant: ['tabular-nums'],
  },
  timerCard: {
    backgroundColor: '#172554',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    marginBottom: 18,
  },
  timerLabel: {
    color: '#CBD5E1',
    fontSize: 15,
  },
  timer: {
    color: '#FFFFFF',
    fontSize: 46,
    fontWeight: '800',
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  timerUnit: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 5,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  stopButton: {
    backgroundColor: '#DC2626',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#E2E8F0',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#172554',
    fontSize: 16,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  resultValue: {
    color: '#2563EB',
    fontSize: 38,
    fontWeight: '800',
    marginVertical: 8,
  },
  errorText: {
    color: '#DC2626',
    marginBottom: 12,
  },
});
