import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';
import { PoseCameraView } from 'expo-mediapipe-pose';
import { router } from 'expo-router';
import { saveResult } from '../lib/assessmentStore';

type Side = 'left' | 'right';
type Phase = 'ready' | 'countdown' | 'waiting' | 'balancing' | 'completed';
type PoseFrame = Parameters<
  NonNullable<React.ComponentProps<typeof PoseCameraView>['onLandmark']>
>[0];

type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
  presence?: number;
};

const MAX_SECONDS = 60;
const MIN_FOOT_GAP = 0.035; // normalized image height (3.5% of frame)
const MIN_SUPPORT_KNEE_ANGLE = 120;
const VALID_FRAMES_TO_START = 4;
const LOST_FRAMES_TO_STOP = 10;

function angleAtPoint(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const denominator = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (denominator < 0.000001) return 0;
  const cosine = Math.max(-1, Math.min(1, (abx * cbx + aby * cby) / denominator));
  return Math.acos(cosine) * (180 / Math.PI);
}

function isVisible(point?: Landmark): point is Landmark {
  return !!point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    (point.visibility === undefined || point.visibility >= 0.35) &&
    (point.presence === undefined || point.presence >= 0.35);
}

export default function SingleLegBalanceScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [supportSide, setSupportSide] = useState<Side>('left');
  const [phase, setPhase] = useState<Phase>('ready');
  const [countdown, setCountdown] = useState(3);
  const [elapsed, setElapsed] = useState(0);
  const [status, setStatus] = useState('Camera ready — stand facing the camera.');
  const [footGap, setFootGap] = useState<number | null>(null);
  const [kneeAngle, setKneeAngle] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const phaseRef = useRef<Phase>('ready');
  const sideRef = useRef<Side>('left');
  const startTimeRef = useRef<number | null>(null);
  const validFramesRef = useRef(0);
  const lostFramesRef = useRef(0);
  const savedRef = useRef(false);

  const finishTest = (reason: 'manual' | 'lost' | 'maximum' = 'manual') => {
    if (phaseRef.current === 'ready' || phaseRef.current === 'completed') return;

    const startTime = startTimeRef.current;
    if (startTime === null) {
      // Do not create misleading zero-second records when no valid pose was found.
      phaseRef.current = 'ready';
      setPhase('ready');
      setStatus('No balance position was detected. Move fully into view and try again.');
      validFramesRef.current = 0;
      lostFramesRef.current = 0;
      return;
    }

    if (savedRef.current) return;
    savedRef.current = true;

    const seconds = Math.min(MAX_SECONDS, Math.max(0, (Date.now() - startTime) / 1000));
    const finalSeconds = Math.round(seconds * 10) / 10;

    phaseRef.current = 'completed';
    setPhase('completed');
    setElapsed(finalSeconds);
    setStatus(
      reason === 'maximum'
        ? 'Maximum test time reached.'
        : reason === 'lost'
          ? 'Balance position was lost. Your time has been recorded.'
          : 'Test stopped. Your time has been recorded.',
    );
    setSaving(true);

    void saveResult({
      test: 'Single-Leg Balance',
      value: finalSeconds,
      unit: 'seconds',
      details: {
        supportLeg: sideRef.current,
        raisedLeg: sideRef.current === 'left' ? 'right' : 'left',
        measurementMethod: 'Camera-based MediaPipe image-landmark estimate',
        maximumTestDurationSeconds: MAX_SECONDS,
      },
    }).catch(error => {
      console.error('Could not save single-leg balance result:', error);
      setStatus('The test finished, but the result could not be saved.');
    }).finally(() => setSaving(false));
  };

  const handlePose = (frame: PoseFrame) => {
    const currentPhase = phaseRef.current;
    if (currentPhase !== 'waiting' && currentPhase !== 'balancing') return;

    // Use normalized image landmarks (0..1), not world-coordinate Y.
    // In image coordinates, a smaller Y value means a point is higher in the frame.
    const points = frame.landmarks as unknown as Landmark[] | undefined;
    if (!Array.isArray(points) || points.length < 29) {
      setStatus('Pose not found — keep your full body visible.');
      if (currentPhase === 'balancing') {
        lostFramesRef.current += 1;
        if (lostFramesRef.current >= LOST_FRAMES_TO_STOP) finishTest('lost');
      }
      return;
    }

    // MediaPipe landmark indices: hips 23/24, knees 25/26, ankles 27/28.
    const leftHip = points[23];
    const rightHip = points[24];
    const leftKnee = points[25];
    const rightKnee = points[26];
    const leftAnkle = points[27];
    const rightAnkle = points[28];

    if (![leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle].every(isVisible)) {
      setStatus('Keep both hips, knees and ankles visible.');
      if (currentPhase === 'balancing') {
        lostFramesRef.current += 1;
        if (lostFramesRef.current >= LOST_FRAMES_TO_STOP) finishTest('lost');
      }
      return;
    }

    const isLeftSupport = sideRef.current === 'left';
    const supportHip = isLeftSupport ? leftHip : rightHip;
    const supportKnee = isLeftSupport ? leftKnee : rightKnee;
    const supportAnkle = isLeftSupport ? leftAnkle : rightAnkle;
    const raisedAnkle = isLeftSupport ? rightAnkle : leftAnkle;

    // Positive gap means the raised ankle is higher on the image.
    const gap = supportAnkle.y - raisedAnkle.y;
    const angle = angleAtPoint(supportHip, supportKnee, supportAnkle);
    setFootGap(Math.round(gap * 1000) / 10);
    setKneeAngle(Math.round(angle));

    const footIsRaised = gap >= MIN_FOOT_GAP;
    const supportLegIsStraightEnough = angle >= MIN_SUPPORT_KNEE_ANGLE;
    const validBalance = footIsRaised && supportLegIsStraightEnough;

    if (!validBalance) {
      validFramesRef.current = 0;

      if (currentPhase === 'waiting') {
        if (!footIsRaised) {
          setStatus(`Lift your ${isLeftSupport ? 'right' : 'left'} foot clearly off the floor.`);
        } else {
          setStatus('Keep the standing leg straighter and hold still.');
        }
        return;
      }

      lostFramesRef.current += 1;
      setStatus('Balance position moving — regain it and hold steady.');
      if (lostFramesRef.current >= LOST_FRAMES_TO_STOP) finishTest('lost');
      return;
    }

    lostFramesRef.current = 0;

    if (currentPhase === 'waiting') {
      validFramesRef.current += 1;
      setStatus(`Balance pose detected (${validFramesRef.current}/${VALID_FRAMES_TO_START}) — hold still.`);
      if (validFramesRef.current >= VALID_FRAMES_TO_START) {
        startTimeRef.current = Date.now();
        phaseRef.current = 'balancing';
        setPhase('balancing');
        setElapsed(0);
        setStatus('Timing started — keep your raised foot off the floor.');
      }
    } else {
      setStatus('Balance detected — keep holding.');
    }
  };

  const startTest = () => {
    sideRef.current = supportSide;
    phaseRef.current = 'countdown';
    setPhase('countdown');
    setCountdown(3);
    setElapsed(0);
    setFootGap(null);
    setKneeAngle(null);
    setCameraError('');
    setStatus('Get ready. Face the camera with your full body visible.');
    startTimeRef.current = null;
    validFramesRef.current = 0;
    lostFramesRef.current = 0;
    savedRef.current = false;
  };

  const resetTest = () => {
    phaseRef.current = 'ready';
    setPhase('ready');
    setCountdown(3);
    setElapsed(0);
    setFootGap(null);
    setKneeAngle(null);
    setStatus('Camera ready — stand facing the camera.');
    startTimeRef.current = null;
    validFramesRef.current = 0;
    lostFramesRef.current = 0;
    savedRef.current = false;
  };

  useEffect(() => {
    if (phase !== 'countdown') return;

    const timer = setInterval(() => {
      setCountdown(value => {
        if (value <= 1) {
          clearInterval(timer);
          phaseRef.current = 'waiting';
          setPhase('waiting');
          setStatus(`Stand on your ${sideRef.current} leg and lift the other foot.`);
          return 0;
        }
        return value - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'balancing') return;

    const timer = setInterval(() => {
      if (startTimeRef.current === null) return;
      const seconds = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(Math.min(MAX_SECONDS, Math.round(seconds * 10) / 10));
      if (seconds >= MAX_SECONDS) finishTest('maximum');
    }, 100);

    return () => clearInterval(timer);
  }, [phase]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>

        <Text style={styles.title}>Single-Leg Balance</Text>
        <Text style={styles.subtitle}>
          Face the camera, stand on one leg and lift the other foot. The timer starts only after SAI detects the balance position.
        </Text>

        <View style={styles.cameraBox}>
          {!permission ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : !permission.granted ? (
            <View style={styles.permission}>
              <Text style={styles.cameraIcon}>📷</Text>
              <Text style={styles.permissionTitle}>Camera access needed</Text>
              <Text style={styles.permissionText}>Allow camera access to start the balance assessment.</Text>
              <Pressable style={styles.primary} onPress={requestPermission}>
                <Text style={styles.primaryText}>Allow Camera</Text>
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
                minVisibility: 0.5,
                bodyParts: ['torso', 'leftLeg', 'rightLeg'],
              }}
              onLandmark={handlePose}
              onInferenceError={error => {
                setCameraError(error.code);
                setStatus('Pose detection error');
              }}
              onCameraConfigured={() => {
                setCameraError('');
                setStatus('Camera ready — stand facing the camera.');
              }}
            />
          )}
        </View>

        {permission?.granted && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Choose your standing leg</Text>
              <Text style={styles.help}>
                Keep the selected leg on the floor and lift the opposite foot. Test both sides separately.
              </Text>
              <View style={styles.row}>
                {(['left', 'right'] as Side[]).map(side => (
                  <Pressable
                    key={side}
                    disabled={phase !== 'ready'}
                    style={[
                      styles.sideButton,
                      supportSide === side && styles.sideSelected,
                      phase !== 'ready' && styles.disabled,
                    ]}
                    onPress={() => setSupportSide(side)}
                  >
                    <Text style={[styles.sideText, supportSide === side && styles.sideTextSelected]}>
                      Stand on {side === 'left' ? 'Left' : 'Right'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.timerCard}>
              <Text style={styles.timerLabel}>
                {phase === 'countdown' ? 'GET READY' :
                  phase === 'waiting' ? 'DETECTING BALANCE' :
                    phase === 'completed' ? 'FINAL BALANCE TIME' :
                      phase === 'balancing' ? 'BALANCE TIME' : 'BALANCE TIME'}
              </Text>
              <Text style={styles.timerValue}>
                {phase === 'countdown' ? countdown : `${elapsed.toFixed(1)}s`}
              </Text>
              <Text style={styles.help}>Maximum test time: {MAX_SECONDS} seconds</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.stat, { flex: 1 }]}>
                <Text style={styles.statLabel}>FOOT HEIGHT GAP</Text>
                <Text style={styles.statValue}>{footGap === null ? '--' : `${footGap}%`}</Text>
              </View>
              <View style={[styles.stat, { flex: 1 }]}>
                <Text style={styles.statLabel}>STANDING KNEE</Text>
                <Text style={styles.statValue}>{kneeAngle === null ? '--' : `${kneeAngle}°`}</Text>
              </View>
            </View>

            <View style={styles.status}>
              <View style={[styles.dot, cameraError ? styles.waitingDot : styles.readyDot]} />
              <Text style={styles.statusText}>
                {cameraError ? `${status}: ${cameraError}` : status}
              </Text>
            </View>

            {phase === 'ready' && (
              <Pressable style={styles.primary} onPress={startTest}>
                <Text style={styles.primaryText}>Start Balance Test</Text>
              </Pressable>
            )}

            {(phase === 'countdown' || phase === 'waiting' || phase === 'balancing') && (
              <Pressable style={styles.stop} onPress={() => finishTest('manual')}>
                <Text style={styles.primaryText}>Stop Test</Text>
              </Pressable>
            )}

            {phase === 'completed' && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Balance Test Result</Text>
                <Text style={styles.result}>{elapsed.toFixed(1)} seconds</Text>
                <Text style={styles.help}>
                  Standing leg: {supportSide.toUpperCase()}. {saving ? 'Saving result...' : 'Result saved to Results and History.'}
                </Text>
                <Pressable style={styles.primary} disabled={saving} onPress={resetTest}>
                  <Text style={styles.primaryText}>Test Again</Text>
                </Pressable>
                <Pressable style={styles.secondary} onPress={() => router.push('/results')}>
                  <Text style={styles.secondaryText}>View Results</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Before you begin</Text>
          <Text style={styles.help}>• Place your phone on a stable surface at about waist height.</Text>
          <Text style={styles.help}>• Stand facing the camera with your full body visible.</Text>
          <Text style={styles.help}>• Keep both feet visible at the start.</Text>
          <Text style={styles.help}>• Stand near a wall or sturdy support for safety.</Text>
          <Text style={styles.help}>• Lift one foot clearly off the floor without hopping.</Text>
          <Text style={styles.help}>• A YouTube video on another screen may be detected, but its timing is only a demonstration, not your personal balance score.</Text>
        </View>

        <Text style={styles.disclaimer}>
          Balance time is estimated from 2D pose landmarks and application-defined thresholds. Camera angle, distance, occlusion and pose-estimation errors can affect results. This is not a clinical balance test.
        </Text>

        <Pressable style={styles.secondary} onPress={() => router.back()}>
          <Text style={styles.secondaryText}>Return to Assessment</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7FB' },
  container: { padding: 20, paddingBottom: 36, width: '100%', maxWidth: 650, alignSelf: 'center' },
  back: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 12 },
  backText: { color: '#14213D', fontSize: 16, fontWeight: '600' },
  title: { color: '#14213D', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#64748B', fontSize: 15, lineHeight: 22, marginBottom: 20 },
  cameraBox: { width: '100%', height: 390, backgroundColor: '#17243A', borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  camera: { width: '100%', height: '100%' },
  permission: { alignItems: 'center', padding: 24, width: '100%' },
  cameraIcon: { fontSize: 42, marginBottom: 12 },
  permissionTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  permissionText: { color: '#FFFFFF', fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 20 },
  card: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, marginTop: 18, gap: 10 },
  cardTitle: { color: '#14213D', fontSize: 18, fontWeight: '800' },
  help: { color: '#64748B', fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 12, marginTop: 10 },
  sideButton: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  sideSelected: { backgroundColor: '#14213D', borderColor: '#14213D' },
  disabled: { opacity: 0.65 },
  sideText: { color: '#14213D', fontSize: 13, fontWeight: '700' },
  sideTextSelected: { color: '#FFFFFF' },
  timerCard: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 14 },
  timerLabel: { color: '#64748B', fontSize: 13, fontWeight: '800' },
  timerValue: { color: '#14213D', fontSize: 44, fontWeight: '900', marginTop: 4 },
  stat: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, alignItems: 'center' },
  statLabel: { color: '#64748B', fontSize: 11, fontWeight: '800' },
  statValue: { color: '#14213D', fontSize: 25, fontWeight: '800', marginTop: 8 },
  status: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 14, marginTop: 14, gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  readyDot: { backgroundColor: '#16A34A' },
  waitingDot: { backgroundColor: '#F59E0B' },
  statusText: { color: '#14213D', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  primary: { backgroundColor: '#14213D', paddingHorizontal: 24, paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  stop: { backgroundColor: '#B91C1C', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  result: { color: '#14213D', fontSize: 36, fontWeight: '900' },
  secondary: { marginTop: 16, paddingVertical: 15, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center' },
  secondaryText: { color: '#14213D', fontSize: 15, fontWeight: '700' },
  disclaimer: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 16, textAlign: 'center' },
});
