
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
const MIN_VISIBILITY = 0.4;
const REQUIRED_VALID_FRAMES = 3;
const POSTURE_GRACE_MS = 1500;
const REP_COOLDOWN_MS = 350;

// Initial prototype thresholds. Validate with real users and camera positions.
const TOP_ELBOW_ANGLE = 150;
const BOTTOM_ELBOW_ANGLE = 95;
const MIN_BODY_ANGLE = 145;

export default function PushupsScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<TestPhase>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const [reps, setReps] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [elbowAngle, setElbowAngle] = useState<number | null>(null);
  const [bodyAngle, setBodyAngle] = useState<number | null>(null);

  const [poseStatus, setPoseStatus] = useState('Waiting for camera...');
  const [cameraError, setCameraError] = useState('');

  const phaseRef = useRef<TestPhase>('ready');

  const repCountRef = useRef(0);
  const validFramesRef = useRef(0);

  const hasReachedTopRef = useRef(false);
  const isDownRef = useRef(false);

  const invalidSinceRef = useRef<number | null>(null);
  const lastRepTimeRef = useRef(0);
  const testStartTimeRef = useRef<number | null>(null);

  const elbowAngleRef = useRef<number | null>(null);
  const bodyAngleRef = useRef<number | null>(null);

  const lastStatusRef = useRef('');
  const lastUiUpdateRef = useRef(0);

  const updateStatus = (message: string) => {
    if (lastStatusRef.current !== message) {
      lastStatusRef.current = message;
      setPoseStatus(message);
    }
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

    const dotProduct = abX * cbX + abY * cbY;

    const magnitudeAB = Math.sqrt(abX * abX + abY * abY);
    const magnitudeCB = Math.sqrt(cbX * cbX + cbY * cbY);

    if (magnitudeAB === 0 || magnitudeCB === 0) {
      return 0;
    }

    const cosine = Math.max(
      -1,
      Math.min(1, dotProduct / (magnitudeAB * magnitudeCB))
    );

    return Math.acos(cosine) * (180 / Math.PI);
  };

  const isVisible = (point: Point | undefined) => {
    return (
      !!point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      (point.visibility ?? 1) >= MIN_VISIBILITY
    );
  };

  const resetDetection = () => {
    repCountRef.current = 0;
    validFramesRef.current = 0;

    hasReachedTopRef.current = false;
    isDownRef.current = false;

    invalidSinceRef.current = null;
    lastRepTimeRef.current = 0;
    testStartTimeRef.current = null;

    elbowAngleRef.current = null;
    bodyAngleRef.current = null;

    setReps(0);
    setElapsedSeconds(0);
    setElbowAngle(null);
    setBodyAngle(null);
  };

  const finishTest = () => {
    if (
      phaseRef.current === 'completed' ||
      phaseRef.current === 'ready'
    ) {
      return;
    }

    const duration =
      testStartTimeRef.current !== null
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - testStartTimeRef.current) / 1000
            )
          )
        : 0;

    phaseRef.current = 'completed';
    setPhase('completed');

    setElapsedSeconds(duration);
    setReps(repCountRef.current);

    updateStatus(
      repCountRef.current > 0
        ? 'Push-up assessment completed'
        : 'Assessment completed - No valid repetitions detected'
    );

    void saveResult({
      test: 'Push-ups',
      value: repCountRef.current,
      unit: 'reps',
      details: {
        repetitions: repCountRef.current,
        durationSeconds: duration,
        finalElbowAngle: elbowAngleRef.current ?? 'Not detected',
        finalBodyAngle: bodyAngleRef.current ?? 'Not detected',
        measurement: 'MediaPipe Pose camera-based estimate',
        countingMethod:
          'Elbow angle movement from top position to bottom position and back to top',
      },
    }).catch(error => {
      console.error('Could not save push-up results:', error);
    });
  };

  const handleInvalidPosture = (
    message: string,
    now: number
  ) => {
    validFramesRef.current = 0;

    if (invalidSinceRef.current === null) {
      invalidSinceRef.current = now;
    }

    if (now - invalidSinceRef.current >= POSTURE_GRACE_MS) {
      // Require the athlete to establish the top position again.
      hasReachedTopRef.current = false;
      isDownRef.current = false;
    }

    updateStatus(message);
  };

  const handlePose = (frame: PoseFrame) => {
    if (
      phaseRef.current === 'completed' ||
      phaseRef.current === 'ready' ||
      phaseRef.current === 'countdown'
    ) {
      return;
    }

    const points = frame.landmarks;

    if (!points || points.length < 29) {
      handleInvalidPosture(
        'Body not visible - move into the camera frame',
        Date.now()
      );
      return;
    }

    // MediaPipe Pose landmarks:
    // Left shoulder 11, elbow 13, wrist 15,
    // left hip 23, ankle 27.
    // Right shoulder 12, elbow 14, wrist 16,
    // right hip 24, ankle 28.

    const sides = [
      {
        shoulder: points[11],
        elbow: points[13],
        wrist: points[15],
        hip: points[23],
        ankle: points[27],
      },
      {
        shoulder: points[12],
        elbow: points[14],
        wrist: points[16],
        hip: points[24],
        ankle: points[28],
      },
    ];

    // Select the side with the most reliable visible landmarks.
    const candidates = sides.filter(side =>
      isVisible(side.shoulder) &&
      isVisible(side.elbow) &&
      isVisible(side.wrist) &&
      isVisible(side.hip) &&
      isVisible(side.ankle)
    );

    if (candidates.length === 0) {
      handleInvalidPosture(
        'Keep your shoulder, elbow, wrist, hip and ankle visible',
        Date.now()
      );
      return;
    }

    const selectedSide = candidates.reduce((best, current) => {
      const score = (side: typeof current) =>
        (side.shoulder.visibility ?? 1) +
        (side.elbow.visibility ?? 1) +
        (side.wrist.visibility ?? 1) +
        (side.hip.visibility ?? 1) +
        (side.ankle.visibility ?? 1);

      return score(current) > score(best) ? current : best;
    });

    const shoulder = selectedSide.shoulder as Point;
    const elbow = selectedSide.elbow as Point;
    const wrist = selectedSide.wrist as Point;
    const hip = selectedSide.hip as Point;
    const ankle = selectedSide.ankle as Point;

    // Calculate the angle at the elbow.
    const currentElbowAngle = calculateAngle(
      shoulder,
      elbow,
      wrist
    );

    // Check body alignment using shoulder, hip and ankle.
    const currentBodyAngle = calculateAngle(
      shoulder,
      hip,
      ankle
    );

    elbowAngleRef.current = currentElbowAngle;
    bodyAngleRef.current = currentBodyAngle;

    const now = Date.now();

    // Update the UI four times per second instead of every frame.
    if (now - lastUiUpdateRef.current >= 250) {
      lastUiUpdateRef.current = now;

      setElbowAngle(Math.round(currentElbowAngle));
      setBodyAngle(Math.round(currentBodyAngle));
    }

    const bodyIsStraight = currentBodyAngle >= MIN_BODY_ANGLE;

    if (!bodyIsStraight) {
      handleInvalidPosture(
        'Keep your back straight - avoid dropping or raising your hips',
        now
      );
      return;
    }

    // Valid posture detected.
    invalidSinceRef.current = null;
    validFramesRef.current += 1;

    if (validFramesRef.current < REQUIRED_VALID_FRAMES) {
      updateStatus(
        `Checking body alignment (${validFramesRef.current}/${REQUIRED_VALID_FRAMES})`
      );
      return;
    }

    // First establish the fully extended top position.
    if (!hasReachedTopRef.current) {
      if (currentElbowAngle >= TOP_ELBOW_ANGLE) {
        hasReachedTopRef.current = true;
        isDownRef.current = false;

        updateStatus('Top position detected - Start lowering your body');
      } else {
        updateStatus('Start with your arms extended');
      }

      return;
    }

    // Detect downward movement.
    if (
      !isDownRef.current &&
      currentElbowAngle <= BOTTOM_ELBOW_ANGLE
    ) {
      isDownRef.current = true;
      updateStatus('Down position detected - Push yourself up');
      return;
    }

    // Count one repetition only after returning to the top.
    if (
      isDownRef.current &&
      currentElbowAngle >= TOP_ELBOW_ANGLE
    ) {
      if (now - lastRepTimeRef.current >= REP_COOLDOWN_MS) {
        repCountRef.current += 1;
        lastRepTimeRef.current = now;

        setReps(repCountRef.current);

        isDownRef.current = false;

        updateStatus(
          `Great! ${repCountRef.current} push-up${repCountRef.current === 1 ? '' : 's'} completed`
        );
      }
    } else if (isDownRef.current) {
      updateStatus('Push yourself back up');
    } else {
      updateStatus('Good position - Continue your push-ups');
    }
  };

  const startTest = () => {
    resetDetection();

    setCountdown(COUNTDOWN_SECONDS);
    setCameraError('');

    lastStatusRef.current = '';

    phaseRef.current = 'countdown';
    setPhase('countdown');

    updateStatus('Get ready - position yourself for push-ups');
  };

  const resetTest = () => {
    phaseRef.current = 'ready';
    setPhase('ready');

    resetDetection();

    setCountdown(COUNTDOWN_SECONDS);
    setCameraError('');

    lastStatusRef.current = '';
    updateStatus('Waiting for camera...');
  };

  // Countdown and assessment timer.
  useEffect(() => {
    if (
      phase !== 'countdown' &&
      phase !== 'running'
    ) {
      return;
    }

    const timer = setInterval(() => {
      if (phaseRef.current === 'countdown') {
        setCountdown(previous => {
          if (previous <= 1) {
            phaseRef.current = 'running';
            setPhase('running');

            testStartTimeRef.current = Date.now();

            updateStatus('Start in the fully extended position');

            return 0;
          }

          return previous - 1;
        });
      }

      if (
        phaseRef.current === 'running' &&
        testStartTimeRef.current !== null
      ) {
        const duration = Math.floor(
          (Date.now() - testStartTimeRef.current) / 1000
        );

        setElapsedSeconds(duration);
      }
    }, 200);

    return () => clearInterval(timer);
  }, [phase]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return (
      `${String(minutes).padStart(2, '0')}:` +
      `${String(remainingSeconds).padStart(2, '0')}`
    );
  };

  const viewResults = () => {
    router.push({
      pathname: '/results',
      params: {
        test: 'Push-ups',
        reps: String(reps),
        duration: String(elapsedSeconds),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>Push-ups Test</Text>

        <Text style={styles.subtitle}>
          Test your upper-body strength using AI-powered
          pose detection. Perform complete push-ups while
          maintaining proper body alignment.
        </Text>

        {/* CAMERA */}
        <View style={styles.cameraContainer}>
          {!permission ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : !permission.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>
                Camera access needed
              </Text>

              <Text style={styles.permissionText}>
                Allow camera access to start the AI push-up assessment.
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
              cameraFacing="front"
              frameLimit={30}
              callbackFps={20}
              onLandmark={handlePose}
              onInferenceError={error => {
                setCameraError(error.code);
                updateStatus('Pose detection error');
              }}
              onCameraConfigured={() => {
                setCameraError('');
                updateStatus('Camera ready - Position yourself sideways');
              }}
            />
          )}
        </View>

        {permission?.granted && (
          <>
            {/* REP COUNT */}
            <View style={styles.counterCard}>
              <Text style={styles.counterLabel}>
                {phase === 'completed' ? 'TOTAL PUSH-UPS' : 'PUSH-UP COUNT'}
              </Text>

              <Text style={styles.counterValue}>{reps}</Text>

              <Text style={styles.counterHint}>
                Only complete downward and upward movements are counted.
              </Text>
            </View>

            {/* TIMER */}
            <View style={styles.timerCard}>
              <Text style={styles.timerLabel}>
                {phase === 'countdown'
                  ? 'GET READY'
                  : phase === 'completed'
                    ? 'TOTAL DURATION'
                    : 'TIME ELAPSED'}
              </Text>

              <Text style={styles.timerValue}>
                {phase === 'countdown'
                  ? countdown
                  : formatTime(elapsedSeconds)}
              </Text>
            </View>

            {/* ANGLES */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>ELBOW ANGLE</Text>

                <Text style={styles.statValue}>
                  {elbowAngle !== null ? `${elbowAngle}°` : '--'}
                </Text>

                <Text style={styles.unitText}>
                  Bottom target: 95° or less
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>BODY ANGLE</Text>

                <Text style={styles.statValue}>
                  {bodyAngle !== null ? `${bodyAngle}°` : '--'}
                </Text>

                <Text style={styles.unitText}>
                  Target: 145° or more
                </Text>
              </View>
            </View>

            {/* STATUS */}
            <View style={styles.statusCard}>
              <View
                style={[
                  styles.statusDot,
                  phase === 'running'
                    ? styles.statusReady
                    : styles.statusWaiting,
                ]}
              />

              <Text style={styles.statusText}>
                {cameraError
                  ? `${poseStatus}: ${cameraError}`
                  : poseStatus}
              </Text>
            </View>

            {/* CONTROLS */}
            {phase === 'ready' && (
              <Pressable
                style={styles.primaryButton}
                onPress={startTest}
              >
                <Text style={styles.primaryButtonText}>
                  Start Push-ups Test
                </Text>
              </Pressable>
            )}

            {(phase === 'countdown' || phase === 'running') && (
              <Pressable
                style={styles.stopButton}
                onPress={finishTest}
              >
                <Text style={styles.primaryButtonText}>
                  Stop Test
                </Text>
              </Pressable>
            )}

            {/* FINAL REPORT */}
            {phase === 'completed' && (
              <View style={styles.reportCard}>
                <Text style={styles.reportTitle}>
                  Your Push-ups Test Report
                </Text>

                <Text style={styles.finalReps}>{reps}</Text>

                <Text style={styles.reportLabel}>
                  Total completed push-ups
                </Text>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Duration</Text>
                  <Text style={styles.reportValue}>
                    {formatTime(elapsedSeconds)}
                  </Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Final elbow angle</Text>
                  <Text style={styles.reportValue}>
                    {elbowAngle !== null ? `${elbowAngle}°` : 'Not available'}
                  </Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Final body angle</Text>
                  <Text style={styles.reportValue}>
                    {bodyAngle !== null ? `${bodyAngle}°` : 'Not available'}
                  </Text>
                </View>

                <Text style={styles.reportNote}>
                  Repetitions are estimated from camera-detected elbow
                  movement and body alignment. Camera position, lighting,
                  visibility and tracking errors can affect the result.
                  This prototype should be validated against manual
                  counting before formal sports scoring.
                </Text>

                <Pressable
                  style={styles.primaryButton}
                  onPress={viewResults}
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

        {/* INSTRUCTIONS */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Before you begin</Text>

          <Text style={styles.infoText}>
            • Position your phone sideways to your body.
          </Text>

          <Text style={styles.infoText}>
            • Keep your full body visible in the camera.
          </Text>

          <Text style={styles.infoText}>
            • Place your phone on a stable surface.
          </Text>

          <Text style={styles.infoText}>
            • Start in a fully extended push-up position.
          </Text>

          <Text style={styles.infoText}>
            • Lower your chest by bending your elbows.
          </Text>

          <Text style={styles.infoText}>
            • Push yourself back up until your arms are extended.
          </Text>

          <Text style={styles.infoText}>
            • Keep your back and legs aligned throughout the movement.
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          MediaPipe Pose estimates body landmarks and joint angles.
          This prototype does not independently verify chest-to-floor
          depth, hand placement or complete exercise technique.
          Results are estimates, not official sports scores.
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
    maxWidth: 900,
    alignSelf: 'center',
  },

  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 18,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333333',
    marginBottom: 20,
  },

  cameraContainer: {
    width: '100%',
    height: 500,
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
  },

  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },

  permissionText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
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

  counterCard: {
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 18,
  },

  counterLabel: {
    color: '#333333',
    fontSize: 13,
    fontWeight: '700',
  },

  counterValue: {
    color: '#14213D',
    fontSize: 64,
    fontWeight: '900',
    marginTop: 5,
  },

  counterHint: {
    color: '#555555',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },

  timerCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 14,
  },

  timerLabel: {
    color: '#333333',
    fontSize: 13,
    fontWeight: '700',
  },

  timerValue: {
    color: '#000000',
    fontSize: 42,
    fontWeight: '900',
    marginTop: 8,
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
    color: '#333333',
    fontSize: 12,
    fontWeight: '700',
  },

  statValue: {
    color: '#000000',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
  },

  unitText: {
    color: '#555555',
    fontSize: 11,
    marginTop: 5,
    textAlign: 'center',
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
    color: '#000000',
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
    color: '#000000',
  },

  finalReps: {
    fontSize: 56,
    fontWeight: '900',
    color: '#14213D',
    textAlign: 'center',
    marginTop: 8,
  },

  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },

  reportLabel: {
    color: '#333333',
    fontSize: 14,
    flex: 1,
  },

  reportValue: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
  },

  reportNote: {
    color: '#555555',
    fontSize: 12,
    lineHeight: 19,
    marginTop: 8,
  },

  secondaryButton: {
    backgroundColor: '#E2E8F0',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },

  secondaryButtonText: {
    color: '#14213D',
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
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
  },

  infoText: {
    fontSize: 14,
    color: '#333333',
    lineHeight: 21,
  },

  disclaimer: {
    fontSize: 12,
    lineHeight: 19,
    color: '#666666',
    marginTop: 18,
    marginBottom: 8,
  },
});
