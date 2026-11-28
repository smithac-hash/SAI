
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import {
  apiRequest,
  clearAuth,
  getAuthUser,
  AuthUser,
} from '../../lib/api';
import { getResults } from '../../lib/assessmentStore';

type Tab = 'Home' | 'Assessments' | 'Messages' | 'Requests' | 'Profile';

type ConnectionRequest = {
  _id: string;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  coach: {
    _id: string;
    name: string;
    email: string;
    organization?: string;
    specialization?: string;
    bio?: string;
  } | null;
};

type Conversation = {
  user: {
    _id: string;
    name: string;
    role: string;
  };
  lastMessage?: {
    text: string;
    createdAt: string;
    sender: string | { _id: string };
  } | null;
};

const COLORS = {
  navy: '#14213D',
  blue: '#2563EB',
  lightBlue: '#DBEAFE',
  background: '#F5F7FA',
  white: '#FFFFFF',
  text: '#334155',
  muted: '#64748B',
  border: '#E2E8F0',
  green: '#15803D',
  lightGreen: '#DCFCE7',
  red: '#B91C1C',
  lightRed: '#FEE2E2',
};

const TABS: { name: Tab; icon: string }[] = [
  { name: 'Home', icon: '⌂' },
  { name: 'Assessments', icon: '▤' },
  { name: 'Messages', icon: '✉' },
  { name: 'Requests', icon: '♧' },
  { name: 'Profile', icon: '○' },
];

