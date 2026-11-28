
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import { apiRequest, getAuthUser, AuthUser } from '../../lib/api';

type ChatPerson = {
  _id: string;
  name?: string;
  role?: string;
};

type ChatMessage = {
  _id: string;
  text: string;
  createdAt: string;
  sender: ChatPerson | string;
  receiver: ChatPerson | string;
};

function getId(
  person: ChatMessage['sender'] | ChatMessage['receiver']
): string {
  return typeof person === 'string' ? person : person?._id || '';
}

function getPersonName(
  person: ChatMessage['sender'] | ChatMessage['receiver'],
  fallback: string
): string {
  if (typeof person === 'object' && person?.name) {
    return person.name;
  }
  return fallback;
}

function getPersonRole(
  person: ChatMessage['sender'] | ChatMessage['receiver']
): string {
  if (typeof person !== 'object' || !person?.role) {
    return '';
  }

  return person.role.charAt(0).toUpperCase() + person.role.slice(1);
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{
    userId: string;
    name?: string;
  }>();

  const userId = Array.isArray(params.userId)
    ? params.userId[0]
    : params.userId;

  const routeName = Array.isArray(params.name)
    ? params.name[0]
    : params.name;

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherName, setOtherName] = useState(
    routeName || 'Conversation'
  );
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const current = await getAuthUser();
      setCurrentUser(current);

      const response = await apiRequest<{
        user: { name: string };
        messages: ChatMessage[];
      }>(`/api/messages/${userId}`);

      setOtherName(
        response.user?.name || routeName || 'Conversation'
      );

      setMessages(response.messages || []);
    } catch (error) {
      Alert.alert(
        'Could not load conversation',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [userId, routeName]);

  useFocusEffect(
    useCallback(() => {
      loadMessages();
    }, [loadMessages])
  );

  const sendMessage = async () => {
    const text = draft.trim();

    if (!text || !userId || sending) {
      return;
    }

    setSending(true);

    try {
      await apiRequest(`/api/messages/${userId}`, {
        method: 'POST',
        body: { text },
      });

      setDraft('');
      await loadMessages();
    } catch (error) {
      Alert.alert(
        'Message not sent',
        error instanceof Error
          ? error.message
          : 'Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#14213D" />
        <Text style={styles.loadingText}>Loading conversation...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        {/* Chat header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={8}
          >
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {otherName.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.headerText}>
            <Text style={styles.title}>{otherName}</Text>
            <Text style={styles.subtitle}>
              SAI private conversation
            </Text>
          </View>

          <Pressable
            onPress={loadMessages}
            style={styles.refresh}
            hitSlop={8}
          >
            <Text style={styles.refreshText}>↻</Text>
          </Pressable>
        </View>

        {/* Messages */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>
                Start the conversation
              </Text>
              <Text style={styles.emptyText}>
                Send a message to begin chatting.
              </Text>
            </View>
          ) : (
            messages.map((message) => {
              const receiverId = getId(message.receiver);

const mine =
  String(receiverId) === String(userId);

              const senderName = mine
                ? 'You'
                : getPersonName(message.sender, otherName);

              const senderRole = mine
                ? ''
                : getPersonRole(message.sender);

              return (
                <View
                  key={message._id}
                  style={[
                    styles.messageRow,
                    mine ? styles.myRow : styles.theirRow,
                  ]}
                >
                  {/* Sender identity */}
                  <Text
                    style={[
                      styles.senderLabel,
                      mine
                        ? styles.mySenderLabel
                        : styles.theirSenderLabel,
                    ]}
                  >
                    {senderName}
                    {senderRole ? ` · ${senderRole}` : ''}
                  </Text>

                  {/* Message bubble */}
                  <View
                    style={[
                      styles.bubble,
                      mine
                        ? styles.myBubble
                        : styles.theirBubble,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        mine && styles.myMessageText,
                      ]}
                    >
                      {message.text}
                    </Text>

                    <Text
                      style={[
                        styles.time,
                        mine && styles.myTime,
                      ]}
                    >
                      {formatTime(message.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Message input */}
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message..."
            placeholderTextColor="#94A3B8"
            style={styles.input}
            multiline
            maxLength={2000}
          />

          <Pressable
            onPress={sendMessage}
            disabled={!draft.trim() || sending}
            style={[
              styles.sendButton,
              (!draft.trim() || sending) && styles.sendDisabled,
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },

  flex: {
    flex: 1,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FA',
  },

  loadingText: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 12,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },

  backButton: {
    paddingVertical: 8,
    paddingRight: 2,
  },

  backText: {
    color: '#2563EB',
    fontWeight: '800',
    fontSize: 15,
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8EEF8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    color: '#14213D',
    fontSize: 18,
    fontWeight: '900',
  },

  headerText: {
    flex: 1,
  },

  title: {
    color: '#14213D',
    fontSize: 16,
    fontWeight: '900',
  },

  subtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 3,
  },

  refresh: {
    padding: 7,
  },

  refreshText: {
    color: '#2563EB',
    fontSize: 24,
    fontWeight: '700',
  },

  messages: {
    paddingHorizontal: 15,
    paddingVertical: 18,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },

  empty: {
    alignItems: 'center',
    padding: 28,
    marginTop: 80,
  },

  emptyIcon: {
    fontSize: 38,
    marginBottom: 12,
  },

  emptyTitle: {
    color: '#14213D',
    fontWeight: '900',
    fontSize: 17,
  },

  emptyText: {
    color: '#64748B',
    marginTop: 6,
    fontSize: 13,
  },

  messageRow: {
    width: '100%',
    marginVertical: 7,
  },

  myRow: {
    alignItems: 'flex-end',
  },

  theirRow: {
    alignItems: 'flex-start',
  },

  senderLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 5,
    paddingHorizontal: 4,
  },

  mySenderLabel: {
    color: '#2563EB',
  },

  theirSenderLabel: {
    color: '#64748B',
  },

  bubble: {
    maxWidth: '84%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  myBubble: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },

  theirBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
  },

  messageText: {
    color: '#1E293B',
    fontSize: 14,
    lineHeight: 21,
  },

  myMessageText: {
    color: '#FFFFFF',
  },

  time: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'right',
  },

  myTime: {
    color: '#DBEAFE',
  },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 9,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },

  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: '#14213D',
    fontSize: 14,
  },

  sendButton: {
    minWidth: 62,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#14213D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  sendDisabled: {
    opacity: 0.45,
  },

  sendText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
