
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { getResults, TestResult } from '../lib/assessmentStore';

function getHeightResults(items: TestResult[]) {
  return items
    .filter(
      item =>
        item.test.toLowerCase() === 'height' &&
        item.unit.toLowerCase() === 'cm'
    )
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}

export default function HistoryScreen() {
  const [items, setItems] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);

      getResults()
        .then(data => {
          if (active) setItems(data);
        })
        .catch(() => {
          if (active) {
            Alert.alert(
              'Could not load history',
              'Please reopen this screen and try again.'
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [])
  );

  const heightResults = useMemo(
    () => getHeightResults(items),
    [items]
  );

  const latestHeight = heightResults[0];
  const previousHeight = heightResults[1];

  const heightChange = previousHeight
    ? latestHeight.value - previousHeight.value
    : null;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()}>
          <Text style={s.back}>‹ Back</Text>
        </Pressable>

        <Text style={s.title}>Assessment History</Text>
        <Text style={s.sub}>
          Your saved test results, newest first.
        </Text>

        <Text style={s.section}>Height Progress</Text>

        {loading ? (
          <ActivityIndicator color="#14213D" />
        ) : latestHeight ? (
          <View style={s.heightCard}>
            <Text style={s.heightLabel}>Latest Height</Text>

            <Text style={s.heightValue}>
              {latestHeight.value} cm
            </Text>

            <Text style={s.muted}>
              {new Date(latestHeight.date).toLocaleDateString()}
            </Text>

            {previousHeight ? (
              <View style={s.comparison}>
                <Text style={s.comparisonTitle}>
                  Previous measurement
                </Text>

                <View style={s.row}>
                  <Text style={s.previousValue}>
                    {previousHeight.value} cm
                  </Text>

                  <Text style={s.changeValue}>
                    {heightChange! > 0 ? '+' : ''}
                    {heightChange!.toFixed(1)} cm
                  </Text>
                </View>

                <Text style={s.muted}>
                  Difference between the two most recent measurements.
                </Text>
              </View>
            ) : (
              <Text style={s.muted}>
                Only one height measurement is saved. Record another
                to compare measurements.
              </Text>
            )}
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.heading}>No height measurements yet</Text>
            <Text style={s.muted}>
              Complete the Height Assessment to start tracking your
              measurements.
            </Text>

            <Pressable
              style={s.smallButton}
              onPress={() => router.push('/height')}
            >
              <Text style={s.buttonText}>
                Start Height Assessment
              </Text>
            </Pressable>
          </View>
        )}

        <Text style={s.section}>All Assessment Records</Text>

        {loading ? (
          <ActivityIndicator color="#14213D" />
        ) : items.length === 0 ? (
          <View style={s.card}>
            <Text style={s.heading}>No saved assessments yet</Text>
            <Text style={s.muted}>
              Complete a test and its result will appear here.
            </Text>
          </View>
        ) : (
          items.map(item => (
            <View style={s.card} key={item.id}>
              <View style={s.row}>
                <Text style={s.heading}>{item.test}</Text>

                <Text style={s.value}>
                  {item.value} {item.unit}
                </Text>
              </View>

              <Text style={s.muted}>
                {new Date(item.date).toLocaleString()}
              </Text>

              {item.details &&
                Object.entries(item.details).map(([k, v]) => (
                  <Text style={s.detail} key={k}>
                    {k}: {v}
                  </Text>
                ))}
            </View>
          ))
        )}

        <Pressable
          style={s.button}
          onPress={() => router.push('/progress')}
        >
          <Text style={s.buttonText}>View Progress</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
    maxWidth: 650,
    width: '100%',
    alignSelf: 'center',
  },
  back: {
    fontSize: 17,
    color: '#14213D',
    marginBottom: 18,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#14213D',
  },
  sub: {
    color: '#64748B',
    marginTop: 6,
    marginBottom: 20,
  },
  section: {
    fontSize: 19,
    fontWeight: '800',
    color: '#14213D',
    marginBottom: 12,
    marginTop: 8,
  },
  heightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  heightLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  heightValue: {
    fontSize: 34,
    fontWeight: '900',
    color: '#14213D',
    marginTop: 8,
  },
  comparison: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 16,
    paddingTop: 15,
  },
  comparisonTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  previousValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
  },
  changeValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#14213D',
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#14213D',
    flexShrink: 1,
  },
  value: {
    fontSize: 17,
    fontWeight: '800',
    color: '#14213D',
  },
  muted: {
    color: '#64748B',
    marginTop: 7,
    lineHeight: 20,
    fontSize: 13,
  },
  detail: {
    color: '#475569',
    marginTop: 5,
  },
  smallButton: {
    backgroundColor: '#14213D',
    padding: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
  },
  button: {
    backgroundColor: '#14213D',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#FFF',
    fontWeight: '700',
  },
});
