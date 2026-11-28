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
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { apiRequest, getAuthUser, AuthUser } from '../../lib/api';

type ChatMessage = {
  _id: string;
  text: string;
  createdAt: string;
  sender: { _id: string; name?: string; role?: string } | string;
  receiver: { _id: string; name?: string; role?: string } | string;
};

function getId(value: ChatMessage['sender'] | ChatMessage['receiver']) {
  return typeof value === 'string' ? value : value?._id;
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ userId: string; name?: string }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const routeName = Array.isArray(params.name) ? params.name[0] : params.name;

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [otherName, setOtherName] = useState(routeName || 'Conversation');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const loadMessages = useCallback(async () => {
    if (!userId) return;
    try {
      const current = await getAuthUser();
      setCurrentUser(current);

      const response = await apiRequest<{
        user: { name: string };
        messages: ChatMessage[];
      }>(`/api/messages/${userId}`);

      setOtherName(response.user?.name || routeName || 'Conversation');
      setMessages(response.messages || []);
    } catch (error) {
      Alert.alert(
        'Could not load conversation',
        error instanceof Error ? error.message : 'Please try again.'
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
    if (!text || !userId || sending) return;

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
        error instanceof Error ? error.message : 'Please try again.'
      );
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#14213D" />
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
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>{otherName}</Text>
            <Text style={styles.subtitle}>SAI private conversation</Text>
          </View>
          <Pressable onPress={loadMessages} style={styles.refresh}>
            <Text style={styles.refreshText}>↻</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.messages}
          ref={(ref) => {
            // The list is intentionally kept simple; refresh reloads the latest 200 messages.
          }}
        >
          {messages.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Start the conversation</Text>
              <Text style={styles.emptyText}>
                Send a message to begin chatting.
              </Text>
            </View>
          ) : messages.map((message) => {
            const mine = getId(message.sender) === currentUser?._id;
            return (
              <View
                key={message._id}
                style={[
                  styles.messageRow,
                  mine ? styles.myRow : styles.theirRow,
                ]}
              >
                <View style={[styles.bubble, mine ? styles.myBubble : styles.theirBubble]}>
                  <Text style={[styles.messageText, mine && styles.myMessageText]}>
                    {message.text}
                  </Text>
                  <Text style={[styles.time, mine && styles.myTime]}>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

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
            style={[styles.sendButton, (!draft.trim() || sending) && styles.sendDisabled]}
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
  safe: { flex: 1, backgroundColor: '#F5F7FA' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: { paddingVertical: 8, paddingRight: 10 },
  backText: { color: '#2563EB', fontWeight: '800', fontSize: 15 },
  headerText: { flex: 1 },
  title: { color: '#14213D', fontSize: 17, fontWeight: '900' },
  subtitle: { color: '#64748B', fontSize: 11, marginTop: 3 },
  refresh: { padding: 8 },
  refreshText: { color: '#2563EB', fontSize: 24, fontWeight: '700' },
  messages: { padding: 16, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { alignItems: 'center', padding: 28, marginTop: 80 },
  emptyTitle: { color: '#14213D', fontWeight: '900', fontSize: 17 },
  emptyText: { color: '#64748B', marginTop: 6, fontSize: 13 },
  messageRow: { width: '100%', marginVertical: 5 },
  myRow: { alignItems: 'flex-end' },
  theirRow: { alignItems: 'flex-start' },
  bubble: { maxWidth: '84%', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
  myBubble: { backgroundColor: '#14213D', borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', borderBottomLeftRadius: 4 },
  messageText: { color: '#1E293B', fontSize: 14, lineHeight: 20 },
  myMessageText: { color: '#fff' },
  time: { color: '#94A3B8', fontSize: 10, marginTop: 5, textAlign: 'right' },
  myTime: { color: '#CBD5E1' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 9,
    backgroundColor: '#fff',
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
  sendDisabled: { opacity: 0.45 },
  sendText: { color: '#fff', fontWeight: '800' },
});
