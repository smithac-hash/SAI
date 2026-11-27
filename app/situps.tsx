
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import {
  PoseCameraView,
  getWorldJointAngle,
} from 'expo-mediapipe-pose';
import { router } from 'expo-router';
import { saveResult } from '../lib/assessmentStore';

type TestPhase = 'ready' | 'countdown' | 'running' | 'completed';

type PoseFrame = Parameters<
  NonNullable<React.ComponentProps<typeof PoseCameraView>['onLandmark']>
>[0];

const TEST_DURATION = 30;

// Adaptive thresholds are based on the angle range observed during the test.
// This avoids requiring a fixed 150-degree lying position.
const MIN_MOVEMENT_RANGE = 30;
const SITTING_THRESHOLD_FRACTION = 0.38;
const LYING_THRESHOLD_FRACTION = 0.68;
const ANGLE_SMOOTHING_WINDOW = 5;
const REQUIRED_STABLE_FRAMES = 2;
const REP_COOLDOWN_MS = 900;

export default function SitupsScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [reps, setReps] = useState(0);
  const [hipAngle, setHipAngle] = useState<number | null>(null);
  const [minHipAngle, setMinHipAngle] = useState<number | null>(null);
  const [maxHipAngle, setMaxHipAngle] = useState<number | null>(null);

  const [poseStatus, setPoseStatus] = useState('Waiting for pose...');
  const [cameraError, setCameraError] = useState('');

  const [phase, setPhase] = useState<TestPhase>('ready');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [averageAngle, setAverageAngle] = useState<number | null>(null);

  const repsRef = useRef(0);
  const phaseRef = useRef<TestPhase>('ready');
  const countdownRef = useRef(3);
  const startTimeRef = useRef<number | null>(null);

  const hasReachedSittingRef = useRef(false);
  const angleSamplesRef = useRef<number[]>([]);
  const sittingFramesRef = useRef(0);
  const lyingFramesRef = useRef(0);
  const lastRepAtRef = useRef(0);

  const angleSumRef = useRef(0);
  const angleCountRef = useRef(0);

  const minHipAngleRef = useRef<number | null>(null);
  const maxHipAngleRef = useRef<number | null>(null);

  const handlePose = (frame: PoseFrame) => {
    if (phaseRef.current !== 'running') return;

    const leftAngle = getWorldJointAngle(
      { worldLandmarks: frame.worldLandmarks },
      'leftShoulder',
      'leftHip',
      'leftKnee'
    );

    const rightAngle = getWorldJointAngle(
      { worldLandmarks: frame.worldLandmarks },
      'rightShoulder',
      'rightHip',
      'rightKnee'
    );

    // Average both sides when available; otherwise use the visible side.
    const availableAngles = [
      leftAngle.status === 'available' ? leftAngle.value : null,
      rightAngle.status === 'available' ? rightAngle.value : null,
    ].filter((value): value is number => value !== null && Number.isFinite(value));

    if (availableAngles.length === 0) {
      setPoseStatus('Move into a clear side-view position with shoulders, hips and knees visible.');
      setHipAngle(null);
      return;
    }

    const rawAngle =
      availableAngles.reduce((sum, value) => sum + value, 0) /
      availableAngles.length;

    // Smooth short-lived landmark jumps before updating the counter.
    const samples = angleSamplesRef.current;
    samples.push(rawAngle);
    if (samples.length > ANGLE_SMOOTHING_WINDOW) samples.shift();

    const angle =
      samples.reduce((sum, value) => sum + value, 0) / samples.length;

    setHipAngle(Math.round(angle));

    // Track the observed movement range using smoothed angles.
    minHipAngleRef.current =
      minHipAngleRef.current === null
        ? angle
        : Math.min(minHipAngleRef.current, angle);

    maxHipAngleRef.current =
      maxHipAngleRef.current === null
        ? angle
        : Math.max(maxHipAngleRef.current, angle);

    setMinHipAngle(Math.round(minHipAngleRef.current));
    setMaxHipAngle(Math.round(maxHipAngleRef.current));

    angleSumRef.current += angle;
    angleCountRef.current += 1;

    const observedRange =
      maxHipAngleRef.current - minHipAngleRef.current;

    if (observedRange < MIN_MOVEMENT_RANGE) {
      setPoseStatus('Pose detected — move fully between lying and sitting positions.');
      sittingFramesRef.current = 0;
      lyingFramesRef.current = 0;
      return;
    }

    // Derive thresholds from the detected range. This can accommodate
    // smaller apparent angle ranges in screen-recorded/video demonstrations.
    const sittingThreshold =
      minHipAngleRef.current +
      observedRange * SITTING_THRESHOLD_FRACTION;

    const lyingThreshold =
      minHipAngleRef.current +
      observedRange * LYING_THRESHOLD_FRACTION;

    if (angle <= sittingThreshold) {
      sittingFramesRef.current += 1;
      lyingFramesRef.current = 0;

      if (sittingFramesRef.current >= REQUIRED_STABLE_FRAMES) {
        hasReachedSittingRef.current = true;
        setPoseStatus('Raised position detected — return to the lying position.');
      }
      return;
    }

    sittingFramesRef.current = 0;

    if (angle >= lyingThreshold && hasReachedSittingRef.current) {
      lyingFramesRef.current += 1;

      if (lyingFramesRef.current >= REQUIRED_STABLE_FRAMES) {
        const now = Date.now();

        if (now - lastRepAtRef.current >= REP_COOLDOWN_MS) {
          repsRef.current += 1;
          setReps(repsRef.current);
          lastRepAtRef.current = now;
          setPoseStatus('Sit-up counted — continue with a controlled movement.');
        }

        hasReachedSittingRef.current = false;
        lyingFramesRef.current = 0;
      }
      return;
    }

    lyingFramesRef.current = 0;
    setPoseStatus('Pose detected — complete the full sit-up movement.');
  };

  const startTest = () => {
    repsRef.current = 0;
    hasReachedSittingRef.current = false;
    angleSamplesRef.current = [];
    sittingFramesRef.current = 0;
    lyingFramesRef.current = 0;
    lastRepAtRef.current = 0;

    angleSumRef.current = 0;
    angleCountRef.current = 0;

    minHipAngleRef.current = null;
    maxHipAngleRef.current = null;

    startTimeRef.current = null;
    countdownRef.current = 3;

    setReps(0);
    setHipAngle(null);
    setMinHipAngle(null);
    setMaxHipAngle(null);

    setCountdown(3);
    setTimeLeft(TEST_DURATION);
    setElapsedSeconds(0);
    setAverageAngle(null);

    setCameraError('');
    setPoseStatus('Get ready — lie down sideways.');

    phaseRef.current = 'countdown';
    setPhase('countdown');
  };

  const finishTest = () => {
    if (phaseRef.current === 'completed') return;

    const elapsed = startTimeRef.current
      ? Math.min(
          TEST_DURATION,
          Math.max(
            0,
            Math.round((Date.now() - startTimeRef.current) / 1000)
          )
        )
      : 0;

    phaseRef.current = 'completed';
    setPhase('completed');

    setElapsedSeconds(elapsed);
    setTimeLeft(Math.max(0, TEST_DURATION - elapsed));

    setPoseStatus('Test completed.');

    const completedAverageAngle =
      angleCountRef.current > 0
        ? Math.round(angleSumRef.current / angleCountRef.current)
        : null;

    const completedMinAngle =
      minHipAngleRef.current !== null
        ? Math.round(minHipAngleRef.current)
        : null;

    const completedMaxAngle =
      maxHipAngleRef.current !== null
        ? Math.round(maxHipAngleRef.current)
        : null;

    setAverageAngle(completedAverageAngle);

    // Save all assessment measurements.
    void saveResult({
      test: 'Sit-ups',
      value: repsRef.current,
      unit: 'reps',
      details: {
        durationSeconds: elapsed,
        repsPerMinute:
          elapsed > 0
            ? Math.round((repsRef.current / elapsed) * 60)
            : 0,
        averageHipAngle: completedAverageAngle ?? 'Unavailable',
        minimumHipAngle: completedMinAngle ?? 'Unavailable',
        maximumHipAngle: completedMaxAngle ?? 'Unavailable',
        measurementMethod: 'Camera-based MediaPipe pose estimate',
      },
    }).catch(error => {
      console.error('Could not save sit-up results:', error);
    });
  };

  const resetTest = () => {
    phaseRef.current = 'ready';

    repsRef.current = 0;
    hasReachedSittingRef.current = false;
    angleSamplesRef.current = [];
    sittingFramesRef.current = 0;
    lyingFramesRef.current = 0;
    lastRepAtRef.current = 0;

    angleSumRef.current = 0;
    angleCountRef.current = 0;

    minHipAngleRef.current = null;
    maxHipAngleRef.current = null;

    startTimeRef.current = null;
    countdownRef.current = 3;

    setPhase('ready');

    setReps(0);
    setHipAngle(null);
    setMinHipAngle(null);
    setMaxHipAngle(null);

    setCountdown(3);
    setTimeLeft(TEST_DURATION);
    setElapsedSeconds(0);
    setAverageAngle(null);

    setCameraError('');
    setPoseStatus('Waiting for pose...');
  };

  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'running') {
      return;
    }

    const timer = setInterval(() => {
      if (phaseRef.current === 'countdown') {
        countdownRef.current -= 1;
        setCountdown(countdownRef.current);

        if (countdownRef.current <= 0) {
          phaseRef.current = 'running';
          startTimeRef.current = Date.now();

          setPhase('running');
          setPoseStatus('Test in progress — perform sit-ups.');
        }
      } else if (phaseRef.current === 'running') {
        const elapsed = startTimeRef.current
          ? Math.floor((Date.now() - startTimeRef.current) / 1000)
          : 0;

        const remaining = Math.max(0, TEST_DURATION - elapsed);

        setTimeLeft(remaining);

        if (remaining <= 0) {
          finishTest();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  const repsPerMinute =
    elapsedSeconds > 0
      ? Math.round((reps / elapsedSeconds) * 60)
      : 0;

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
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>Sit-ups Assessment</Text>

        <Text style={styles.subtitle}>
          Complete as many controlled sit-ups as possible in 30 seconds.
          Position your phone to capture your body from the side.
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
                Allow camera access to start your sit-up assessment.
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
              isActive={phase !== 'completed'}
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
              onInferenceError={error => {
                setCameraError(error.code);
                setPoseStatus('Pose detection error');
              }}
              onCameraConfigured={() => {
                setCameraError('');
                setPoseStatus(
                  'Camera ready — position yourself sideways.'
                );
              }}
            />
          )}
        </View>

        {permission?.granted && (
          <>
            <View style={styles.timerCard}>
              <Text style={styles.timerLabel}>
                {phase === 'countdown'
                  ? 'GET READY'
                  : phase === 'running'
                    ? 'TIME REMAINING'
                    : phase === 'completed'
                      ? 'TIME FINISHED'
                      : 'TEST DURATION'}
              </Text>

              <Text style={styles.timerValue}>
                {phase === 'countdown'
                  ? countdown
                  : phase === 'ready'
                    ? TEST_DURATION
                    : timeLeft}
                {phase !== 'countdown' ? 's' : ''}
              </Text>

              {phase === 'countdown' && (
                <Text style={styles.timerHint}>
                  Starting soon...
                </Text>
              )}
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>SIT-UP REPS</Text>
                <Text style={styles.statValue}>{reps}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>HIP ANGLE</Text>
                <Text style={styles.statValue}>
                  {hipAngle !== null ? `${hipAngle}°` : '--'}
                </Text>
              </View>
            </View>

            <View style={styles.angleCard}>
              <Text style={styles.angleTitle}>
                Hip Angle Tracking
              </Text>

              <View style={styles.angleRow}>
                <Text style={styles.angleLabel}>Minimum angle</Text>
                <Text style={styles.angleValue}>
                  {minHipAngle !== null ? `${minHipAngle}°` : '--'}
                </Text>
              </View>

              <View style={styles.angleRow}>
                <Text style={styles.angleLabel}>Maximum angle</Text>
                <Text style={styles.angleValue}>
                  {maxHipAngle !== null ? `${maxHipAngle}°` : '--'}
                </Text>
              </View>
            </View>

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

            {phase === 'ready' && (
              <Pressable
                style={styles.primaryButton}
                onPress={startTest}
              >
                <Text style={styles.primaryButtonText}>
                  Start 30-Second Test
                </Text>
              </Pressable>
            )}

            {(phase === 'running' || phase === 'countdown') && (
              <Pressable
                style={styles.stopButton}
                onPress={finishTest}
              >
                <Text style={styles.stopButtonText}>
                  Stop Test
                </Text>
              </Pressable>
            )}

            {phase === 'completed' && (
              <View style={styles.reportCard}>
                <Text style={styles.reportTitle}>
                  Your Sit-ups Report
                </Text>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Total sit-ups</Text>
                  <Text style={styles.reportValue}>{reps}</Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Time completed</Text>
                  <Text style={styles.reportValue}>
                    {elapsedSeconds} seconds
                  </Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Reps per minute</Text>
                  <Text style={styles.reportValue}>
                    {repsPerMinute}
                  </Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Average hip angle</Text>
                  <Text style={styles.reportValue}>
                    {averageAngle !== null
                      ? `${averageAngle}°`
                      : 'Unavailable'}
                  </Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Minimum hip angle</Text>
                  <Text style={styles.reportValue}>
                    {minHipAngle !== null
                      ? `${minHipAngle}°`
                      : 'Unavailable'}
                  </Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Maximum hip angle</Text>
                  <Text style={styles.reportValue}>
                    {maxHipAngle !== null
                      ? `${maxHipAngle}°`
                      : 'Unavailable'}
                  </Text>
                </View>

                <Text style={styles.reportNote}>
                  Repetitions are estimates from hip-angle changes detected
                  by the camera. Minimum and maximum angles help evaluate
                  the detection thresholds. This prototype needs further
                  testing before formal scoring.
                </Text>

                <Pressable
                  style={styles.primaryButton}
                  onPress={() => router.push('/results')}
                >
                  <Text style={styles.primaryButtonText}>
                    View Overall Results
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.secondaryButton}
                  onPress={resetTest}
                >
                  <Text style={styles.secondaryButtonText}>
                    Try Again
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Before you begin</Text>

          <Text style={styles.infoText}>
            • Position your phone to the side of your body.
          </Text>

          <Text style={styles.infoText}>
            • Keep your head, shoulders, hips and knees visible.
          </Text>

          <Text style={styles.infoText}>
            • Place your phone on a stable surface.
          </Text>

          <Text style={styles.infoText}>
            • Lie on a safe, comfortable exercise surface.
          </Text>

          <Text style={styles.infoText}>
            • Perform controlled sit-ups without forcing your neck.
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          Sit-up repetitions are estimates from camera-based pose detection.
          This is a prototype assessment and needs testing and calibration
          before being used for formal scoring.
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
    color: '#14213D',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#14213D',
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
  timerCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 18,
  },
  timerLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  timerValue: {
    color: '#14213D',
    fontSize: 44,
    fontWeight: '900',
    marginTop: 4,
  },
  timerHint: {
    color: '#64748B',
    fontSize: 13,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: '#14213D',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 8,
  },
  angleCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    marginTop: 14,
    gap: 12,
  },
  angleTitle: {
    color: '#14213D',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  angleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  angleLabel: {
    color: '#64748B',
    fontSize: 14,
  },
  angleValue: {
    color: '#14213D',
    fontSize: 18,
    fontWeight: '800',
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
  reportCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginTop: 18,
    gap: 14,
  },
  reportTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#14213D',
    marginBottom: 4,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  reportLabel: {
    color: '#64748B',
    fontSize: 14,
    flex: 1,
  },
  reportValue: {
    color: '#14213D',
    fontSize: 16,
    fontWeight: '800',
  },
  reportNote: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
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
  secondaryButton: {
    marginTop: 18,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#14213D',
    fontSize: 15,
    fontWeight: '700',
  },
});
