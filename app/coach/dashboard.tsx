
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  apiRequest,
  clearAuth,
  getAuthUser,
} from '../../lib/api';

type TabKey = 'Home' | 'Athletes' | 'Messages' | 'Requests' | 'Profile';

type AssessmentResult = {
  _id: string;
  test: string;
  value: number;
  unit: string;
  date?: string;
  details?: Record<string, unknown>;
};

type Athlete = {
  _id: string;
  name: string;
  age?: number;
  gender?: string;
  weight?: number;
  results: AssessmentResult[];
};

type CoachRequest = {
  _id: string;
  status: 'pending' | 'accepted' | 'declined';
  message?: string;
  createdAt?: string;
  athlete: {
    _id: string;
    name: string;
    age?: number;
    gender?: string;
  } | null;
};

type Conversation = {
  user: {
    _id: string;
    name: string;
    email?: string;
    role: string;
  };
  lastMessage?: {
    _id?: string;
    text: string;
    createdAt: string;
    sender: string | { _id: string };
  } | null;
  updatedAt: string;
};

type CoachProfile = {
  id?: string;
  name?: string;
  email?: string;
  organization?: string;
  specialization?: string;
  bio?: string;
};

const COLORS = {
  navy: '#14213D',
  navyLight: '#243B63',
  blue: '#315EAA',
  bluePale: '#EAF1FC',
  background: '#F4F6FA',
  white: '#FFFFFF',
  text: '#17243A',
  muted: '#718096',
  border: '#E5EAF1',
  green: '#16845B',
  greenPale: '#E8F6EF',
  amber: '#A86408',
  amberPale: '#FFF4DF',
  red: '#B93838',
  redPale: '#FCECEC',
};

const TABS: { key: TabKey; icon: string }[] = [
  { key: 'Home', icon: '⌂' },
  { key: 'Athletes', icon: '♙' },
  { key: 'Messages', icon: '✉' },
  { key: 'Requests', icon: '⇄' },
  { key: 'Profile', icon: '◉' },
];