export default function AthleteDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('Home');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [discoverable, setDiscoverable] = useState(false);

  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [localResults, setLocalResults] = useState<any[]>([]);
  const [updatingRequest, setUpdatingRequest] = useState<string | null>(null);

  // Load athlete profile.
  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const current = await getAuthUser();

        if (!mounted) return;

        setUser(current);
        setDiscoverable(Boolean(current?.discoverable));
      } catch {
        if (mounted) {
          Alert.alert('Error', 'Could not load your profile.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  // Load requests, conversations and local results.
  const loadDashboardData = useCallback(async () => {
    setRequestsLoading(true);

    try {
      const [requestData, conversationData, results] = await Promise.all([
        apiRequest<{ requests: ConnectionRequest[] }>(
          '/api/athletes/contact-requests'
        ),
        apiRequest<{ conversations: Conversation[] }>(
          '/api/messages/conversations'
        ),
        getResults(),
      ]);

      setRequests(requestData.requests || []);
      setConversations(conversationData.conversations || []);
      setLocalResults(Array.isArray(results) ? results : []);
    } catch (error) {
      Alert.alert(
        'Could not load updates',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const pendingRequests = requests.filter(
    request => request.status === 'pending'
  );

  const acceptedRequests = requests.filter(
    request => request.status === 'accepted'
  );

  // Update profile visibility.
  const updateDiscoverability = async (value: boolean) => {
    const previousValue = discoverable;
    setDiscoverable(value);

    try {
      await apiRequest('/api/athletes/discoverability', {
        method: 'PATCH',
        body: { discoverable: value },
      });

      setUser(current =>
        current ? { ...current, discoverable: value } : current
      );

      Alert.alert(
        'Profile updated',
        value
          ? 'Coaches can now discover your athlete profile.'
          : 'Your athlete profile is now private.'
      );
    } catch (error) {
      setDiscoverable(previousValue);

      Alert.alert(
        'Could not update setting',
        error instanceof Error ? error.message : 'Please try again.'
      );
    }
  };

  // Sync assessment results.
  const syncResults = async () => {
    setSyncing(true);

    try {
      const results = await getResults();

      const response = await apiRequest<{
        message: string;
        synced: number;
      }>('/api/athletes/results/sync', {
        method: 'POST',
        body: { results },
      });

      Alert.alert(
        'Sync complete',
        `${response.synced} assessment results synced to your account.`
      );

      await loadDashboardData();
    } catch (error) {
      Alert.alert(
        'Sync failed',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSyncing(false);
    }
  };

  // Accept or decline a connection request.
  const respondToRequest = (
    requestId: string,
    status: 'accepted' | 'declined'
  ) => {
    Alert.alert(
      status === 'accepted' ? 'Accept connection?' : 'Decline request?',
      `Are you sure you want to ${status} this coach's request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'accepted' ? 'Accept' : 'Decline',
          style: status === 'declined' ? 'destructive' : 'default',
          onPress: async () => {
            setUpdatingRequest(requestId);

            try {
              await apiRequest(
                `/api/athletes/contact-requests/${requestId}`,
                {
                  method: 'PATCH',
                  body: { status },
                }
              );

              await loadDashboardData();

              Alert.alert(
                'Success',
                status === 'accepted'
                  ? 'Connection accepted. You can now message this coach.'
                  : 'Connection request declined.'
              );
            } catch (error) {
              Alert.alert(
                'Update failed',
                error instanceof Error ? error.message : 'Please try again.'
              );
            } finally {
              setUpdatingRequest(null);
            }
          },
        },
      ]
    );
  };

  const openChat = (conversation: Conversation) => {
    router.push({
      pathname: '/chat/[userId]',
      params: {
        userId: conversation.user._id,
        name: conversation.user.name,
      },
    } as any);
  };

  const logout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          router.replace('/account' as any);
        },
      },
    ]);
  };

  const navigateToAssessments = () => {
    router.push('/assessment' as any);
  };

  const navigateToHistory = () => {
    router.push('/history' as any);
  };

  const SectionHeading = ({
    title,
    subtitle,
  }: {
    title: string;
    subtitle?: string;
  }) => (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle && (
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      )}
    </View>
  );

  const EmptyState = ({
    icon,
    title,
    description,
  }: {
    icon: string;
    title: string;
    description: string;
  }) => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );

  // HOME TAB
  const renderHome = () => (
    <>
      <View style={styles.welcomeHeader}>
        <View>
          <Text style={styles.kicker}>ATHLETE PORTAL</Text>
          <Text style={styles.welcomeTitle}>
            Hello, {user?.name?.split(' ')[0] || 'Athlete'}!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Track your performance and stay connected with coaches.
          </Text>
        </View>

        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>YOUR SPORTS JOURNEY</Text>
        <Text style={styles.heroTitle}>
          Every assessment is a step forward.
        </Text>
        <Text style={styles.heroDescription}>
          Keep testing, track your progress and make your talent visible to coaches.
        </Text>

        <Pressable style={styles.heroButton} onPress={navigateToAssessments}>
          <Text style={styles.heroButtonText}>Start an assessment →</Text>
        </Pressable>
      </View>

      <SectionHeading
        title="Your overview"
        subtitle="A quick look at your athlete account."
      />

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={styles.statIconBox}>
            <Text style={styles.statIcon}>📊</Text>
          </View>
          <Text style={styles.statNumber}>{localResults.length}</Text>
          <Text style={styles.statLabel}>Assessments saved</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconBox}>
            <Text style={styles.statIcon}>🤝</Text>
          </View>
          <Text style={styles.statNumber}>{acceptedRequests.length}</Text>
          <Text style={styles.statLabel}>Coach connections</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconBox}>
            <Text style={styles.statIcon}>📩</Text>
          </View>
          <Text style={styles.statNumber}>{pendingRequests.length}</Text>
          <Text style={styles.statLabel}>Pending requests</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIconBox}>
            <Text style={styles.statIcon}>💬</Text>
          </View>
          <Text style={styles.statNumber}>{conversations.length}</Text>
          <Text style={styles.statLabel}>Conversations</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeadingRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Connection requests</Text>
            <Text style={styles.cardDescription}>
              Coaches interested in connecting with you.
            </Text>
          </View>

          {pendingRequests.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{pendingRequests.length}</Text>
            </View>
          )}
        </View>

        {pendingRequests.length === 0 ? (
          <Text style={styles.mutedText}>You have no pending requests.</Text>
        ) : (
          pendingRequests.slice(0, 2).map(request => (
            <View key={request._id} style={styles.miniRequest}>
              <View style={styles.coachAvatar}>
                <Text style={styles.coachAvatarText}>
                  {request.coach?.name?.charAt(0)?.toUpperCase() || 'C'}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>
                  {request.coach?.name || 'Coach'}
                </Text>
                <Text style={styles.personSubtitle}>
                  {request.coach?.organization || 'Coach connection request'}
                </Text>
              </View>

              <Pressable
                onPress={() => setActiveTab('Requests')}
                style={styles.smallLinkButton}
              >
                <Text style={styles.smallLinkText}>View</Text>
              </Pressable>
            </View>
          ))
        )}

        {pendingRequests.length > 2 && (
          <Pressable
            onPress={() => setActiveTab('Requests')}
            style={styles.textButton}
          >
            <Text style={styles.textButtonLabel}>
              View all {pendingRequests.length} requests →
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick actions</Text>
        <Text style={styles.cardDescription}>
          Access your assessments and performance reports.
        </Text>

        <Pressable style={styles.actionRow} onPress={navigateToAssessments}>
          <View style={styles.actionIcon}><Text>🏃</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Start an assessment</Text>
            <Text style={styles.actionDescription}>
              Measure your sports performance.
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Pressable style={styles.actionRow} onPress={navigateToHistory}>
          <View style={styles.actionIcon}><Text>📈</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Assessment history</Text>
            <Text style={styles.actionDescription}>
              Review your saved results.
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </View>
    </>
  );

  // ASSESSMENTS TAB
  const renderAssessments = () => (
    <>
      <SectionHeading
        title="My assessments"
        subtitle="Measure your abilities and follow your progress."
      />

      <View style={styles.assessmentHero}>
        <Text style={styles.assessmentHeroIcon}>🏅</Text>
        <Text style={styles.assessmentHeroTitle}>
          Ready to test your performance?
        </Text>
        <Text style={styles.assessmentHeroDescription}>
          Complete the available sports assessments and save your results to your athlete profile.
        </Text>

        <Pressable style={styles.primaryButton} onPress={navigateToAssessments}>
          <Text style={styles.primaryButtonText}>Explore assessments</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your assessment records</Text>
        <Text style={styles.cardDescription}>Results saved on this device.</Text>

        <View style={styles.resultSummary}>
          <View>
            <Text style={styles.resultCount}>{localResults.length}</Text>
            <Text style={styles.resultCountLabel}>Saved results</Text>
          </View>

          <Pressable style={styles.outlineButton} onPress={navigateToHistory}>
            <Text style={styles.outlineButtonText}>View history</Text>
          </Pressable>
        </View>

        {localResults.length === 0 ? (
          <EmptyState
            icon="📋"
            title="No assessments yet"
            description="Complete your first assessment to see your results here."
          />
        ) : (
          <Text style={styles.mutedText}>
            Your saved results are available in Assessment History.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync your results</Text>
        <Text style={styles.cardDescription}>
          Sync your locally saved assessment results with your SAI athlete account so discoverable coaches can review them.
        </Text>

        <Pressable
          style={[styles.primaryButton, syncing && styles.disabledButton]}
          onPress={syncResults}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Sync assessment results</Text>
          )}
        </Pressable>
      </View>
    </>
  );

  // MESSAGES TAB
  const renderMessages = () => (
    <>
      <SectionHeading
        title="Messages"
        subtitle="Stay in touch with your connected coaches."
      />

      <View style={styles.card}>
        <View style={styles.cardHeadingRow}>
          <Text style={styles.cardTitle}>Your conversations</Text>
          <Pressable onPress={loadDashboardData} disabled={requestsLoading}>
            <Text style={styles.refreshText}>
              {requestsLoading ? 'Refreshing...' : '↻ Refresh'}
            </Text>
          </Pressable>
        </View>

        {requestsLoading && conversations.length === 0 ? (
          <ActivityIndicator color={COLORS.navy} style={{ margin: 24 }} />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon="💬"
            title="No conversations yet"
            description="Once you accept a coach's connection request, your conversations will appear here."
          />
        ) : (
          conversations.map(conversation => (
            <Pressable
              key={conversation.user._id}
              style={styles.conversationRow}
              onPress={() => openChat(conversation)}
            >
              <View style={styles.conversationAvatar}>
                <Text style={styles.conversationAvatarText}>
                  {conversation.user.name?.charAt(0)?.toUpperCase() || 'C'}
                </Text>
              </View>

              <View style={styles.conversationDetails}>
                <Text style={styles.personName}>{conversation.user.name}</Text>
                <Text style={styles.conversationPreview} numberOfLines={1}>
                  {conversation.lastMessage?.text || 'Start a conversation'}
                </Text>
              </View>

              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))
        )}
      </View>
    </>
  );

  // REQUESTS TAB
  const renderRequests = () => (
    <>
      <SectionHeading
        title="Connection requests"
        subtitle="Review coaches who want to connect with you."
      />

      <View style={styles.requestSummary}>
        <View>
          <Text style={styles.requestSummaryNumber}>{pendingRequests.length}</Text>
          <Text style={styles.requestSummaryLabel}>Pending requests</Text>
        </View>

        <Pressable onPress={loadDashboardData} disabled={requestsLoading}>
          <Text style={styles.refreshText}>
            {requestsLoading ? 'Refreshing...' : '↻ Refresh'}
          </Text>
        </Pressable>
      </View>

      {requestsLoading && requests.length === 0 ? (
        <ActivityIndicator color={COLORS.navy} style={{ margin: 30 }} />
      ) : pendingRequests.length === 0 ? (
        <View style={styles.card}>
          <EmptyState
            icon="🤝"
            title="No pending requests"
            description="New coach connection requests will appear here."
          />
        </View>
      ) : (
        pendingRequests.map(request => (
          <View key={request._id} style={styles.card}>
            <View style={styles.requestPersonRow}>
              <View style={styles.coachAvatarLarge}>
                <Text style={styles.coachAvatarLargeText}>
                  {request.coach?.name?.charAt(0)?.toUpperCase() || 'C'}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{request.coach?.name || 'Coach'}</Text>
                <Text style={styles.personSubtitle}>
                  {request.coach?.organization || 'Coach'}
                </Text>
              </View>

              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Pending</Text>
              </View>
            </View>

            {!!request.coach?.specialization && (
              <Text style={styles.requestInfo}>
                Specialization: {request.coach.specialization}
              </Text>
            )}

            {!!request.coach?.email && (
              <Text style={styles.requestInfo}>{request.coach.email}</Text>
            )}

            {!!request.message && (
              <View style={styles.messageBox}>
                <Text style={styles.messageLabel}>MESSAGE FROM COACH</Text>
                <Text style={styles.messageText}>{request.message}</Text>
              </View>
            )}

            <View style={styles.requestActions}>
              <Pressable
                style={[
                  styles.acceptButton,
                  updatingRequest !== null && styles.disabledButton,
                ]}
                disabled={updatingRequest !== null}
                onPress={() => respondToRequest(request._id, 'accepted')}
              >
                {updatingRequest === request._id ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.acceptButtonText}>Accept</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.declineButton}
                disabled={updatingRequest !== null}
                onPress={() => respondToRequest(request._id, 'declined')}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {acceptedRequests.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connected coaches</Text>
          <Text style={styles.cardDescription}>
            Coaches whose connection requests you have accepted.
          </Text>

          {acceptedRequests.map(request => (
            <View key={request._id} style={styles.miniRequest}>
              <View style={styles.coachAvatar}>
                <Text style={styles.coachAvatarText}>
                  {request.coach?.name?.charAt(0)?.toUpperCase() || 'C'}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{request.coach?.name || 'Coach'}</Text>
                <Text style={styles.personSubtitle}>
                  {request.coach?.organization || 'Connected coach'}
                </Text>
              </View>

              <View style={styles.acceptedBadge}>
                <Text style={styles.acceptedBadgeText}>Connected</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </>
  );

  // PROFILE TAB
  const renderProfile = () => (
    <>
      <SectionHeading
        title="My profile"
        subtitle="Manage your athlete account and visibility."
      />

      <View style={styles.profileCard}>
        <View style={styles.largeProfileAvatar}>
          <Text style={styles.largeProfileAvatarText}>
            {user?.name?.charAt(0)?.toUpperCase() || 'A'}
          </Text>
        </View>

        <Text style={styles.profileName}>{user?.name || 'Athlete'}</Text>
        <Text style={styles.profileEmail}>{user?.email || ''}</Text>

        <View style={styles.athleteBadge}>
          <Text style={styles.athleteBadgeText}>ATHLETE ACCOUNT</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Profile visibility</Text>
        <Text style={styles.cardDescription}>
          Allow coaches using SAI to discover your athlete profile and view your synced assessment results.
        </Text>

        <View style={styles.visibilityRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>
              {discoverable ? 'Visible to coaches' : 'Private profile'}
            </Text>
            <Text style={styles.actionDescription}>
              {discoverable
                ? 'Coaches can discover your profile.'
                : 'Your profile is not discoverable by coaches.'}
            </Text>
          </View>

          <Switch
            value={discoverable}
            onValueChange={updateDiscoverability}
            trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
            thumbColor={discoverable ? COLORS.blue : '#F8FAFC'}
          />
        </View>

        <Text style={styles.smallNote}>
          You can change this setting whenever you want.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account overview</Text>

        <View style={styles.profileInfoRow}>
          <Text style={styles.profileInfoLabel}>Account type</Text>
          <Text style={styles.profileInfoValue}>Athlete</Text>
        </View>

        <View style={styles.profileInfoRow}>
          <Text style={styles.profileInfoLabel}>Saved assessments</Text>
          <Text style={styles.profileInfoValue}>{localResults.length}</Text>
        </View>

        <View style={styles.profileInfoRow}>
          <Text style={styles.profileInfoLabel}>Coach connections</Text>
          <Text style={styles.profileInfoValue}>{acceptedRequests.length}</Text>
        </View>
      </View>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>Log out</Text>
      </Pressable>
    </>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'Home':
        return renderHome();
      case 'Assessments':
        return renderAssessments();
      case 'Messages':
        return renderMessages();
      case 'Requests':
        return renderRequests();
      case 'Profile':
        return renderProfile();
      default:
        return renderHome();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.navy} />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safe}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.screen}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {renderActiveTab()}
        </ScrollView>

        <View style={styles.bottomNavigation}>
          {TABS.map(tab => {
            const selected = activeTab === tab.name;

            return (
              <Pressable
                key={tab.name}
                style={styles.navItem}
                onPress={() => setActiveTab(tab.name)}
                hitSlop={6}
                android_ripple={{
                  color: '#DBEAFE',
                  borderless: false,
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={tab.name}
              >
                <View
                  style={[
                    styles.navIconContainer,
                    selected && styles.navIconSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.navIcon,
                      selected && styles.navIconActive,
                    ]}
                  >
                    {tab.icon}
                  </Text>

                  {tab.name === 'Requests' && pendingRequests.length > 0 && (
                    <View style={styles.navNotification}>
                      <Text style={styles.navNotificationText}>
                        {pendingRequests.length > 9
                          ? '9+'
                          : pendingRequests.length}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    styles.navLabel,
                    selected && styles.navLabelActive,
                  ]}
                >
                  {tab.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screen: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: COLORS.muted,
    marginTop: 12,
    fontSize: 14,
  },

  // Header
  welcomeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 22,
  },
  kicker: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  welcomeTitle: {
    color: COLORS.navy,
    fontSize: 27,
    fontWeight: '900',
    marginTop: 7,
  },
  welcomeSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 260,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: COLORS.navy,
    fontSize: 20,
    fontWeight: '900',
  },

  // Hero
  heroCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 20,
    padding: 22,
    marginBottom: 26,
  },
  heroEyebrow: {
    color: '#BFDBFE',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 30,
    marginTop: 12,
  },
  heroDescription: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 9,
  },
  heroButton: {
    backgroundColor: COLORS.white,
    alignSelf: 'flex-start',
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },
  heroButtonText: {
    color: COLORS.navy,
    fontWeight: '800',
    fontSize: 13,
  },

  // Sections and cards
  sectionHeading: {
    marginTop: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.navy,
    fontSize: 21,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  cardHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '900',
  },
  cardDescription: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 10,
  },
  mutedText: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 14,
  },
  countBadge: {
    backgroundColor: COLORS.lightBlue,
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: {
    color: COLORS.blue,
    fontWeight: '900',
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 17,
  },
  statNumber: {
    color: COLORS.navy,
    fontSize: 25,
    fontWeight: '900',
    marginTop: 12,
  },
  statLabel: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 3,
  },

  // People and requests
  miniRequest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  coachAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E8EEF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachAvatarText: {
    color: COLORS.navy,
    fontWeight: '900',
    fontSize: 16,
  },
  personName: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '800',
  },
  personSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },
  smallLinkButton: {
    backgroundColor: COLORS.lightBlue,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  smallLinkText: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '800',
  },
  textButton: {
    paddingTop: 14,
  },
  textButtonLabel: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: '800',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pendingBadgeText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '800',
  },
  acceptedBadge: {
    backgroundColor: COLORS.lightGreen,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },
  acceptedBadgeText: {
    color: COLORS.green,
    fontSize: 10,
    fontWeight: '800',
  },
  requestPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 12,
  },
  coachAvatarLarge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachAvatarLargeText: {
    color: COLORS.navy,
    fontSize: 19,
    fontWeight: '900',
  },
  requestInfo: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },
  messageBox: {
    backgroundColor: '#F1F5F9',
    padding: 12,
    borderRadius: 10,
    marginTop: 13,
  },
  messageLabel: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  messageText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  acceptButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: COLORS.green,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButtonText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  declineButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButtonText: {
    color: COLORS.red,
    fontWeight: '800',
  },
  requestSummary: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 17,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestSummaryNumber: {
    color: COLORS.navy,
    fontSize: 26,
    fontWeight: '900',
  },
  requestSummaryLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },
  refreshText: {
    color: COLORS.blue,
    fontWeight: '800',
    fontSize: 12,
  },

  // Quick actions
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  actionDescription: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
  chevron: {
    color: '#94A3B8',
    fontSize: 25,
    fontWeight: '400',
  },

  // Assessment tab
  assessmentHero: {
    backgroundColor: '#EAF2FF',
    borderRadius: 17,
    padding: 20,
    alignItems: 'flex-start',
    marginBottom: 17,
  },
  assessmentHeroIcon: {
    fontSize: 34,
    marginBottom: 12,
  },
  assessmentHeroTitle: {
    color: COLORS.navy,
    fontSize: 19,
    fontWeight: '900',
  },
  assessmentHeroDescription: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
  },
  primaryButton: {
    minHeight: 48,
    backgroundColor: COLORS.navy,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 16,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  resultSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    marginTop: 6,
  },
  resultCount: {
    color: COLORS.navy,
    fontSize: 28,
    fontWeight: '900',
  },
  resultCountLabel: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 2,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 9,
  },
  outlineButtonText: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },

  // Messages
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  conversationAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationAvatarText: {
    color: COLORS.navy,
    fontSize: 17,
    fontWeight: '900',
  },
  conversationDetails: {
    flex: 1,
  },
  conversationPreview: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },

  // Empty states
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 12,
  },
  emptyIcon: {
    fontSize: 35,
    marginBottom: 12,
  },
  emptyTitle: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyDescription: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
  },

  // Profile
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    padding: 23,
    marginBottom: 16,
  },
  largeProfileAvatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeProfileAvatarText: {
    color: COLORS.navy,
    fontSize: 30,
    fontWeight: '900',
  },
  profileName: {
    color: COLORS.navy,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 13,
  },
  profileEmail: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 5,
  },
  athleteBadge: {
    backgroundColor: COLORS.lightBlue,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 13,
  },
  athleteBadgeText: {
    color: COLORS.blue,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  smallNote: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 10,
  },
  profileInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileInfoLabel: {
    color: COLORS.muted,
    fontSize: 13,
  },
  profileInfoValue: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  logoutButton: {
    minHeight: 49,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 18,
  },
  logoutButtonText: {
    color: COLORS.red,
    fontWeight: '800',
    fontSize: 14,
  },

  // Improved bottom navigation
  bottomNavigation: {
    minHeight: 76,
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 7,
    paddingBottom: 7,
    paddingHorizontal: 3,
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  navItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 1,
  },
  navIconContainer: {
    width: 38,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  navIconSelected: {
    backgroundColor: COLORS.lightBlue,
  },
  navIcon: {
    color: '#94A3B8',
    fontSize: 21,
    fontWeight: '700',
  },
  navIconActive: {
    color: COLORS.blue,
  },
  navLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  navLabelActive: {
    color: COLORS.blue,
  },
  navNotification: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navNotificationText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '900',
  },
});
