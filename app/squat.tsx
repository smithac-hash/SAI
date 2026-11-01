
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

type SquatStage = 'standing' | 'descending' | 'bottom' | 'ascending';
type TestPhase = 'ready' | 'countdown' | 'running' | 'completed';

type PoseFrame = Parameters<
  NonNullable<React.ComponentProps<typeof PoseCameraView>['onLandmark']>
>[0];

const TEST_DURATION = 30;

export default function SquatScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [reps, setReps] = useState(0);
  const [kneeAngle, setKneeAngle] = useState<number | null>(null);
  const [poseStatus, setPoseStatus] = useState('Waiting for pose...');
  const [cameraError, setCameraError] = useState('');

  const [phase, setPhase] = useState<TestPhase>('ready');
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [averageAngle, setAverageAngle] = useState<number | null>(null);

  const stageRef = useRef<SquatStage>('standing');
  const phaseRef = useRef<TestPhase>('ready');
  const startTimeRef = useRef<number | null>(null);
  const angleSumRef = useRef(0);
  const angleCountRef = useRef(0);

  const handlePose = (frame: PoseFrame) => {
    if (phaseRef.current !== 'running') return;

    const leftAngle = getWorldJointAngle(
      { worldLandmarks: frame.worldLandmarks },
      'leftHip',
      'leftKnee',
      'leftAnkle'
    );

    const rightAngle = getWorldJointAngle(
      { worldLandmarks: frame.worldLandmarks },
      'rightHip',
      'rightKnee',
      'rightAnkle'
    );

    const angleResult =
      leftAngle.status === 'available'
        ? leftAngle
        : rightAngle.status === 'available'
          ? rightAngle
          : null;

    if (!angleResult) {
      setPoseStatus('Position your full body in the frame');
      setKneeAngle(null);
      return;
    }

    const angle = angleResult.value;

    setKneeAngle(Math.round(angle));
    setPoseStatus('Pose detected');

    angleSumRef.current += angle;
    angleCountRef.current += 1;

    // Squat repetition detection
    if (angle > 160) {
      if (
        stageRef.current === 'bottom' ||
        stageRef.current === 'ascending'
      ) {
        setReps(previous => previous + 1);
      }

      stageRef.current = 'standing';
    } else if (
      angle < 100 &&
      stageRef.current === 'standing'
    ) {
      stageRef.current = 'bottom';
    } else if (
      angle < 150 &&
      stageRef.current === 'standing'
    ) {
      stageRef.current = 'descending';
    } else if (
      angle < 150 &&
      stageRef.current === 'descending'
    ) {
      if (angle < 100) {
        stageRef.current = 'bottom';
      }
    } else if (
      angle > 110 &&
      angle < 160 &&
      stageRef.current === 'bottom'
    ) {
      stageRef.current = 'ascending';
    }
  };

  const startTest = () => {
    setReps(0);
    setKneeAngle(null);
    setCountdown(3);
    setTimeLeft(TEST_DURATION);
    setElapsedSeconds(0);
    setAverageAngle(null);
    setCameraError('');
    setPoseStatus('Get ready!');

    stageRef.current = 'standing';
    angleSumRef.current = 0;
    angleCountRef.current = 0;
    startTimeRef.current = null;

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

    setAverageAngle(
      angleCountRef.current > 0
        ? Math.round(angleSumRef.current / angleCountRef.current)
        : null
    );

    setPoseStatus('Test completed');

    const completedAverageAngle =
      angleCountRef.current > 0
        ? Math.round(angleSumRef.current / angleCountRef.current)
        : null;

    setAverageAngle(completedAverageAngle);

    void saveResult({
      test: 'Squats',
      value: reps,
      unit: 'reps',
      details: {
        durationSeconds: elapsed,
        repsPerMinute:
          elapsed > 0 ? Math.round((reps / elapsed) * 60) : 0,
        averageKneeAngle: completedAverageAngle ?? 'Unavailable',
      },
    }).catch(error => {
      console.error('Could not save squat results:', error);
    });
  };

  const resetTest = () => {
    phaseRef.current = 'ready';
    setPhase('ready');
    setReps(0);
    setKneeAngle(null);
    setCountdown(3);
    setTimeLeft(TEST_DURATION);
    setElapsedSeconds(0);
    setAverageAngle(null);
    setCameraError('');
    setPoseStatus('Waiting for pose...');
    stageRef.current = 'standing';
    startTimeRef.current = null;
    angleSumRef.current = 0;
    angleCountRef.current = 0;
  };

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
            setPhase('running');
            setPoseStatus('Test in progress!');
            return 0;
          }

          return previous - 1;
        });
      } else if (phaseRef.current === 'running') {
        setTimeLeft(previous => {
          if (previous <= 1) {
            finishTest();
            return 0;
          }

          return previous - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  const repsPerMinute =
    elapsedSeconds > 0
      ? Math.round((reps / elapsedSeconds) * 60)
      : 0;

  // Send the completed squat results to the Results screen
  const viewOverallResults = () => {
    router.push({
      pathname: '/results',
      params: {
        reps: String(reps),
        durationSeconds: String(elapsedSeconds),
        averageKneeAngle:
          averageAngle !== null ? String(averageAngle) : '',
      },
    });
  };

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

        <Text style={styles.title}>Squat Assessment</Text>

        <Text style={styles.subtitle}>
          Complete as many controlled squats as possible in 30 seconds.
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
                Allow camera access to start your squat assessment.
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
                setPoseStatus('Camera ready — detecting pose');
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
                    ? '30'
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
                <Text style={styles.statLabel}>SQUAT REPS</Text>
                <Text style={styles.statValue}>{reps}</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statLabel}>KNEE ANGLE</Text>
                <Text style={styles.statValue}>
                  {kneeAngle !== null ? `${kneeAngle}°` : '--'}
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
                  Your Squat Report
                </Text>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>
                    Total squats
                  </Text>
                  <Text style={styles.reportValue}>{reps}</Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>
                    Time completed
                  </Text>
                  <Text style={styles.reportValue}>
                    {elapsedSeconds} seconds
                  </Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>
                    Reps per minute
                  </Text>
                  <Text style={styles.reportValue}>
                    {repsPerMinute}
                  </Text>
                </View>

                <View style={styles.reportRow}>
                  <Text style={styles.reportLabel}>
                    Average detected knee angle
                  </Text>
                  <Text style={styles.reportValue}>
                    {averageAngle !== null
                      ? `${averageAngle}°`
                      : 'Unavailable'}
                  </Text>
                </View>

                <Text style={styles.reportNote}>
                  These results are estimates from camera-based pose
                  detection. The average knee angle includes detected
                  frames throughout the test, not just the bottom of
                  each squat.
                </Text>

                <Pressable
                  style={styles.primaryButton}
                  onPress={viewOverallResults}
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
            • Position your phone sideways to your body.
          </Text>
          <Text style={styles.infoText}>
            • Keep your entire body visible.
          </Text>
          <Text style={styles.infoText}>
            • Place your phone on a stable surface.
          </Text>
          <Text style={styles.infoText}>
            • Perform controlled squats in a safe space.
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          Squat repetitions are estimated from detected knee angles.
          This is a prototype assessment and needs testing and
          calibration before being used for formal scoring.
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
    color: '#000000',
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
    color: '#333333',
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
    color: '#333333',
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: '#000000',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 8,
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
    color: '#000000',
    marginBottom: 4,
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
    color: '#000000',
    marginBottom: 2,
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