function initials(name?: string) {
  return (name || 'A')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CoachDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>('Home');
  const [coach, setCoach] = useState<CoachProfile | null>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [requests, setRequests] = useState<CoachRequest[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedAthlete, setExpandedAthlete] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const loadData = useCallback(async (showLoader = false) => {
    if (showLoader) setRefreshing(true);

    try {
      const currentUser = await getAuthUser();
      setCoach(currentUser);

      const [
        athleteData,
        requestData,
        conversationData,
        profileData,
      ] = await Promise.all([
        apiRequest<{ athletes: Athlete[] }>('/api/coaches/athletes'),
        apiRequest<{ requests: CoachRequest[] }>('/api/coaches/contact-requests'),
        apiRequest<{ conversations: Conversation[] }>('/api/messages/conversations'),
        apiRequest<{ coach: CoachProfile }>('/api/coaches/profile').catch(() => null),
      ]);

      setAthletes(athleteData.athletes || []);
      setRequests(requestData.requests || []);
      setConversations(conversationData.conversations || []);

      if (profileData?.coach) {
        setCoach(profileData.coach);
      }
    } catch (error) {
      Alert.alert(
        'Could not load coach workspace',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === 'pending'),
    [requests]
  );

  const acceptedRequests = useMemo(
    () => requests.filter((request) => request.status === 'accepted'),
    [requests]
  );

  const filteredAthletes = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return athletes;

    return athletes.filter((athlete) =>
      [
        athlete.name,
        athlete.gender,
        String(athlete.age || ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [athletes, search]);

  const requestForAthlete = (athleteId: string) =>
    requests.find((request) => request.athlete?._id === athleteId);

  const openChat = (userId: string, name: string) => {
    router.push({
      pathname: '/chat/[userId]',
      params: { userId, name },
    } as any);
  };

  const sendRequest = async (athlete: Athlete) => {
    setSendingId(athlete._id);

    try {
      await apiRequest('/api/coaches/contact-requests', {
        method: 'POST',
        body: {
          athleteId: athlete._id,
          message:
            'Hello! I would like to connect with you regarding your sports assessment profile.',
        },
      });

      Alert.alert(
        'Request sent',
        `${athlete.name} can now review your request.`
      );

      await loadData();
    } catch (error) {
      Alert.alert(
        'Request could not be sent',
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSendingId(null);
    }
  };

  const logout = () => {
    Alert.alert(
      'Log out?',
      'You will need to sign in again to access the coach portal.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            await clearAuth();
            router.replace('/account' as any);
          },
        },
      ]
    );
  };

  const renderAthleteCard = (athlete: Athlete) => {
    const connection = requestForAthlete(athlete._id);
    const expanded = expandedAthlete === athlete._id;

    return (
      <View key={athlete._id} style={styles.athleteCard}>
        <View style={styles.athleteTopRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {initials(athlete.name)}
            </Text>
          </View>

          <View style={styles.flexOne}>
            <Text style={styles.athleteName}>{athlete.name}</Text>

            <Text style={styles.mutedSmall}>
              {[
                athlete.age ? `${athlete.age} years` : null,
                athlete.gender,
                athlete.weight ? `${athlete.weight} kg` : null,
              ]
                .filter(Boolean)
                .join('  ·  ') || 'Athlete profile'}
            </Text>
          </View>

          <View style={styles.resultCountPill}>
            <Text style={styles.resultCountText}>
              {athlete.results?.length || 0} tests
            </Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.athleteActions}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              setExpandedAthlete(expanded ? null : athlete._id)
            }
            hitSlop={4}
          >
            <Text style={styles.secondaryButtonText}>
              {expanded ? 'Hide reports' : 'View reports'}
            </Text>
          </Pressable>

          {connection?.status === 'accepted' ? (
            <Pressable
              style={styles.primarySmallButton}
              onPress={() => openChat(athlete._id, athlete.name)}
              hitSlop={4}
            >
              <Text style={styles.primarySmallButtonText}>
                Message
              </Text>
            </Pressable>
          ) : connection?.status === 'pending' ? (
            <View style={styles.pendingPill}>
              <Text style={styles.pendingPillText}>
                Request pending
              </Text>
            </View>
          ) : (
            <Pressable
              style={styles.primarySmallButton}
              disabled={sendingId === athlete._id}
              onPress={() => sendRequest(athlete)}
              hitSlop={4}
            >
              <Text style={styles.primarySmallButtonText}>
                {sendingId === athlete._id ? 'Sending...' : 'Connect'}
              </Text>
            </Pressable>
          )}
        </View>

        {expanded && (
          <View style={styles.expandedReports}>
            <Text style={styles.subsectionTitle}>
              Assessment history
            </Text>

            {!athlete.results || athlete.results.length === 0 ? (
              <Text style={styles.emptyHint}>
                No assessment results have been synced yet.
              </Text>
            ) : (
              athlete.results.map((result) => (
                <View key={result._id} style={styles.reportRow}>
                  <View style={styles.flexOne}>
                    <Text style={styles.reportTest}>
                      {result.test}
                    </Text>

                    {!!result.date && (
                      <Text style={styles.mutedTiny}>
                        {formatDate(result.date)}
                      </Text>
                    )}
                  </View>

                  <Text style={styles.reportValue}>
                    {result.value} {result.unit}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  const renderHome = () => (
    <>
      <View style={styles.welcomeCard}>
        <View style={styles.welcomeTop}>
          <View style={styles.flexOne}>
            <Text style={styles.eyebrowLight}>
              SAI COACH PORTAL
            </Text>

            <Text style={styles.welcomeTitle}>
              Welcome back,
            </Text>

            <Text style={styles.welcomeName}>
              {coach?.name || 'Coach'}
            </Text>

            <Text style={styles.welcomeSubtitle}>
              Your athlete network and conversations, all in one place.
            </Text>
          </View>

          <View style={styles.welcomeIcon}>
            <Text style={styles.welcomeIconText}>SAI</Text>
          </View>
        </View>

        <Pressable
          style={styles.refreshInline}
          onPress={() => loadData(true)}
          hitSlop={5}
        >
          <Text style={styles.refreshInlineText}>
            ↻ Refresh workspace
          </Text>
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          label="Discoverable athletes"
          value={athletes.length}
          icon="♙"
        />
        <StatCard
          label="Pending requests"
          value={pendingRequests.length}
          icon="◷"
        />
        <StatCard
          label="Connections"
          value={acceptedRequests.length}
          icon="✓"
        />
        <StatCard
          label="Conversations"
          value={conversations.length}
          icon="✉"
        />
      </View>

      <SectionHeading
        title="Quick access"
        subtitle="Jump back into your coaching activity."
      />

      <View style={styles.quickGrid}>
        <QuickAction
          title="Find athletes"
          description="Explore opted-in profiles"
          icon="♙"
          onPress={() => setActiveTab('Athletes')}
        />
        <QuickAction
          title="Open messages"
          description="Continue a conversation"
          icon="✉"
          onPress={() => setActiveTab('Messages')}
        />
        <QuickAction
          title="Review requests"
          description="Manage connection requests"
          icon="⇄"
          onPress={() => setActiveTab('Requests')}
        />
        <QuickAction
          title="My profile"
          description="View coach information"
          icon="◉"
          onPress={() => setActiveTab('Profile')}
        />
      </View>

      <SectionHeading
        title="Recent conversations"
        action="See all"
        onAction={() => setActiveTab('Messages')}
      />

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          message="Once an athlete accepts your connection request, your conversation will appear here."
        />
      ) : (
        conversations.slice(0, 3).map((conversation) => (
          <ConversationRow
            key={conversation.user._id}
            conversation={conversation}
            onPress={() =>
              openChat(
                conversation.user._id,
                conversation.user.name
              )
            }
          />
        ))
      )}
    </>
  );

  const renderAthletes = () => (
    <>
      <SectionHeading
        title="Athlete directory"
        subtitle="Profiles are shown only when athletes enable discoverability."
      />

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search athletes by name..."
          placeholderTextColor="#98A2B3"
          style={styles.searchInput}
          autoCapitalize="none"
          returnKeyType="search"
        />

        {!!search && (
          <Pressable
            onPress={() => setSearch('')}
            hitSlop={8}
          >
            <Text style={styles.clearSearch}>Clear</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.listMeta}>
        {filteredAthletes.length} athlete
        {filteredAthletes.length === 1 ? '' : 's'} found
      </Text>

      {filteredAthletes.length === 0 ? (
        <EmptyState
          title={search ? 'No matching athletes' : 'No athletes available yet'}
          message={
            search
              ? 'Try another name or clear your search.'
              : 'Athletes will appear here after enabling coach discoverability.'
          }
        />
      ) : (
        filteredAthletes.map(renderAthleteCard)
      )}
    </>
  );

  const renderMessages = () => (
    <>
      <SectionHeading
        title="Messages"
        subtitle="Your conversations with connected athletes."
      />

      <View style={styles.infoStrip}>
        <Text style={styles.infoStripText}>
          Messaging is available after an athlete accepts your connection request.
        </Text>
      </View>

      {conversations.length === 0 ? (
        <EmptyState
          title="Your inbox is empty"
          message="Accepted athlete connections will appear here. You can start by exploring the athlete directory."
          actionLabel="Explore athletes"
          onAction={() => setActiveTab('Athletes')}
        />
      ) : (
        conversations.map((conversation) => (
          <ConversationRow
            key={conversation.user._id}
            conversation={conversation}
            onPress={() =>
              openChat(
                conversation.user._id,
                conversation.user.name
              )
            }
          />
        ))
      )}
    </>
  );

  const renderRequests = () => (
    <>
      <SectionHeading
        title="Connection requests"
        subtitle="Track the status of your requests to athletes."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No requests yet"
          message="When you request to connect with an athlete, its status will be shown here."
          actionLabel="Find athletes"
          onAction={() => setActiveTab('Athletes')}
        />
      ) : (
        requests.map((request) => (
          <View key={request._id} style={styles.requestCard}>
            <View style={styles.athleteTopRow}>
              <View style={styles.avatarSmall}>
                <Text style={styles.avatarText}>
                  {initials(request.athlete?.name || 'Athlete')}
                </Text>
              </View>

              <View style={styles.flexOne}>
                <Text style={styles.athleteName}>
                  {request.athlete?.name || 'Athlete unavailable'}
                </Text>

                <Text style={styles.mutedSmall}>
                  Sent {formatDate(request.createdAt) || 'recently'}
                </Text>
              </View>

              <StatusPill status={request.status} />
            </View>

            {!!request.message && (
              <Text style={styles.requestMessage}>
                {request.message}
              </Text>
            )}

            {request.status === 'accepted' && request.athlete && (
              <Pressable
                style={styles.messageRequestButton}
                onPress={() =>
                  openChat(
                    request.athlete!._id,
                    request.athlete!.name
                  )
                }
                hitSlop={5}
              >
                <Text style={styles.messageRequestText}>
                  Open conversation →
                </Text>
              </Pressable>
            )}
          </View>
        ))
      )}
    </>
  );

  const renderProfile = () => (
    <>
      <SectionHeading
        title="Coach profile"
        subtitle="Your professional information in the SAI network."
      />

      <View style={styles.profileCard}>
        <View style={styles.profileHero}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {initials(coach?.name)}
            </Text>
          </View>

          <Text style={styles.profileName}>
            {coach?.name || 'Coach'}
          </Text>

          <Text style={styles.profileRole}>
            Verified coach account
          </Text>
        </View>

        <ProfileField
          label="Email address"
          value={coach?.email}
        />

        <ProfileField
          label="Organization"
          value={coach?.organization}
        />

        <ProfileField
          label="Specialization"
          value={coach?.specialization}
        />

        <ProfileField
          label="About"
          value={coach?.bio}
          multiline
        />

        <Pressable
          style={styles.editProfileButton}
          onPress={() => router.push('/coach/profile' as any)}
          hitSlop={5}
        >
          <Text style={styles.editProfileText}>
            Edit coach profile
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.logoutButton}
        onPress={logout}
        hitSlop={5}
      >
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'Athletes':
        return renderAthletes();
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
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color={COLORS.navy}
        />
        <Text style={styles.loadingText}>
          Preparing your coach workspace...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>S</Text>
          </View>

          <View style={styles.topBarText}>
            <Text style={styles.brandTitle}>
              SAI <Text style={styles.brandSubtitle}>COACH</Text>
            </Text>
            <Text style={styles.topBarCaption}>
              Sports Assessment & Identification
            </Text>
          </View>

          <Pressable
            style={styles.topRefresh}
            onPress={() => loadData(true)}
            accessibilityLabel="Refresh dashboard"
            hitSlop={5}
          >
            <Text style={styles.topRefreshText}>↻</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor={COLORS.navy}
            />
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </ScrollView>

        <View style={styles.bottomNav}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;

            const badgeCount =
              tab.key === 'Requests'
                ? pendingRequests.length
                : tab.key === 'Messages'
                  ? conversations.length
                  : 0;

            return (
              <Pressable
                key={tab.key}
                style={styles.navItem}
                onPress={() => setActiveTab(tab.key)}
                hitSlop={4}
                android_ripple={{ color: '#EAF1FC' }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <View
                  style={[
                    styles.navIconWrap,
                    active && styles.navIconWrapActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.navIcon,
                      active && styles.navIconActive,
                    ]}
                  >
                    {tab.icon}
                  </Text>

                  {badgeCount > 0 && (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  style={[
                    styles.navLabel,
                    active && styles.navLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {tab.key}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statTop}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  title,
  description,
  icon,
  onPress,
}: {
  title: string;
  description: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.quickCard}
      onPress={onPress}
      hitSlop={3}
    >
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickDescription}>
        {description}
      </Text>
    </Pressable>
  );
}

function SectionHeading({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.flexOne}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && (
          <Text style={styles.sectionSubtitle}>
            {subtitle}
          </Text>
        )}
      </View>

      {!!action && !!onAction && (
        <Pressable onPress={onAction} hitSlop={6}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>⌁</Text>
      </View>

      <Text style={styles.emptyTitle}>{title}</Text>

      <Text style={styles.emptyMessage}>
        {message}
      </Text>

      {!!actionLabel && !!onAction && (
        <Pressable
          style={styles.emptyAction}
          onPress={onAction}
        >
          <Text style={styles.emptyActionText}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  const preview =
    conversation.lastMessage?.text ||
    'No messages yet. Start the conversation.';

  return (
    <Pressable
      style={styles.conversationCard}
      onPress={onPress}
      hitSlop={3}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {initials(conversation.user.name)}
        </Text>
      </View>

      <View style={styles.flexOne}>
        <Text style={styles.conversationName}>
          {conversation.user.name}
        </Text>

        <Text
          style={styles.conversationPreview}
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>

      <View style={styles.conversationMeta}>
        <Text style={styles.conversationTime}>
          {formatTime(
            conversation.lastMessage?.createdAt ||
              conversation.updatedAt
          )}
        </Text>
        <Text style={styles.conversationArrow}>›</Text>
      </View>
    </Pressable>
  );
}

function StatusPill({
  status,
}: {
  status: CoachRequest['status'];
}) {
  const config =
    status === 'accepted'
      ? {
          label: 'Accepted',
          bg: COLORS.greenPale,
          color: COLORS.green,
        }
      : status === 'declined'
        ? {
            label: 'Declined',
            bg: COLORS.redPale,
            color: COLORS.red,
          }
        : {
            label: 'Pending',
            bg: COLORS.amberPale,
            color: COLORS.amber,
          };

  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: config.bg },
      ]}
    >
      <Text
        style={[
          styles.statusPillText,
          { color: config.color },
        ]}
      >
        {config.label}
      </Text>
    </View>
  );
}

function ProfileField({
  label,
  value,
  multiline,
}: {
  label: string;
  value?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.profileField}>
      <Text style={styles.profileFieldLabel}>
        {label}
      </Text>

      <Text
        style={[
          styles.profileFieldValue,
          multiline && styles.profileFieldMultiline,
        ]}
      >
        {value?.trim() || 'Not added yet'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 13,
  },

  flexOne: {
    flex: 1,
    minWidth: 0,
  },

  topBar: {
    minHeight: 62,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  brandMarkText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 21,
  },

  topBarText: {
    flex: 1,
    minWidth: 0,
  },

  brandTitle: {
    color: COLORS.navy,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
  },

  brandSubtitle: {
    color: COLORS.blue,
    fontSize: 11,
    letterSpacing: 1.2,
  },

  topBarCaption: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 2,
  },

  topRefresh: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F4F9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  topRefreshText: {
    color: COLORS.navy,
    fontSize: 23,
    fontWeight: '700',
  },

  scroll: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 14,
    paddingTop: 15,
    paddingBottom: 20,
  },

  welcomeCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 20,
    padding: 17,
    marginBottom: 16,
    overflow: 'hidden',
  },

  welcomeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  eyebrowLight: {
    color: '#B9C9E2',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },

  welcomeTitle: {
    color: '#E3EAF5',
    fontSize: 16,
    marginTop: 12,
  },

  welcomeName: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
  },

  welcomeSubtitle: {
    color: '#CBD6E7',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 235,
  },

  welcomeIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },

  welcomeIconText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 1,
  },

  refreshInline: {
    alignSelf: 'flex-start',
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: '#2B4268',
    borderRadius: 10,
    marginTop: 15,
  },

  refreshInlineText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 11,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },

  statCard: {
    width: '48%',
    flexGrow: 0,
    flexShrink: 1,
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  statIcon: {
    color: COLORS.blue,
    fontSize: 19,
    fontWeight: '800',
  },

  statValue: {
    color: COLORS.navy,
    fontSize: 23,
    fontWeight: '900',
  },

  statLabel: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 8,
    lineHeight: 15,
  },

  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 13,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '900',
  },

  sectionSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },

  sectionAction: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '800',
    paddingLeft: 8,
  },

  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },

  quickCard: {
    width: '48%',
    flexGrow: 0,
    flexShrink: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 12,
    minHeight: 108,
  },

  quickIcon: {
    color: COLORS.blue,
    fontSize: 22,
    marginBottom: 8,
  },

  quickTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },

  quickDescription: {
    color: COLORS.muted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },

  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 12,
    marginBottom: 9,
    gap: 10,
  },

  avatar: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: COLORS.bluePale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarSmall: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: COLORS.bluePale,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: COLORS.navy,
    fontSize: 15,
    fontWeight: '900',
  },

  conversationName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },

  conversationPreview: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },

  conversationMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  conversationTime: {
    color: COLORS.muted,
    fontSize: 9,
  },

  conversationArrow: {
    color: COLORS.blue,
    fontSize: 22,
    marginTop: 2,
  },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 13,
    paddingHorizontal: 13,
    minHeight: 48,
    marginBottom: 10,
  },

  searchIcon: {
    fontSize: 22,
    color: COLORS.muted,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    minWidth: 0,
    color: COLORS.text,
    fontSize: 13,
    paddingVertical: 8,
  },

  clearSearch: {
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: '800',
    paddingLeft: 8,
  },

  listMeta: {
    color: COLORS.muted,
    fontSize: 11,
    marginBottom: 11,
  },

  athleteCard: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 11,
  },

  athleteTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  athleteName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },

  mutedSmall: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 4,
  },

  mutedTiny: {
    color: COLORS.muted,
    fontSize: 9,
    marginTop: 3,
  },

  resultCountPill: {
    backgroundColor: '#F1F4F8',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  resultCountText: {
    color: COLORS.navy,
    fontSize: 9,
    fontWeight: '800',
  },

  cardDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 13,
  },

  athleteActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },

  secondaryButton: {
    flex: 1,
    minWidth: 130,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#F2F5FA',
    alignItems: 'center',
  },

  secondaryButtonText: {
    color: COLORS.navy,
    fontWeight: '800',
    fontSize: 10,
  },

  primarySmallButton: {
    minWidth: 78,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
  },

  primarySmallButtonText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 10,
  },

  pendingPill: {
    minWidth: 82,
    paddingHorizontal: 9,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.amberPale,
    alignItems: 'center',
  },

  pendingPillText: {
    color: COLORS.amber,
    fontWeight: '800',
    fontSize: 9,
  },

  expandedReports: {
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  subsectionTitle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },

  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F6',
  },

  reportTest: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },

  reportValue: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: '900',
  },

  emptyHint: {
    color: COLORS.muted,
    fontSize: 11,
    paddingVertical: 8,
  },

  infoStrip: {
    backgroundColor: COLORS.bluePale,
    borderRadius: 12,
    padding: 12,
    marginBottom: 13,
  },

  infoStripText: {
    color: COLORS.navy,
    fontSize: 11,
    lineHeight: 16,
  },

  emptyState: {
    backgroundColor: COLORS.white,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    padding: 24,
    marginTop: 4,
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.bluePale,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyIconText: {
    color: COLORS.blue,
    fontSize: 27,
    fontWeight: '800',
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },

  emptyMessage: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
  },

  emptyAction: {
    backgroundColor: COLORS.navy,
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginTop: 14,
  },

  emptyActionText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },

  requestCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },

  requestMessage: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
  },

  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },

  statusPillText: {
    fontSize: 9,
    fontWeight: '900',
  },

  messageRequestButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 8,
  },

  messageRequestText: {
    color: COLORS.blue,
    fontSize: 11,
    fontWeight: '900',
  },

  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
  },

  profileHero: {
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
  },

  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  profileAvatarText: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: '900',
  },

  profileName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
  },

  profileRole: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 4,
  },

  profileField: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F6',
  },

  profileFieldLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  profileFieldValue: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
  },

  profileFieldMultiline: {
    minHeight: 35,
  },

  editProfileButton: {
    backgroundColor: COLORS.navy,
    borderRadius: 11,
    alignItems: 'center',
    padding: 13,
    marginTop: 17,
  },

  editProfileText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '900',
  },

  logoutButton: {
    alignItems: 'center',
    padding: 17,
    marginTop: 12,
  },

  logoutText: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: '800',
  },

  bottomNav: {
    minHeight: 70,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
    paddingTop: 5,
    paddingBottom: 5,
  },

  navItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },

  navIconWrap: {
    width: 36,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  navIconWrapActive: {
    backgroundColor: COLORS.bluePale,
  },

  navIcon: {
    color: '#8A96A8',
    fontSize: 20,
    fontWeight: '700',
  },

  navIconActive: {
    color: COLORS.blue,
  },

  navLabel: {
    color: '#8A96A8',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 3,
  },

  navLabelActive: {
    color: COLORS.blue,
  },

  navBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },

  navBadgeText: {
    color: COLORS.white,
    fontSize: 8,
    fontWeight: '900',
  },
});
