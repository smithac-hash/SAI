
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
const REQUIRED_VALID_FRAMES = 5;
const MIN_VISIBILITY = 0.4;
const POSTURE_GRACE_MS = 1500;

// Starting thresholds for prototype testing.
// These are not clinically or scientifically validated.
const MIN_BODY_ANGLE = 155;
const MIN_KNEE_ANGLE = 145;

export default function PlankScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<TestPhase>('ready');
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bodyAngle, setBodyAngle] = useState<number | null>(null);
  const [kneeAngle, setKneeAngle] = useState<number | null>(null);

  const [poseStatus, setPoseStatus] = useState(
    'Waiting for camera...'
  );

  const [cameraError, setCameraError] = useState('');

  // Keep phase accessible inside camera callbacks.
  const phaseRef = useRef<TestPhase>('ready');

  // Plank detection.
  const validFramesRef = useRef(0);
  const holdStartedRef = useRef(false);
  const holdStartTimeRef = useRef<number | null>(null);
  const invalidSinceRef = useRef<number | null>(null);

  // Latest posture measurements.
  const bodyAngleRef = useRef<number | null>(null);
  const kneeAngleRef = useRef<number | null>(null);

  // Prevent unnecessary React renders on every camera frame.
  const lastStatusRef = useRef('');
  const lastUiUpdateRef = useRef(0);

  const updateStatus = (message: string) => {
    if (lastStatusRef.current !== message) {
      lastStatusRef.current = message;
      setPoseStatus(message);
    }
  };

  // Calculate the angle at point B.
  // A straight body line produces an angle close to 180 degrees.
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
      Math.min(
        1,
        dotProduct / (magnitudeAB * magnitudeCB)
      )
    );

    return (
      Math.acos(cosine) * (180 / Math.PI)
    );
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
    validFramesRef.current = 0;

    holdStartedRef.current = false;
    holdStartTimeRef.current = null;
    invalidSinceRef.current = null;

    bodyAngleRef.current = null;
    kneeAngleRef.current = null;

    setBodyAngle(null);
    setKneeAngle(null);
    setElapsedSeconds(0);
  };

  const finishTest = () => {
    if (
      phaseRef.current === 'completed' ||
      phaseRef.current === 'ready'
    ) {
      return;
    }

    const now = Date.now();

    // If posture was lost, stop the measurement at the first
    // invalid frame rather than counting the grace period.
    const endTime = invalidSinceRef.current ?? now;

    const duration =
      holdStartedRef.current && holdStartTimeRef.current !== null
        ? Math.max(
            0,
            Math.floor(
              (endTime - holdStartTimeRef.current) / 1000
            )
          )
        : 0;

    phaseRef.current = 'completed';
    setPhase('completed');

    setElapsedSeconds(duration);
    updateStatus(
      duration > 0
        ? 'Plank assessment completed'
        : 'No valid plank hold detected'
    );

    void saveResult({
      test: 'Plank',
      value: duration,
      unit: 'seconds',
      details: {
        holdDurationSeconds: duration,
        finalBodyAngle: bodyAngleRef.current,
        finalKneeAngle: kneeAngleRef.current,
        measurement: 'MediaPipe Pose camera-based estimate',
        postureCheck: 'Shoulder-hip-ankle and hip-knee-ankle alignment',
      },
    }).catch(error => {
      console.error('Could not save plank results:', error);
    });
  };

  // Called when posture is not valid.
  const handleInvalidPosture = (
    message: string,
    now: number
  ) => {
    validFramesRef.current = 0;

    if (!holdStartedRef.current) {
      updateStatus(message);
      return;
    }

    if (invalidSinceRef.current === null) {
      invalidSinceRef.current = now;
    }

    const invalidDuration =
      now - invalidSinceRef.current;

    if (invalidDuration >= POSTURE_GRACE_MS) {
      finishTest();
      return;
    }

    updateStatus(
      `${message} Correct your posture!`
    );
  };

  const handlePose = (frame: PoseFrame) => {
    if (phaseRef.current === 'completed') {
      return;
    }

    const points = frame.landmarks;

    if (!points || points.length < 29) {
      if (phaseRef.current === 'running') {
        handleInvalidPosture(
          'Body not visible - move into the frame',
          Date.now()
        );
      } else {
        updateStatus('Show your full body to the camera');
      }
      return;
    }

    if (
      phaseRef.current !== 'running'
    ) {
      updateStatus(
        phaseRef.current === 'countdown'
          ? 'Get into your plank position'
          : 'Camera ready - position yourself sideways'
      );
      return;
    }

    // MediaPipe Pose landmark indexes:
    // Left shoulder 11, left elbow 13, left hip 23,
    // left knee 25, left ankle 27.
    // Right shoulder 12, right elbow 14, right hip 24,
    // right knee 26, right ankle 28.

    const sides = [
      {
        shoulder: points[11],
        hip: points[23],
        knee: points[25],
        ankle: points[27],
      },
      {
        shoulder: points[12],
        hip: points[24],
        knee: points[26],
        ankle: points[28],
      },
    ];

    // Select the side with the most reliable visible landmarks.
    const candidates = sides.filter(side =>
      isVisible(side.shoulder) &&
      isVisible(side.hip) &&
      isVisible(side.knee) &&
      isVisible(side.ankle)
    );

    if (candidates.length === 0) {
      handleInvalidPosture(
        'Keep your shoulder, hip, knee and ankle visible',
        Date.now()
      );
      return;
    }

    const selectedSide = candidates.reduce((best, current) => {
      const score = (side: typeof current) =>
        (side.shoulder.visibility ?? 1) +
        (side.hip.visibility ?? 1) +
        (side.knee.visibility ?? 1) +
        (side.ankle.visibility ?? 1);

      return score(current) > score(best)
        ? current
        : best;
    });

    const shoulder = selectedSide.shoulder as Point;
    const hip = selectedSide.hip as Point;
    const knee = selectedSide.knee as Point;
    const ankle = selectedSide.ankle as Point;

    // Check whether the torso and legs form a straight line.
    const currentBodyAngle = calculateAngle(
      shoulder,
      hip,
      ankle
    );

    // Check whether the knees remain extended.
    const currentKneeAngle = calculateAngle(
      hip,
      knee,
      ankle
    );

    bodyAngleRef.current = currentBodyAngle;
    kneeAngleRef.current = currentKneeAngle;

    const now = Date.now();

    // Update displayed angles only four times per second.
    if (now - lastUiUpdateRef.current >= 250) {
      lastUiUpdateRef.current = now;

      setBodyAngle(Math.round(currentBodyAngle));
      setKneeAngle(Math.round(currentKneeAngle));
    }

    const bodyIsStraight =
      currentBodyAngle >= MIN_BODY_ANGLE;

    const kneesAreStraight =
      currentKneeAngle >= MIN_KNEE_ANGLE;

    const postureIsValid =
      bodyIsStraight && kneesAreStraight;

    if (!postureIsValid) {
      let message = 'Adjust your posture';

      if (!bodyIsStraight) {
        message = 'Keep your back straight - avoid sagging or raising your hips';
      } else if (!kneesAreStraight) {
        message = 'Keep your legs straight';
      }

      handleInvalidPosture(message, now);
      return;
    }

    // Valid posture detected.
    validFramesRef.current += 1;

    // If the athlete corrects their posture during the grace period,
    // continue the same plank attempt.
    invalidSinceRef.current = null;

    if (!holdStartedRef.current) {
      updateStatus(
        `Checking plank posture (${validFramesRef.current}/${REQUIRED_VALID_FRAMES})`
      );

      if (
        validFramesRef.current >= REQUIRED_VALID_FRAMES
      ) {
        holdStartedRef.current = true;
        holdStartTimeRef.current = now;

        updateStatus('Plank started! Hold your position.');
      }
    } else {
      updateStatus('Good posture - Keep holding!');
    }
  };

  const startTest = () => {
    resetDetection();

    setCountdown(COUNTDOWN_SECONDS);
    setCameraError('');

    lastStatusRef.current = '';

    phaseRef.current = 'countdown';
    setPhase('countdown');

    updateStatus('Get ready - enter a forearm plank position');
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

  // Countdown and live timer.
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

            updateStatus('Get into your plank position');

            return 0;
          }

          return previous - 1;
        });
      }

      if (
        phaseRef.current === 'running' &&
        holdStartedRef.current &&
        holdStartTimeRef.current !== null
      ) {
        const currentTime = Date.now();

        const endTime =
          invalidSinceRef.current ?? currentTime;

        const duration = Math.max(
          0,
          Math.floor(
            (endTime - holdStartTimeRef.current) / 1000
          )
        );

        setElapsedSeconds(duration);

        if (
          invalidSinceRef.current !== null &&
          currentTime - invalidSinceRef.current >=
            POSTURE_GRACE_MS
        ) {
          finishTest();
        }
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
        test: 'Plank',
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

        <Text style={styles.title}>
          Plank Test
        </Text>

        <Text style={styles.subtitle}>
          Test your core endurance using AI-powered
          posture detection. Maintain a straight body
          position for as long as possible.
        </Text>

        {/* CAMERA */}
        <View style={styles.cameraContainer}>
          {!permission ? (
            <ActivityIndicator
              size="large"
              color="#FFFFFF"
            />
          ) : !permission.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>
                Camera access needed
              </Text>

              <Text style={styles.permissionText}>
                Allow camera access to start the AI plank assessment.
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
            {/* TIMER */}
            <View style={styles.timerCard}>
              <Text style={styles.timerLabel}>
                {phase === 'countdown'
                  ? 'GET READY'
                  : phase === 'running'
                    ? 'PLANK DURATION'
                    : phase === 'completed'
                      ? 'FINAL DURATION'
                      : 'YOUR HOLD TIME'}
              </Text>

              <Text style={styles.timerValue}>
                {phase === 'countdown'
                  ? countdown
                  : formatTime(elapsedSeconds)}
              </Text>

              <Text style={styles.timerHint}>
                {phase === 'ready'
                  ? 'Your timer starts when AI confirms your posture'
                  : phase === 'running' && !holdStartedRef.current
                    ? 'Waiting for a valid plank position'
                    : 'Maintain your position'}
              </Text>
            </View>

            {/* POSTURE ANGLES */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>
                  BODY ANGLE
                </Text>

                <Text style={styles.statValue}>
                  {bodyAngle !== null
                    ? `${bodyAngle}°`
                    : '--'}
                </Text>

                <Text style={styles.unitText}>
                  Target: 155°–180°
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>
                  KNEE ANGLE
                </Text>

                <Text style={styles.statValue}>
                  {kneeAngle !== null
                    ? `${kneeAngle}°`
                    : '--'}
                </Text>

                <Text style={styles.unitText}>
                  Target: 145°–180°
                </Text>
              </View>
            </View>

            {/* AI STATUS */}
            <View style={styles.statusCard}>
              <View
                style={[
                  styles.statusDot,
                  cameraError
                    ? styles.statusWaiting
                    : holdStartedRef.current
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
                  Start Plank Test
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
                  Your Plank Test Report
                </Text>

                <Text style={styles.finalDuration}>
                  {formatTime(elapsedSeconds)}
                </Text>

                <Text style={styles.reportLabel}>
                  Total plank holding time
                </Text>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>
                    Body angle
                  </Text>

                  <Text style={styles.reportValue}>
                    {bodyAngle !== null
                      ? `${bodyAngle}°`
                      : 'Not available'}
                  </Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>
                    Knee angle
                  </Text>

                  <Text style={styles.reportValue}>
                    {kneeAngle !== null
                      ? `${kneeAngle}°`
                      : 'Not available'}
                  </Text>
                </View>

                <Text style={styles.reportNote}>
                  The duration is based on camera-detected
                  posture. Camera placement, lighting,
                  landmark visibility and tracking errors
                  can affect the result. This prototype
                  should be validated against manual timing
                  before formal sports scoring.
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
          <Text style={styles.infoTitle}>
            Before you begin
          </Text>

          <Text style={styles.infoText}>
            • Position your phone to the side of your body.
          </Text>

          <Text style={styles.infoText}>
            • Keep your entire body visible in the camera.
          </Text>

          <Text style={styles.infoText}>
            • Place your phone on a stable surface.
          </Text>

          <Text style={styles.infoText}>
            • Get into a forearm plank position.
          </Text>

          <Text style={styles.infoText}>
            • Keep your back and legs straight.
          </Text>

          <Text style={styles.infoText}>
            • Avoid raising or dropping your hips.
          </Text>

          <Text style={styles.infoText}>
            • Hold the position for as long as possible.
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          AI checks torso and leg alignment using
          MediaPipe Pose landmarks. It does not yet
          independently verify elbow placement or
          measure muscle endurance. Results are
          prototype estimates, not official scores.
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

  timerCard: {
    backgroundColor: '#FFFFFF',
    padding: 22,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 18,
  },

  timerLabel: {
    color: '#333333',
    fontSize: 13,
    fontWeight: '700',
  },

  timerValue: {
    color: '#000000',
    fontSize: 48,
    fontWeight: '900',
    marginTop: 8,
  },

  timerHint: {
    color: '#555555',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
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

  finalDuration: {
    fontSize: 44,
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
