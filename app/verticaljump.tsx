
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import { PoseCameraView } from 'expo-mediapipe-pose';
import { router } from 'expo-router';
import { saveResult } from '../lib/assessmentStore';

type TestPhase = 'ready' | 'countdown' | 'running' | 'completed';
type JumpStage = 'grounded' | 'airborne' | 'landing';

type PoseFrame = Parameters<
  NonNullable<React.ComponentProps<typeof PoseCameraView>['onLandmark']>
>[0];

const TOTAL_ATTEMPTS = 5;
const SECONDS_PER_ATTEMPT = 10;

const TAKEOFF_RATIO = 0.035;
const REARM_RATIO = 0.015;
const DESCENT_RATIO = 0.02;
const MIN_PEAK_RATIO = 0.04;
const MIN_AIR_TIME = 120;
const MAX_AIR_TIME = 1500;
const REARM_TIMEOUT = 700;
const CALIBRATION_FRAMES = 10;
const SMOOTHING = 0.5;
const MIN_VISIBILITY = 0.5;
const BODY_TO_HEIGHT = 0.9;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

type Landmark = { y: number; visibility?: number } | undefined;

const isVisible = (p: Landmark) =>
  !!p && (p.visibility ?? 1) >= MIN_VISIBILITY && Number.isFinite(p.y);

