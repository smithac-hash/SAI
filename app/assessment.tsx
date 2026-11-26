
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
const REQUIRED_VALID_FRAMES = 5;
const MIN_VISIBILITY = 0.4;
const POSTURE_GRACE_MS = 1500;

// Initial prototype thresholds; validate with real camera testing.
const MIN_KNEE_ANGLE = 75;
const MAX_KNEE_ANGLE = 115;
const MAX_TORSO_DEVIATION = 30;

export default function WallSitScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<TestPhase>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [kneeAngle, setKneeAngle] = useState<number | null>(null);
  const [torsoDeviation, setTorsoDeviation] = useState<number | null>(null);
  const [poseStatus, setPoseStatus] = useState('Waiting for camera...');
  const [cameraError, setCameraError] = useState('');

  const phaseRef = useRef<TestPhase>('ready');
  const validFramesRef = useRef(0);
  const holdStartTimeRef = useRef<number | null>(null);
  const invalidSinceRef = useRef<number | null>(null);
  const hasSavedRef = useRef(false);

  const kneeAngleRef = useRef<number | null>(null);
  const torsoDeviationRef = useRef<number | null>(null);

  const lastUiUpdateRef = useRef(0);

  const updateStatus = (message: string) => {
    setPoseStatus(message);
  };

  const calculateAngle = (
    a: Point,
    b: Point,
    c: Point
  ): number => {
    const abX = a.x - b.x;
    const abY = a.y - b.y;
    const cbX = c.x - b.x;
    const cbY = c.y - b.y;

    const dot = abX * cbX + abY * cbY;
    const magAB = Math.sqrt(abX * abX + abY * abY);
    const magCB = Math.sqrt(cbX * cbX + cbY * cbY);

    if (magAB === 0 || magCB === 0) return 0;

    const cosine = Math.max(-1, Math.min(1, dot / (magAB * magCB)));

    return Math.acos(cosine) * (180 / Math.PI);
  };

  const isVisible = (point?: Point) => {
    return (
      !!point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      (point.visibility ?? 1) >= MIN_VISIBILITY
    );
  };

  const resetDetection = () => {
    validFramesRef.current = 0;
    holdStartTimeRef.current = null;
    invalidSinceRef.current = null;
    hasSavedRef.current = false;

    kneeAngleRef.current = null;
    torsoDeviationRef.current = null;

    setKneeAngle(null);
    setTorsoDeviation(null);
  };

  const finishTest = async () => {
    if (
      phaseRef.current === 'completed' ||
      phaseRef.current === 'ready' ||
      hasSavedRef.current
    ) {
      return;
    }

    hasSavedRef.current = true;
    phaseRef.current = 'completed';
    setPhase('completed');

    const start = holdStartTimeRef.current;

    const duration =
      start === null
        ? 0
        : Math.max(0, Math.floor((Date.now() - start) / 1000));

    setElapsedSeconds(duration);
    updateStatus('Wall Sit completed.');

    try {
      await saveResult({
        test: 'Wall Sit',
        value: duration,
        unit: 'seconds',
        details: {
          holdDurationSeconds: duration,
          finalKneeAngle: kneeAngleRef.current ?? 'Not detected',
          finalTorsoDeviation: torsoDeviationRef.current ?? 'Not detected',
          measurement: 'Camera-based pose estimate',
          postureCheck: 'Knee bend and upright torso',
        },
      });
    } catch (error) {
      console.error('Unable to save Wall Sit result:', error);
      updateStatus('Result could not be saved. Please try again.');
    }
  };

  const handleInvalidPosture = (message: string, now: number) => {
    validFramesRef.current = 0;

    if (invalidSinceRef.current === null) {
      invalidSinceRef.current = now;
    }

    if (
      holdStartTimeRef.current !== null &&
      now - invalidSinceRef.current >= POSTURE_GRACE_MS
    ) {
      void finishTest();
      return;
    }

    updateStatus(message);
  };

  const handlePose = (frame: PoseFrame) => {
    if (
      phaseRef.current !== 'countdown' &&
      phaseRef.current !== 'running'
    ) {
      return;
    }

    const landmarks = frame.landmarks;

    if (!landmarks || landmarks.length < 29) {
      handleInvalidPosture('Move fully into camera view.', Date.now());
      return;
    }

    const leftShoulder = landmarks[11] as Point;
    const rightShoulder = landmarks[12] as Point;
    const leftHip = landmarks[23] as Point;
    const rightHip = landmarks[24] as Point;
    const leftKnee = landmarks[25] as Point;
    const rightKnee = landmarks[26] as Point;
    const leftAnkle = landmarks[27] as Point;
    const rightAnkle = landmarks[28] as Point;

    const leftVisible =
      isVisible(leftShoulder) &&
      isVisible(leftHip) &&
      isVisible(leftKnee) &&
      isVisible(leftAnkle);

    const rightVisible =
      isVisible(rightShoulder) &&
      isVisible(rightHip) &&
      isVisible(rightKnee) &&
      isVisible(rightAnkle);

    let shoulder: Point;
    let hip: Point;
    let knee: Point;
    let ankle: Point;

    if (leftVisible) {
      shoulder = leftShoulder;
      hip = leftHip;
      knee = leftKnee;
      ankle = leftAnkle;
    } else if (rightVisible) {
      shoulder = rightShoulder;
      hip = rightHip;
      knee = rightKnee;
      ankle = rightAnkle;
    } else {
      handleInvalidPosture(
        'Turn sideways and keep your full body visible.',
        Date.now()
      );
      return;
    }

    const now = Date.now();

    // Knee angle: hip-knee-ankle. A Wall Sit targets about 90 degrees.
    const measuredKneeAngle = calculateAngle(hip, knee, ankle);

    // Torso deviation from vertical. Smaller is more upright.
    const dx = shoulder.x - hip.x;
    const dy = shoulder.y - hip.y;

    const measuredTorsoDeviation =
      Math.atan2(Math.abs(dx), Math.abs(dy)) * (180 / Math.PI);

    kneeAngleRef.current = measuredKneeAngle;
    torsoDeviationRef.current = measuredTorsoDeviation;

    if (now - lastUiUpdateRef.current > 200) {
      lastUiUpdateRef.current = now;
      setKneeAngle(Math.round(measuredKneeAngle));
      setTorsoDeviation(Math.round(measuredTorsoDeviation));
    }

    const kneeValid =
      measuredKneeAngle >= MIN_KNEE_ANGLE &&
      measuredKneeAngle <= MAX_KNEE_ANGLE;

    const torsoValid =
      measuredTorsoDeviation <= MAX_TORSO_DEVIATION;

    if (!kneeValid) {
      handleInvalidPosture('Adjust your knees towards a 90° bend.', now);
      return;
    }

    if (!torsoValid) {
      handleInvalidPosture('Keep your upper body upright.', now);
      return;
    }

    invalidSinceRef.current = null;
    validFramesRef.current += 1;

    if (phaseRef.current === 'countdown') {
      updateStatus('Good position! Hold still for the countdown.');
      return;
    }

    if (
      phaseRef.current === 'running' &&
      holdStartTimeRef.current === null &&
      validFramesRef.current >= REQUIRED_VALID_FRAMES
    ) {
      holdStartTimeRef.current = now;
    }

    if (phaseRef.current === 'running') {
      updateStatus('Good posture! Keep holding.');
    }
  };

  const startTest = () => {
    resetDetection();
    setElapsedSeconds(0);
    setCountdown(COUNTDOWN_SECONDS);
    setCameraError('');

    phaseRef.current = 'countdown';
    setPhase('countdown');

    updateStatus('Get into your Wall Sit position.');
  };

  const resetTest = () => {
    resetDetection();
    setElapsedSeconds(0);
    setCountdown(COUNTDOWN_SECONDS);

    phaseRef.current = 'ready';
    setPhase('ready');

    updateStatus('Ready. Position yourself sideways to the camera.');
  };

  useEffect(() => {
    if (phase !== 'countdown') return;

    const interval = setInterval(() => {
      setCountdown(previous => {
        if (previous <= 1) {
          clearInterval(interval);
          phaseRef.current = 'running';
          setPhase('running');
          updateStatus('Hold your Wall Sit position!');
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
      const start = holdStartTimeRef.current;

      if (start !== null) {
        setElapsedSeconds(
          Math.floor((Date.now() - start) / 1000)
        );
      }
    }, 200);

    return () => clearInterval(interval);
  }, [phase]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(
      remaining
    ).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>Wall Sit Test</Text>
        <Text style={styles.subtitle}>
          Measure lower-body endurance by holding a seated position
          against a wall.
        </Text>

        <View style={styles.instructionCard}>
          <Text style={styles.sectionTitle}>How to perform</Text>
          <Text style={styles.instruction}>
            1. Stand with your back against a wall.
          </Text>
          <Text style={styles.instruction}>
            2. Slide down until your knees are approximately at 90°.
          </Text>
          <Text style={styles.instruction}>
            3. Keep your torso upright and feet flat.
          </Text>
          <Text style={styles.instruction}>
            4. Position the phone to capture your full body from the side.
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
              cameraFacing="back"
              frameLimit={30}
              callbackFps={20}
              onLandmark={handlePose}
              onInferenceError={error => {
                setCameraError(error.code);
                updateStatus('Pose detection error.');
              }}
              onCameraConfigured={() => {
                setCameraError('');
                updateStatus('Back camera ready. Position yourself sideways.');
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
          <Text style={styles.sectionTitle}>Posture status</Text>
          <Text style={styles.statusText}>{poseStatus}</Text>

          <View style={styles.measurementRow}>
            <View style={styles.measurement}>
              <Text style={styles.measurementLabel}>Knee angle</Text>
              <Text style={styles.measurementValue}>
                {kneeAngle === null ? '--' : `${kneeAngle}°`}
              </Text>
            </View>

            <View style={styles.measurement}>
              <Text style={styles.measurementLabel}>Torso deviation</Text>
              <Text style={styles.measurementValue}>
                {torsoDeviation === null ? '--' : `${torsoDeviation}°`}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>
            {phase === 'countdown'
              ? 'Starting in'
              : phase === 'completed'
              ? 'Final holding time'
              : 'Wall Sit time'}
          </Text>

          <Text style={styles.timer}>
            {phase === 'countdown'
              ? countdown
              : formatTime(elapsedSeconds)}
          </Text>

          <Text style={styles.timerUnit}>MINUTES : SECONDS</Text>
        </View>

        {phase === 'ready' && permission?.granted && (
          <Pressable style={styles.primaryButton} onPress={startTest}>
            <Text style={styles.buttonText}>Start Wall Sit</Text>
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
              <Text style={styles.resultValue}>
                {formatTime(elapsedSeconds)}
              </Text>
              <Text style={styles.statusText}>
                Your Wall Sit result is saved in seconds.
              </Text>
            </View>

            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push('/results')}
            >
              <Text style={styles.buttonText}>View Results</Text>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={resetTest}>
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
  measurementLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  measurementValue: {
    color: '#172554',
    fontWeight: '800',
    fontSize: 22,
    marginTop: 5,
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