export default function VerticalJumpScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<TestPhase>('ready');
  const [countdown, setCountdown] = useState(3);

  const [attemptNumber, setAttemptNumber] = useState(1);
  const [attemptTimeLeft, setAttemptTimeLeft] = useState(
    SECONDS_PER_ATTEMPT
  );

  const [heightInput, setHeightInput] = useState('170');
  const [jumpHeight, setJumpHeight] = useState<number | null>(null);
  const [bestJump, setBestJump] = useState(0);
  const [jumpCount, setJumpCount] = useState(0);
  const [missedAttempts, setMissedAttempts] = useState(0);

  const [poseStatus, setPoseStatus] = useState('Waiting for pose...');
  const [cameraError, setCameraError] = useState('');
  const [debugInfo, setDebugInfo] = useState('Waiting for test to start');

  const phaseRef = useRef<TestPhase>('ready');
  const stageRef = useRef<JumpStage>('grounded');

  const baselineHipRef = useRef<number | null>(null);
  const baselineBodyRef = useRef<number | null>(null);

  const peakRiseRef = useRef(0);
  const jumpStartRef = useRef<number | null>(null);

  const bestJumpRef = useRef(0);
  const jumpCountRef = useRef(0);
  const missedAttemptsRef = useRef(0);

  const attemptNumberRef = useRef(1);
  const attemptStartRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const userHeightRef = useRef(170);

  const smoothHipRef = useRef<number | null>(null);
  const calibSamplesRef = useRef<{ hip: number; body: number }[]>([]);
  const rearmDeadlineRef = useRef(0);
  const lastDebugRef = useRef(0);

  const updateDebug = (text: string) => {
    const now = Date.now();

    if (now - lastDebugRef.current >= 250) {
      lastDebugRef.current = now;
      setDebugInfo(text);
    }
  };

  // Save the completed test.
  const finishTest = () => {
    if (
      phaseRef.current === 'completed' ||
      phaseRef.current === 'ready'
    ) {
      return;
    }

    const elapsed = startTimeRef.current
      ? Math.max(
          0,
          Math.round((Date.now() - startTimeRef.current) / 1000)
        )
      : 0;

    phaseRef.current = 'completed';
    setPhase('completed');

    setPoseStatus('All attempts completed');

    void saveResult({
      test: 'Vertical Jump',
      value: bestJumpRef.current,
      unit: 'cm',
      details: {
        bestJumpHeight: bestJumpRef.current,
        totalJumps: jumpCountRef.current,
        totalAttempts: TOTAL_ATTEMPTS,
        missedAttempts: missedAttemptsRef.current,
        durationSeconds: elapsed,
        userHeightCm: userHeightRef.current,
        measurement: 'Camera-based estimate',
      },
    }).catch(error => {
      console.error('Could not save vertical jump results:', error);
    });
  };

  // Move to the next 10-second attempt.
  const advanceAttempt = (jumpDetected: boolean) => {
    if (phaseRef.current !== 'running') return;

    if (!jumpDetected) {
      missedAttemptsRef.current += 1;
      setMissedAttempts(missedAttemptsRef.current);
      setPoseStatus(`Attempt ${attemptNumberRef.current} missed`);
    }

    if (attemptNumberRef.current >= TOTAL_ATTEMPTS) {
      finishTest();
      return;
    }

    attemptNumberRef.current += 1;
    setAttemptNumber(attemptNumberRef.current);
    setAttemptTimeLeft(SECONDS_PER_ATTEMPT);

    attemptStartRef.current = Date.now();

    // Reset the detector for the next attempt.
    peakRiseRef.current = 0;
    jumpStartRef.current = null;

    if (!jumpDetected) {
      stageRef.current = 'grounded';
    }

    setPoseStatus(
      `Get ready for attempt ${attemptNumberRef.current}`
    );
  };

  const handlePose = (frame: PoseFrame) => {
    const points = frame.landmarks;
    const currentPhase = phaseRef.current;

    if (currentPhase === 'completed') return;

    if (!points || points.length < 29) {
      setPoseStatus('Position your full body in the frame');
      return;
    }

    // MediaPipe indexes:
    // 0 = Nose, 23/24 = Hips, 27/28 = Ankles
    const nose = points[0];
    const leftHip = points[23];
    const rightHip = points[24];
    const leftAnkle = points[27];
    const rightAnkle = points[28];

    const hipsVisible =
      isVisible(leftHip) && isVisible(rightHip);

    const fullBodyVisible =
      hipsVisible &&
      isVisible(nose) &&
      isVisible(leftAnkle) &&
      isVisible(rightAnkle);

    const bodyHeight = fullBodyVisible
      ? (leftAnkle.y + rightAnkle.y) / 2 - nose.y
      : 0;

    if (currentPhase !== 'countdown' && currentPhase !== 'running') {
      setPoseStatus(
        fullBodyVisible && bodyHeight > 0.1
          ? 'Full body detected - Ready to start'
          : 'Keep your full body visible'
      );
      return;
    }

    if (!hipsVisible) {
      updateDebug('Hips not visible - keep your hips inside the frame');
      return;
    }

    const rawHip = (leftHip.y + rightHip.y) / 2;
    const previousHip = smoothHipRef.current;

    const hipY =
      previousHip === null
        ? rawHip
        : previousHip + SMOOTHING * (rawHip - previousHip);

    smoothHipRef.current = hipY;

    const now = Date.now();

    // Collect standing-position samples during countdown.
    if (currentPhase === 'countdown') {
      if (fullBodyVisible && bodyHeight > 0.1) {
        const samples = calibSamplesRef.current;

        samples.push({ hip: hipY, body: bodyHeight });

        if (samples.length > CALIBRATION_FRAMES) {
          samples.shift();
        }

        setPoseStatus('Stand still - calibrating');
      } else {
        setPoseStatus('Keep your full body visible');
      }

      return;
    }

    // Initialize the baseline.
    if (baselineHipRef.current === null) {
      const samples = calibSamplesRef.current;

      if (samples.length >= 3) {
        baselineHipRef.current = median(samples.map(s => s.hip));
        baselineBodyRef.current = median(samples.map(s => s.body));
      } else if (fullBodyVisible && bodyHeight > 0.1) {
        baselineHipRef.current = hipY;
        baselineBodyRef.current = bodyHeight;
      } else {
        setPoseStatus('Keep your full body visible');
        return;
      }
    }

    const baselineHip = baselineHipRef.current!;
    const baselineBody = baselineBodyRef.current!;

    const rise = baselineHip - hipY;
    const riseRatio = rise / baselineBody;

    updateDebug(
      `Stage: ${stageRef.current} | Rise: ${(riseRatio * 100).toFixed(1)}% | ` +
      `Peak: ${((peakRiseRef.current / baselineBody) * 100).toFixed(1)}%`
    );

    // GROUNDED: wait for takeoff.
    if (stageRef.current === 'grounded') {
      if (Math.abs(riseRatio) < REARM_RATIO) {
        baselineHipRef.current =
          baselineHip * 0.95 + hipY * 0.05;
      }

      if (riseRatio >= TAKEOFF_RATIO) {
        stageRef.current = 'airborne';
        jumpStartRef.current = now;
        peakRiseRef.current = rise;
        setPoseStatus('Jump detected!');
      } else {
        setPoseStatus('Pose detected - Ready to jump');
      }

      return;
    }

    // AIRBORNE: track the highest hip position.
    if (stageRef.current === 'airborne') {
      if (rise > peakRiseRef.current) {
        peakRiseRef.current = rise;
      }

      const elapsed = jumpStartRef.current
        ? now - jumpStartRef.current
        : 0;

      const peakRatio = peakRiseRef.current / baselineBody;

      const dropFromPeak =
        (peakRiseRef.current - rise) / baselineBody;

      const descended =
        dropFromPeak >=
          Math.max(DESCENT_RATIO, peakRatio * 0.35) &&
        elapsed >= MIN_AIR_TIME;

      const timedOut = elapsed > MAX_AIR_TIME;

      if (descended || timedOut) {
        // Count a jump only if it reaches the minimum peak threshold.
        if (peakRatio >= MIN_PEAK_RATIO) {
          const result =
            Math.round(
              peakRatio *
              userHeightRef.current *
              BODY_TO_HEIGHT *
              10
            ) / 10;

          jumpCountRef.current += 1;

          bestJumpRef.current = Math.max(
            bestJumpRef.current,
            result
          );

          setJumpCount(jumpCountRef.current);
          setJumpHeight(result);
          setBestJump(bestJumpRef.current);

          setPoseStatus(`Attempt ${attemptNumberRef.current} detected!`);

          stageRef.current = 'landing';
          rearmDeadlineRef.current = now + REARM_TIMEOUT;

          jumpStartRef.current = null;
          peakRiseRef.current = 0;

          // Move to the next attempt after a valid jump.
          advanceAttempt(true);
        } else {
          stageRef.current = 'landing';
          rearmDeadlineRef.current = now + REARM_TIMEOUT;

          jumpStartRef.current = null;
          peakRiseRef.current = 0;
        }
      }

      return;
    }

    // LANDING: wait until the athlete returns near the baseline.
    const settled = riseRatio <= REARM_RATIO;
    const pastDeadline = now > rearmDeadlineRef.current;

    if (settled || (pastDeadline && riseRatio < TAKEOFF_RATIO)) {
      stageRef.current = 'grounded';
    } else if (now > rearmDeadlineRef.current + 1500) {
      baselineHipRef.current = hipY;
      stageRef.current = 'grounded';
    }
  };

  const startTest = () => {
    const parsedHeight = Number(heightInput);

    if (
      !Number.isFinite(parsedHeight) ||
      parsedHeight < 100 ||
      parsedHeight > 250
    ) {
      setPoseStatus('Enter a valid height between 100 and 250 cm');
      return;
    }

    userHeightRef.current = parsedHeight;

    setJumpHeight(null);
    setBestJump(0);
    setJumpCount(0);
    setMissedAttempts(0);

    bestJumpRef.current = 0;
    jumpCountRef.current = 0;
    missedAttemptsRef.current = 0;

    attemptNumberRef.current = 1;
    setAttemptNumber(1);
    setAttemptTimeLeft(SECONDS_PER_ATTEMPT);

    setCountdown(3);
    setCameraError('');
    setDebugInfo('Waiting for standing-position calibration...');

    baselineHipRef.current = null;
    baselineBodyRef.current = null;

    peakRiseRef.current = 0;
    jumpStartRef.current = null;

    startTimeRef.current = null;
    attemptStartRef.current = null;

    smoothHipRef.current = null;
    calibSamplesRef.current = [];
    rearmDeadlineRef.current = 0;
    lastDebugRef.current = 0;

    stageRef.current = 'grounded';

    phaseRef.current = 'countdown';
    setPhase('countdown');
    setPoseStatus('Get ready!');
  };

  const resetTest = () => {
    phaseRef.current = 'ready';
    setPhase('ready');

    setJumpHeight(null);
    setBestJump(0);
    setJumpCount(0);
    setMissedAttempts(0);

    attemptNumberRef.current = 1;
    setAttemptNumber(1);
    setAttemptTimeLeft(SECONDS_PER_ATTEMPT);

    setCountdown(3);

    baselineHipRef.current = null;
    baselineBodyRef.current = null;

    peakRiseRef.current = 0;
    jumpStartRef.current = null;

    bestJumpRef.current = 0;
    jumpCountRef.current = 0;
    missedAttemptsRef.current = 0;

    startTimeRef.current = null;
    attemptStartRef.current = null;

    smoothHipRef.current = null;
    calibSamplesRef.current = [];
    rearmDeadlineRef.current = 0;
    lastDebugRef.current = 0;

    stageRef.current = 'grounded';

    setCameraError('');
    setPoseStatus('Waiting for pose...');
    setDebugInfo('Waiting for test to start');
  };

  // Countdown and individual 10-second attempt timer.
  useEffect(() => {
    if (phase !== 'countdown' && phase !== 'running') {
      return;
    }

    const timer = setInterval(() => {
      if (phaseRef.current === 'countdown') {
        setCountdown(previous => {
          if (previous <= 1) {
            phaseRef.current = 'running';

            startTimeRef.current = Date.now();
            attemptStartRef.current = Date.now();

            setPhase('running');
            setAttemptTimeLeft(SECONDS_PER_ATTEMPT);
            setPoseStatus('Attempt 1 - Jump when ready');

            return 0;
          }

          return previous - 1;
        });
      } else if (phaseRef.current === 'running') {
        const attemptStart = attemptStartRef.current;

        if (attemptStart === null) return;

        const elapsedSeconds = Math.floor(
          (Date.now() - attemptStart) / 1000
        );

        const remaining = Math.max(
          0,
          SECONDS_PER_ATTEMPT - elapsedSeconds
        );

        setAttemptTimeLeft(remaining);

        if (remaining <= 0) {
          advanceAttempt(false);
        }
      }
    }, 200);

    return () => clearInterval(timer);
  }, [phase]);

  const viewResults = () => {
    router.push({
      pathname: '/results',
      params: {
        test: 'Vertical Jump',
        jumpHeight: String(bestJump),
        totalJumps: String(jumpCount),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>Vertical Jump Test</Text>

        <Text style={styles.subtitle}>
          Perform up to 5 vertical jumps. You have 10 seconds
          for each attempt.
        </Text>

        <View style={styles.cameraContainer}>
          {!permission ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : !permission.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>
                Camera access needed
              </Text>

              <Text style={styles.permissionText}>
                Allow camera access to start your assessment.
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
              callbackFps={30}
              onLandmark={handlePose}
              onInferenceError={error => {
                setCameraError(error.code);
                setPoseStatus('Pose detection error');
              }}
              onCameraConfigured={() => {
                setCameraError('');
                setPoseStatus('Camera ready - Show your full body');
              }}
            />
          )}
        </View>

        {permission?.granted && (
          <>
            <View style={styles.inputCard}>
              <Text style={styles.statLabel}>YOUR HEIGHT (CM)</Text>

              <TextInput
                style={styles.heightInput}
                keyboardType="numeric"
                value={heightInput}
                onChangeText={setHeightInput}
                editable={phase === 'ready'}
                placeholder="Enter height in cm"
              />
            </View>

            <View style={styles.timerCard}>
              <Text style={styles.timerLabel}>
                {phase === 'countdown'
                  ? 'GET READY'
                  : phase === 'running'
                    ? `ATTEMPT ${attemptNumber} OF ${TOTAL_ATTEMPTS}`
                    : phase === 'completed'
                      ? 'TEST COMPLETED'
                      : 'TIME PER ATTEMPT'}
              </Text>

              <Text style={styles.timerValue}>
                {phase === 'countdown'
                  ? countdown
                  : phase === 'running'
                    ? attemptTimeLeft
                    : SECONDS_PER_ATTEMPT}
                s
              </Text>

              {phase === 'running' && (
                <Text style={styles.timerHint}>
                  {TOTAL_ATTEMPTS - attemptNumber} attempts remaining after this
                </Text>
              )}
            </View>

            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>BEST JUMP</Text>
                <Text style={styles.statValue}>
                  {bestJump > 0 ? bestJump : '--'}
                </Text>
                <Text style={styles.unitText}>cm</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>DETECTED</Text>
                <Text style={styles.statValue}>{jumpCount}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>MISSED</Text>
                <Text style={styles.statValue}>{missedAttempts}</Text>
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

            {phase === 'running' && (
              <View style={styles.debugCard}>
                <Text style={styles.debugTitle}>
                  DETECTION DIAGNOSTICS
                </Text>

                <Text style={styles.debugText}>{debugInfo}</Text>

                <Text style={styles.debugHint}>
                  Takeoff threshold: {(TAKEOFF_RATIO * 100).toFixed(1)}%
                </Text>
              </View>
            )}

            {phase === 'running' && jumpHeight !== null && (
              <View style={styles.resultHighlight}>
                <Text style={styles.resultHighlightTitle}>
                  LAST DETECTED JUMP
                </Text>

                <Text style={styles.resultHighlightValue}>
                  {jumpHeight} cm
                </Text>
              </View>
            )}

            {phase === 'ready' && (
              <Pressable
                style={styles.primaryButton}
                onPress={startTest}
              >
                <Text style={styles.primaryButtonText}>
                  Start Vertical Jump Test
                </Text>
              </Pressable>
            )}

            {(phase === 'running' || phase === 'countdown') && (
              <Pressable
                style={styles.stopButton}
                onPress={finishTest}
              >
                <Text style={styles.primaryButtonText}>
                  Stop Test
                </Text>
              </Pressable>
            )}

            {phase === 'completed' && (
              <View style={styles.reportCard}>
                <Text style={styles.reportTitle}>
                  Your Vertical Jump Report
                </Text>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Best jump height</Text>
                  <Text style={styles.reportValue}>{bestJump} cm</Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Detected jumps</Text>
                  <Text style={styles.reportValue}>{jumpCount}</Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Missed attempts</Text>
                  <Text style={styles.reportValue}>{missedAttempts}</Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>Total attempts</Text>
                  <Text style={styles.reportValue}>{TOTAL_ATTEMPTS}</Text>
                </View>

                <Text style={styles.reportNote}>
                  Jump height is an estimate based on hip landmark
                  movement and entered body height. Validate against
                  a calibrated jump measurement system before formal
                  scoring. A missed attempt does not necessarily mean
                  the athlete did not jump.
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

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Before you begin</Text>
          <Text style={styles.infoText}>• Position your phone sideways to your body.</Text>
          <Text style={styles.infoText}>• Keep your entire body visible.</Text>
          <Text style={styles.infoText}>• Place the camera on a stable surface.</Text>
          <Text style={styles.infoText}>• Stand straight during the countdown.</Text>
          <Text style={styles.infoText}>• Perform one vertical jump per attempt.</Text>
          <Text style={styles.infoText}>• Land safely before the next attempt.</Text>
        </View>

        <Text style={styles.disclaimer}>
          This is a prototype AI-based assessment. Camera angle,
          body movement, landmark accuracy and calibration can
          affect the estimated result.
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
    height: 600,
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
  inputCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    marginTop: 18,
  },
  heightInput: {
    fontSize: 20,
    color: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    paddingVertical: 8,
    marginTop: 8,
  },
  timerCard: {
    backgroundColor: '#FFFFFF',
    padding: 18,
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
    fontSize: 44,
    fontWeight: '900',
    marginTop: 4,
  },
  timerHint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 14,
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
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  unitText: {
    color: '#555555',
    fontSize: 12,
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
  debugCard: {
    backgroundColor: '#EAF0F8',
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  debugTitle: {
    color: '#14213D',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  debugText: {
    color: '#17243A',
    fontSize: 12,
    lineHeight: 18,
  },
  debugHint: {
    color: '#475569',
    fontSize: 11,
    marginTop: 6,
  },
  stopButton: {
    backgroundColor: '#B91C1C',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  resultHighlight: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 14,
  },
  resultHighlightTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  resultHighlightValue: {
    fontSize: 32,
    fontWeight: '900',
    marginTop: 8,
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
    color: '#444444',
    fontSize: 12,
    lineHeight: 18,
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
  },
  infoText: {
    fontSize: 14,
    lineHeight: 21,
    color: '#222222',
  },
  disclaimer: {
    color: '#444444',
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
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
  },
});
