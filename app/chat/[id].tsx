import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type {
  ChatStructuredPayload,
  Message,
  PollOption,
  PollVote,
} from "@/types/chat";
import {
  decodeChatPayload,
  encodeChatPayload,
  getSafeMessagePreview,
} from "@/utils/chatMessageCodec";
import { formatTime } from "@/utils/formatTime";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  BarChart3,
  ChevronLeft,
  FileUp,
  Image as ImageIcon,
  Mic,
  Reply,
  RotateCcw,
  Send,
  Smile,
  Sticker,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────
type PopupType = "emoji" | "media" | "sticker" | "audio" | "poll" | null;

interface ContextMenuState {
  message: Message;
  visible: boolean;
}

interface PollAggregate {
  question: string;
  options: PollOption[];
  createdBy: string;
  votes: Array<PollVote & { createdAt: string }>;
  latestActivityAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CHAT_STICKER_LIST = [
  "https://sdl-stickershop.line.naver.jp/stickershop/v1/product/1414779/LINEStorePC/main.png;compress=true?__=20161019",
  "https://sdl-stickershop.line.naver.jp/stickershop/v1/product/1414816/LINEStorePC/main.png;compress=true?__=20161019",
  "https://sdl-stickershop.line.naver.jp/stickershop/v1/product/1414814/IOS/main_animation.png?__=20161019",
  "https://sdl-stickershop.line.naver.jp/stickershop/v1/product/1414808/LINEStorePC/main.png;compress=true?__=20161019",
  "https://sdl-stickershop.line.naver.jp/stickershop/v1/product/1414804/LINEStorePC/main.png;compress=true?__=20161019",
  "https://sdl-stickershop.line.naver.jp/stickershop/v1/product/1414799/IOS/main_animation.png?__=20161019",
];

const EMOJI_LIST = [
  "😀",
  "😂",
  "🥰",
  "😎",
  "😭",
  "🤔",
  "😅",
  "🥳",
  "😤",
  "🤩",
  "👍",
  "👏",
  "🙏",
  "🔥",
  "❤️",
  "💯",
  "🎉",
  "😱",
  "🤣",
  "😍",
  "😜",
  "🤗",
  "😇",
  "🫡",
  "💪",
  "✌️",
  "🫶",
  "🥺",
  "😴",
  "🤯",
];

function createPollId() {
  return `poll_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getSenderName(
  message: Message,
  myId: string | undefined,
  participants: Array<{ _id: string; displayName: string }> = [],
) {
  if (message.senderId === myId) return "Bạn";
  return (
    participants.find((p) => p._id === message.senderId)?.displayName ||
    "Người dùng"
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activePopup, setActivePopup] = useState<PopupType>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    messages,
    fetchMessages,
    setActiveConversation,
    conversations,
    sendDirectMessage,
    sendGroupMessage,
    recallMessage,
    deleteMessageForMe,
    uploadAttachment,
    typingUsersByConv,
    updateStrangerStatus,
  } = useChatStore();

  const { user, userProfile } = useAuthStore();
  const { socket } = useSocketStore();

  // ─── Derived data ───────────────────────────────────────────────────────────
  const activeConv = useMemo(
    () => conversations.find((c) => c._id === id),
    [conversations, id],
  );

  const currentMessages = useMemo(() => {
    const data = messages[id as string];
    if (!data) return [];
    return Array.isArray(data) ? data : (data.items ?? []);
  }, [messages, id]);

  const otherUser = useMemo(
    () => activeConv?.participants?.find((p) => p._id !== user?.userId),
    [activeConv, user?.userId],
  );

  const typingUsers = useMemo(() => {
    if (!id) return [];
    return (typingUsersByConv?.[id as string] || []).filter(
      (uid) => uid !== user?.userId,
    );
  }, [typingUsersByConv, id, user?.userId]);

  const otherLastReadMessageId = useMemo(
    () =>
      activeConv?.participants.find((p) => p._id !== user?.userId)
        ?.lastReadMessageId ?? null,
    [activeConv, user?.userId],
  );

  // ─── Poll aggregates ────────────────────────────────────────────────────────
  const pollAggregates = useMemo(() => {
    const map = new Map<string, PollAggregate>();
    currentMessages.forEach((message) => {
      const payload = decodeChatPayload(message.content);
      if (!payload) return;

      if (payload.kind === "poll" && payload.poll) {
        const existing = map.get(payload.poll.id);
        const latestActivityAt = existing?.latestActivityAt
          ? new Date(existing.latestActivityAt).getTime() >
            new Date(message.createdAt).getTime()
            ? existing.latestActivityAt
            : message.createdAt
          : message.createdAt;
        map.set(payload.poll.id, {
          question: payload.poll.question,
          options: payload.poll.options,
          createdBy: payload.poll.createdBy,
          votes: existing?.votes || [],
          latestActivityAt,
        });
      }

      if (payload.kind === "poll_vote" && payload.pollVote) {
        const aggregate = map.get(payload.pollVote.pollId) || {
          question: "Bình chọn",
          options: [],
          createdBy: payload.pollVote.userId,
          votes: [],
          latestActivityAt: message.createdAt,
        };
        const voteIndex = aggregate.votes.findIndex(
          (v) => v.userId === payload.pollVote?.userId,
        );
        const nextVote = { ...payload.pollVote, createdAt: message.createdAt };
        if (voteIndex >= 0) {
          const oldTime = new Date(
            aggregate.votes[voteIndex].createdAt,
          ).getTime();
          const newTime = new Date(message.createdAt).getTime();
          if (newTime >= oldTime) aggregate.votes[voteIndex] = nextVote;
        } else {
          aggregate.votes.push(nextVote);
        }
        map.set(payload.pollVote.pollId, aggregate);
      }
    });
    return map;
  }, [currentMessages]);

  const displayMessages = useMemo(() => {
    return currentMessages
      .filter((m) => {
        const payload = decodeChatPayload(m.content);
        return payload?.kind !== "poll_vote";
      })
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }, [currentMessages]);

  // ─── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (id) {
      setActiveConversation(id as string);
      fetchMessages(id as string);
    }
    return () => {
      setActiveConversation(null);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [id]);

  // Mark last message as read
  useEffect(() => {
    if (!id || !socket) return;
    const items = currentMessages;
    if (items.length === 0) return;
    const lastMsg = items.at(-1);
    if (!lastMsg || lastMsg.senderId === user?.userId) return;
    socket.emit("mark-read", {
      conversationId: id,
      messageId: lastMsg._id,
    });
  }, [id, currentMessages, socket, user?.userId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (displayMessages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [displayMessages.length]);

  // ─── Helpers ────────────────────────────────────────────────────────────────
  const canRecall = useCallback(
    (message: Message) => {
      if (message.senderId !== user?.userId) return false;
      if (message.isRecalled) return false;
      return (
        Date.now() - new Date(message.createdAt).getTime() <=
        24 * 60 * 60 * 1000
      );
    },
    [user?.userId],
  );

  const sendStructuredMessage = useCallback(
    async (payload: ChatStructuredPayload, imgUrl?: string) => {
      if (!id) return;
      const encoded = encodeChatPayload(payload);
      if (activeConv?.group) {
        await sendGroupMessage(id as string, { content: encoded, imgUrl });
      } else {
        if (!otherUser?._id) return;
        await sendDirectMessage(otherUser._id, { content: encoded, imgUrl });
      }
    },
    [
      activeConv?.group,
      id,
      otherUser?._id,
      sendDirectMessage,
      sendGroupMessage,
    ],
  );

  // ─── Send text ───────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    try {
      setSending(true);
      const payload: ChatStructuredPayload = {
        version: 1,
        kind: replyingTo ? "reply" : "text",
        text: input.trim(),
        reply: replyingTo
          ? {
              messageId: replyingTo._id,
              senderName: getSenderName(
                replyingTo,
                user?.userId,
                activeConv?.participants || [],
              ),
              preview: getSafeMessagePreview(replyingTo.content),
            }
          : undefined,
      };
      await sendStructuredMessage(payload);
      setInput("");
      setReplyingTo(null);
      if (socket?.connected) {
        socket.emit("stop-typing", { conversationId: id });
      }
    } catch {
      Alert.alert("Lỗi", "Không thể gửi tin nhắn");
    } finally {
      setSending(false);
    }
  }, [
    activeConv?.participants,
    id,
    input,
    replyingTo,
    sendStructuredMessage,
    sending,
    socket,
    user?.userId,
  ]);

  // ─── Send attachment ─────────────────────────────────────────────────────────
  const sendAttachmentMessage = useCallback(
    async (
      file: { uri: string; name: string; type: string; size?: number },
      kind: "image" | "file" | "audio",
    ) => {
      try {
        setSending(true);
        const uploaded = await uploadAttachment(file as any);
        await sendStructuredMessage(
          {
            version: 1,
            kind,
            attachment: {
              name: uploaded.fileName,
              url: uploaded.url,
              mimeType: uploaded.mimeType,
              size: uploaded.size,
            },
          },
          kind === "image" ? uploaded.url : undefined,
        );
      } catch {
        Alert.alert("Lỗi", "Upload thất bại");
      } finally {
        setSending(false);
        setActivePopup(null);
      }
    },
    [sendStructuredMessage, uploadAttachment],
  );

  // ─── Pick image ──────────────────────────────────────────────────────────────
  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await sendAttachmentMessage(
        {
          uri: asset.uri,
          name: asset.fileName || `image-${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
          size: asset.fileSize,
        },
        "image",
      );
    }
    setActivePopup(null);
  }, [sendAttachmentMessage]);

  // ─── Pick file ───────────────────────────────────────────────────────────────
  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      await sendAttachmentMessage(
        {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/octet-stream",
          size: asset.size,
        },
        "file",
      );
    }
    setActivePopup(null);
  }, [sendAttachmentMessage]);

  // ─── Audio recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecording) return;
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch {
      Alert.alert("Lỗi", "Không thể truy cập micro để ghi âm");
    }
  }, [isRecording]);

  const stopRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setRecordSeconds(0);
      recordingRef.current = null;
      if (uri) {
        await sendAttachmentMessage(
          { uri, name: `recording-${Date.now()}.m4a`, type: "audio/m4a" },
          "audio",
        );
      }
    } catch {
      Alert.alert("Lỗi", "Không thể dừng ghi âm");
    }
  }, [sendAttachmentMessage]);

  // ─── Poll ────────────────────────────────────────────────────────────────────
  const handleCreatePoll = useCallback(async () => {
    const q = pollQuestion.trim();
    const opts = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) {
      Alert.alert("Lỗi", "Cần nhập câu hỏi và tối thiểu 2 lựa chọn");
      return;
    }
    const options: PollOption[] = opts.map((label, i) => ({
      id: `opt_${i + 1}_${Math.random().toString(36).slice(2, 6)}`,
      label,
    }));
    try {
      setSending(true);
      await sendStructuredMessage({
        version: 1,
        kind: "poll",
        poll: {
          id: createPollId(),
          question: q,
          options,
          createdBy: user?.userId || "",
        },
      });
      setPollQuestion("");
      setPollOptions(["", ""]);
      setActivePopup(null);
    } catch {
      Alert.alert("Lỗi", "Không thể tạo bình chọn");
    } finally {
      setSending(false);
    }
  }, [pollOptions, pollQuestion, sendStructuredMessage, user?.userId]);

  const handleVote = useCallback(
    async (pollId: string, optionId: string) => {
      if (!user?.userId) return;
      const aggregate = pollAggregates.get(pollId);
      const voted = aggregate?.votes.find((v) => v.userId === user.userId);
      if (voted?.optionId === optionId) return;
      try {
        await sendStructuredMessage({
          version: 1,
          kind: "poll_vote",
          pollVote: {
            pollId,
            optionId,
            userId: user.userId,
            userName: userProfile?.displayName || user.username || "Người dùng",
          },
        });
      } catch {
        Alert.alert("Lỗi", "Không thể gửi bình chọn");
      }
    },
    [pollAggregates, sendStructuredMessage, user, userProfile?.displayName],
  );

  // ─── Recall / Delete ─────────────────────────────────────────────────────────
  const handleRecall = useCallback(async () => {
    if (!contextMenu || !id) return;
    try {
      await recallMessage(contextMenu.message._id, id as string);
    } catch {
      Alert.alert("Lỗi", "Không thể thu hồi tin nhắn này");
    } finally {
      setContextMenu(null);
    }
  }, [contextMenu, id, recallMessage]);

  const handleDeleteForMe = useCallback(async () => {
    if (!contextMenu || !id) return;
    try {
      await deleteMessageForMe(contextMenu.message._id, id as string);
    } catch {
      Alert.alert("Lỗi", "Không thể xóa tin nhắn");
    } finally {
      setContextMenu(null);
    }
  }, [contextMenu, id, deleteMessageForMe]);

  // ─── Render message ──────────────────────────────────────────────────────────
  const renderStructuredMessage = useCallback(
    (message: Message, isMine: boolean) => {
      if (message.isRecalled) {
        return (
          <Text style={styles.recalledText}>Tin nhắn đã được thu hồi</Text>
        );
      }

      const payload = decodeChatPayload(message.content);

      if (!payload) {
        return <Text style={styles.msgText}>{message.content || ""}</Text>;
      }

      if (payload.kind === "reply") {
        return (
          <View>
            <View style={styles.replyQuote}>
              <Text style={styles.replyQuoteName}>
                {payload.reply?.senderName || "Tin nhắn"}
              </Text>
              <Text style={styles.replyQuotePreview} numberOfLines={1}>
                {payload.reply?.preview || ""}
              </Text>
            </View>
            <Text style={styles.msgText}>{payload.text || ""}</Text>
          </View>
        );
      }

      if (payload.kind === "emoji") {
        return <Text style={styles.emojiMsg}>{payload.emoji || "🙂"}</Text>;
      }

      if (payload.kind === "image" && payload.attachment?.url) {
        return (
          <Image
            source={{ uri: payload.attachment.url }}
            style={styles.imageMsg}
            resizeMode="cover"
          />
        );
      }

      if (payload.kind === "file" && payload.attachment) {
        return <Text style={styles.fileMsg}>📎 {payload.attachment.name}</Text>;
      }

      if (payload.kind === "audio" && payload.attachment?.url) {
        return <Text style={styles.audioMsg}>🎵 Tin nhắn âm thanh</Text>;
      }

      if (payload.kind === "sticker" && payload.stickerUrl) {
        return (
          <Image
            source={{ uri: payload.stickerUrl }}
            style={styles.stickerMsg}
            resizeMode="contain"
          />
        );
      }

      if (payload.kind === "poll" && payload.poll) {
        const aggregate = pollAggregates.get(payload.poll.id);
        const votedOption = aggregate?.votes.find(
          (v) => v.userId === user?.userId,
        )?.optionId;
        const totalVotes = aggregate?.votes.length || 0;

        return (
          <View style={styles.pollContainer}>
            <Text style={styles.pollQuestion}>{payload.poll.question}</Text>
            <Text style={styles.pollMeta}>
              {totalVotes} vote • Chọn một câu trả lời
            </Text>

            {payload.poll.options.map((option) => {
              const voters =
                aggregate?.votes.filter((v) => v.optionId === option.id) || [];
              const voted = option.id === votedOption;
              const percent = totalVotes
                ? Math.round((voters.length / totalVotes) * 100)
                : 0;

              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => void handleVote(payload.poll!.id, option.id)}
                  style={[styles.pollOption, voted && styles.pollOptionVoted]}
                  activeOpacity={0.7}
                >
                  <View
                    style={[styles.pollBar, { width: `${percent}%` as any }]}
                  />
                  <View style={styles.pollOptionContent}>
                    <Text
                      style={[
                        styles.pollOptionLabel,
                        voted && styles.pollOptionLabelVoted,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text
                      style={[
                        styles.pollPercent,
                        voted && styles.pollPercentVoted,
                      ]}
                    >
                      {percent}%
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }

      return (
        <Text style={styles.msgText}>
          {payload.text || payload.emoji || message.content || ""}
        </Text>
      );
    },
    [handleVote, pollAggregates, user?.userId],
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isMine = item.senderId === user?.userId;
      const isLastRead =
        otherLastReadMessageId &&
        item._id?.toString() === otherLastReadMessageId.toString();

      return (
        <View style={styles.msgWrapper}>
          <View
            style={[
              styles.msgRow,
              isMine ? styles.msgRowMine : styles.msgRowOther,
            ]}
          >
            <TouchableOpacity
              onLongPress={() => {
                if (!item.isRecalled)
                  setContextMenu({ message: item, visible: true });
              }}
              delayLongPress={300}
              activeOpacity={0.85}
              style={[
                styles.bubble,
                item.isRecalled
                  ? styles.recalledBubble
                  : isMine
                    ? styles.myBubble
                    : styles.otherBubble,
              ]}
            >
              {renderStructuredMessage(item, isMine)}
              <Text style={styles.msgTime}>{formatTime(item.createdAt)}</Text>
            </TouchableOpacity>
          </View>

          {/* Seen avatar */}
          {isMine && !item.isRecalled && isLastRead && (
            <View style={styles.seenRow}>
              {otherUser?.avatarUrl ? (
                <Image
                  source={{ uri: otherUser.avatarUrl }}
                  style={styles.seenAvatar}
                />
              ) : (
                <View style={styles.seenAvatarPlaceholder}>
                  <UserIcon size={10} color="#94a3b8" />
                </View>
              )}
            </View>
          )}
        </View>
      );
    },
    [
      otherLastReadMessageId,
      otherUser?.avatarUrl,
      renderStructuredMessage,
      user?.userId,
    ],
  );

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={styles.mainContainer}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ChevronLeft color="white" size={28} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {activeConv?.group?.name ||
                otherUser?.displayName ||
                "Đang tải..."}
            </Text>
            {activeConv?.strangerStatus === "accepted" &&
              activeConv?.isStranger && (
                <View style={styles.strangerBadge}>
                  <UserIcon size={10} color="#94a3b8" />
                  <Text style={styles.strangerBadgeText}>Người lạ</Text>
                </View>
              )}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={displayMessages}
          renderItem={renderMessage}
          keyExtractor={(item, index) =>
            item._id ? item._id.toString() : `msg-${index}`
          }
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />

        {/* Stranger pending — sender view */}
        {activeConv?.isStranger &&
          activeConv?.strangerStatus === "pending" &&
          activeConv?.initiatorId === user?.userId && (
            <View style={styles.strangerWaiting}>
              <Text style={styles.strangerWaitingText}>
                ⏳ Đang chờ{" "}
                <Text style={{ color: "#f1f5f9", fontWeight: "700" }}>
                  {otherUser?.displayName}
                </Text>{" "}
                chấp nhận tin nhắn của bạn
              </Text>
            </View>
          )}

        {/* Stranger pending — receiver view */}
        {activeConv?.isStranger &&
          activeConv?.strangerStatus === "pending" &&
          activeConv?.initiatorId !== user?.userId && (
            <View style={styles.strangerRequest}>
              <View style={styles.strangerRequestHeader}>
                {(() => {
                  const sender = activeConv.participants.find(
                    (p) => p._id !== user?.userId,
                  );
                  return (
                    <>
                      {sender?.avatarUrl ? (
                        <Image
                          source={{ uri: sender.avatarUrl }}
                          style={styles.strangerAvatar}
                        />
                      ) : (
                        <View style={styles.strangerAvatarPlaceholder}>
                          <Text style={styles.strangerAvatarInitial}>
                            {sender?.displayName?.[0]?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.strangerName}>
                          {sender?.displayName}
                        </Text>
                        <Text style={styles.strangerSub}>
                          Muốn nhắn tin với bạn
                        </Text>
                      </View>
                    </>
                  );
                })()}
              </View>
              <Text style={styles.strangerDesc}>
                Đây là người chưa kết bạn với bạn. Bạn có muốn nhận tin nhắn từ
                họ không?
              </Text>
              <View style={styles.strangerActions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() =>
                    updateStrangerStatus(activeConv._id, "accepted")
                  }
                >
                  <Text style={styles.acceptBtnText}>✓ Chấp nhận</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() =>
                    updateStrangerStatus(activeConv._id, "declined")
                  }
                >
                  <Text style={styles.declineBtnText}>✗ Từ chối</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        {/* Typing indicator */}
        <View style={styles.typingRow}>
          {typingUsers.length > 0 && (
            <Text style={styles.typingText}>
              {typingUsers
                .map(
                  (uid) =>
                    activeConv?.participants.find((p) => p._id === uid)
                      ?.displayName,
                )
                .filter(Boolean)
                .join(", ")}{" "}
              đang soạn...
            </Text>
          )}
        </View>

        {/* Input area */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <View style={styles.inputWrapper}>
            {/* Reply banner */}
            {replyingTo && (
              <View style={styles.replyBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.replyBannerName}>
                    Đang trả lời{" "}
                    {getSenderName(
                      replyingTo,
                      user?.userId,
                      activeConv?.participants || [],
                    )}
                  </Text>
                  <Text style={styles.replyBannerPreview} numberOfLines={1}>
                    {getSafeMessagePreview(replyingTo.content)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setReplyingTo(null)}>
                  <X size={16} color="#e2e8f0" />
                </TouchableOpacity>
              </View>
            )}

            {/* Action icons row */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionIcon}
                onPress={() =>
                  setActivePopup((p) => (p === "media" ? null : "media"))
                }
              >
                <ImageIcon size={20} color="#94a3b8" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionIcon}
                onPress={() =>
                  setActivePopup((p) => (p === "sticker" ? null : "sticker"))
                }
              >
                <Sticker size={20} color="#94a3b8" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionIcon}
                onPress={() =>
                  setActivePopup((p) => (p === "audio" ? null : "audio"))
                }
              >
                <Mic size={20} color={isRecording ? "#fca5a5" : "#94a3b8"} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionIcon}
                onPress={() =>
                  setActivePopup((p) => (p === "poll" ? null : "poll"))
                }
              >
                <BarChart3 size={20} color="#94a3b8" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionIcon}
                onPress={() =>
                  setActivePopup((p) => (p === "emoji" ? null : "emoji"))
                }
              >
                <Smile size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Text input row */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                placeholder="Nhập tin nhắn..."
                placeholderTextColor="#64748b"
                value={input}
                onChangeText={(text) => {
                  setInput(text);
                  if (socket?.connected && id) {
                    socket.emit("typing", { conversationId: id });
                    if (typingTimeoutRef.current)
                      clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => {
                      socket.emit("stop-typing", { conversationId: id });
                    }, 1200);
                  }
                }}
                multiline
                textAlignVertical="center"
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={!input.trim() || sending}
              >
                <LinearGradient
                  colors={
                    input.trim() && !sending
                      ? ["#1d4ed8", "#2563eb"]
                      : ["#334155", "#475569"]
                  }
                  style={styles.sendBtn}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Send color="white" size={18} />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── Popup Modals ── */}

      {/* Media popup */}
      <Modal
        visible={activePopup === "media"}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePopup(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActivePopup(null)}
        >
          <View style={styles.popupSheet}>
            <Text style={styles.popupTitle}>Gửi tệp hoặc hình ảnh</Text>
            <TouchableOpacity
              style={styles.popupAction}
              onPress={handlePickImage}
            >
              <ImageIcon size={18} color="#94a3b8" />
              <Text style={styles.popupActionText}>Chọn ảnh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.popupAction}
              onPress={handlePickFile}
            >
              <FileUp size={18} color="#94a3b8" />
              <Text style={styles.popupActionText}>Chọn tệp</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Audio popup */}
      <Modal
        visible={activePopup === "audio"}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePopup(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => !isRecording && setActivePopup(null)}
        >
          <View style={styles.popupSheet}>
            <View style={styles.audioHeader}>
              <Text style={styles.popupTitle}>Ghi âm</Text>
              <View
                style={[
                  styles.recordBadge,
                  isRecording && styles.recordBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.recordBadgeText,
                    isRecording && styles.recordBadgeTextActive,
                  ]}
                >
                  {isRecording
                    ? `● ${String(Math.floor(recordSeconds / 60)).padStart(2, "0")}:${String(recordSeconds % 60).padStart(2, "0")}`
                    : "Sẵn sàng"}
                </Text>
              </View>
            </View>
            {!isRecording ? (
              <TouchableOpacity
                style={[
                  styles.popupAction,
                  {
                    borderColor: "rgba(37,99,235,.45)",
                    backgroundColor: "rgba(37,99,235,.1)",
                  },
                ]}
                onPress={startRecording}
              >
                <Mic size={18} color="#60a5fa" />
                <Text style={[styles.popupActionText, { color: "#60a5fa" }]}>
                  Bắt đầu ghi âm
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.popupAction,
                  {
                    borderColor: "rgba(248,113,113,.45)",
                    backgroundColor: "rgba(248,113,113,.1)",
                  },
                ]}
                onPress={stopRecording}
              >
                <Mic size={18} color="#fca5a5" />
                <Text style={[styles.popupActionText, { color: "#fca5a5" }]}>
                  Dừng và gửi
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Sticker popup */}
      <Modal
        visible={activePopup === "sticker"}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePopup(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActivePopup(null)}
        >
          <View style={styles.popupSheet}>
            <Text style={styles.popupTitle}>Nhãn dán</Text>
            <View style={styles.stickerGrid}>
              {CHAT_STICKER_LIST.map((url, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.stickerItem}
                  onPress={async () => {
                    await sendStructuredMessage({
                      version: 1,
                      kind: "sticker",
                      stickerUrl: url,
                    });
                    setActivePopup(null);
                  }}
                >
                  <Image
                    source={{ uri: url }}
                    style={styles.stickerImg}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Emoji popup */}
      <Modal
        visible={activePopup === "emoji"}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePopup(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActivePopup(null)}
        >
          <View style={styles.popupSheet}>
            <Text style={styles.popupTitle}>Emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJI_LIST.map((emoji, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.emojiItem}
                  onPress={() => {
                    setInput((prev) => prev + emoji);
                    setActivePopup(null);
                  }}
                >
                  <Text style={styles.emojiItemText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Poll popup */}
      <Modal
        visible={activePopup === "poll"}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePopup(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActivePopup(null)}
        >
          <View style={[styles.popupSheet, { paddingBottom: 24 }]}>
            <Text style={styles.popupTitle}>Tạo cuộc thăm dò</Text>
            <TextInput
              style={styles.pollInput}
              placeholder="Câu hỏi bình chọn"
              placeholderTextColor="#64748b"
              value={pollQuestion}
              onChangeText={setPollQuestion}
            />
            {pollOptions.map((opt, i) => (
              <TextInput
                key={i}
                style={styles.pollInput}
                placeholder={`Lựa chọn ${i + 1}`}
                placeholderTextColor="#64748b"
                value={opt}
                onChangeText={(text) => {
                  const next = [...pollOptions];
                  next[i] = text;
                  setPollOptions(next);
                }}
              />
            ))}
            <View style={styles.pollActions}>
              <TouchableOpacity
                style={styles.pollAddBtn}
                onPress={() => setPollOptions((p) => [...p, ""])}
              >
                <Text style={styles.pollAddBtnText}>+ Thêm</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pollSubmitBtn}
                onPress={handleCreatePoll}
              >
                <Text style={styles.pollSubmitBtnText}>Tạo bình chọn</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Context menu */}
      <Modal
        visible={!!contextMenu?.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setContextMenu(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setContextMenu(null)}
        >
          <View style={styles.contextMenu}>
            {contextMenu && !contextMenu.message.isRecalled && (
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={() => {
                  setReplyingTo(contextMenu.message);
                  setContextMenu(null);
                }}
              >
                <Reply size={16} color="#e2e8f0" />
                <Text style={styles.contextMenuText}>Trả lời</Text>
              </TouchableOpacity>
            )}

            {contextMenu && canRecall(contextMenu.message) && (
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={handleRecall}
              >
                <RotateCcw size={16} color="#e2e8f0" />
                <Text style={styles.contextMenuText}>Thu hồi</Text>
              </TouchableOpacity>
            )}

            {contextMenu && !contextMenu.message.isRecalled && (
              <TouchableOpacity
                style={[styles.contextMenuItem, styles.contextMenuDanger]}
                onPress={handleDeleteForMe}
              >
                <Trash2 size={16} color="#fca5a5" />
                <Text style={[styles.contextMenuText, { color: "#fca5a5" }]}>
                  Xóa phía tôi
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#060d1f" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  backBtn: { width: 40 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { color: "white", fontSize: 16, fontWeight: "700" },
  strangerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
    backgroundColor: "rgba(148,163,184,0.1)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  strangerBadgeText: { color: "#94a3b8", fontSize: 10, marginLeft: 3 },

  // Messages
  listContent: { padding: 16, paddingBottom: 8 },
  msgWrapper: { marginBottom: 10 },
  msgRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  msgRowMine: { justifyContent: "flex-end" },
  msgRowOther: { justifyContent: "flex-start" },

  // Bubble
  bubble: {
    maxWidth: "75%",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
  },
  myBubble: {
    backgroundColor: "#1d4ed8",
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#1e293b",
    borderBottomLeftRadius: 4,
  },
  recalledBubble: {
    backgroundColor: "rgba(15,23,42,0.4)",
    borderStyle: "dashed",
    borderColor: "rgba(148,163,184,0.45)",
  },
  msgText: { color: "white", fontSize: 15, lineHeight: 21 },
  msgTime: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
  },
  recalledText: { color: "#94a3b8", fontStyle: "italic", fontSize: 13 },

  // Seen
  seenRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingRight: 6,
    marginTop: 2,
  },
  seenAvatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#60a5fa",
  },
  seenAvatarPlaceholder: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#60a5fa",
  },

  // Reply quote inside bubble
  replyQuote: {
    borderLeftWidth: 3,
    borderLeftColor: "rgba(59,130,246,0.9)",
    backgroundColor: "rgba(2,132,199,0.12)",
    borderRadius: 8,
    padding: 7,
    marginBottom: 6,
  },
  replyQuoteName: { color: "#bfdbfe", fontWeight: "600", fontSize: 12 },
  replyQuotePreview: { color: "#cbd5e1", fontSize: 12, marginTop: 2 },

  // Emoji message
  emojiMsg: { fontSize: 32, lineHeight: 40 },

  // Image message
  imageMsg: { width: 200, height: 200, borderRadius: 12 },

  // File / audio
  fileMsg: { color: "#bfdbfe", fontSize: 14 },
  audioMsg: { color: "#bfdbfe", fontSize: 14 },

  // Sticker
  stickerMsg: { width: 120, height: 120 },

  // Poll
  pollContainer: {
    minWidth: 240,
    backgroundColor: "#18181b",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 10,
  },
  pollQuestion: {
    color: "#fafafa",
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 2,
  },
  pollMeta: { color: "#71717a", fontSize: 12, marginBottom: 6 },
  pollOption: {
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    backgroundColor: "#09090b",
  },
  pollOptionVoted: {
    borderColor: "#6366f1",
    backgroundColor: "rgba(99,102,241,0.05)",
  },
  pollBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.03)",
    zIndex: 0,
  },
  pollOptionContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1,
  },
  pollOptionLabel: { color: "#e4e4e7", fontWeight: "600", fontSize: 13 },
  pollOptionLabelVoted: { color: "#818cf8" },
  pollPercent: { color: "#71717a", fontWeight: "700", fontSize: 12 },
  pollPercentVoted: { color: "#818cf8" },

  // Stranger
  strangerWaiting: {
    margin: 12,
    padding: 12,
    backgroundColor: "rgba(37,99,235,0.08)",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.2)",
    borderRadius: 12,
  },
  strangerWaitingText: { color: "#94a3b8", fontSize: 13, textAlign: "center" },
  strangerRequest: {
    margin: 12,
    backgroundColor: "rgba(30,41,59,0.9)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    borderRadius: 14,
    padding: 14,
  },
  strangerRequestHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  strangerAvatar: { width: 36, height: 36, borderRadius: 18 },
  strangerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  strangerAvatarInitial: { color: "white", fontWeight: "700", fontSize: 14 },
  strangerName: { color: "#f1f5f9", fontWeight: "600", fontSize: 14 },
  strangerSub: { color: "#94a3b8", fontSize: 12 },
  strangerDesc: {
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  strangerActions: { flexDirection: "row", gap: 8 },
  acceptBtn: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  acceptBtnText: { color: "white", fontWeight: "600", fontSize: 13 },
  declineBtn: {
    flex: 1,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.4)",
    backgroundColor: "rgba(248,113,113,0.1)",
    alignItems: "center",
  },
  declineBtnText: { color: "#fca5a5", fontWeight: "600", fontSize: 13 },

  // Typing
  typingRow: { height: 20, paddingHorizontal: 16, justifyContent: "center" },
  typingText: { color: "#94a3b8", fontSize: 12 },

  // Input area
  inputWrapper: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 32 : 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0a1022",
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(30,64,175,0.22)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.4)",
    borderRadius: 12,
    padding: 8,
    marginBottom: 8,
  },
  replyBannerName: { color: "#bfdbfe", fontSize: 12, fontWeight: "600" },
  replyBannerPreview: { color: "#cbd5e1", fontSize: 12, marginTop: 1 },

  actionsRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.08)",
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  inputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  textInput: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === "ios" ? 10 : 8,
    paddingBottom: Platform.OS === "ios" ? 10 : 8,
    color: "white",
    fontSize: 15,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  popupSheet: {
    backgroundColor: "#0c1a38",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(148,163,184,0.22)",
    padding: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  popupTitle: {
    color: "#f1f5f9",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 14,
  },
  popupAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 8,
  },
  popupActionText: { color: "#e2e8f0", fontSize: 14 },

  // Audio
  audioHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  recordBadge: {
    backgroundColor: "rgba(100,116,139,0.1)",
    borderWidth: 0.5,
    borderColor: "rgba(100,116,139,0.2)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  recordBadgeActive: {
    backgroundColor: "rgba(252,165,165,0.1)",
    borderColor: "rgba(252,165,165,0.25)",
  },
  recordBadgeText: { color: "#64748b", fontSize: 12 },
  recordBadgeTextActive: { color: "#fca5a5" },

  // Sticker
  stickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stickerItem: {
    width: "30%",
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "rgba(148,163,184,0.15)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 6,
    alignItems: "center",
  },
  stickerImg: { width: "100%", height: 80 },

  // Emoji picker
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiItem: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  emojiItemText: { fontSize: 24 },

  // Poll inputs
  pollInput: {
    borderWidth: 0.5,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "#f1f5f9",
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  pollActions: { flexDirection: "row", gap: 8, marginTop: 6 },
  pollAddBtn: {
    borderWidth: 0.5,
    borderColor: "rgba(148,163,184,0.25)",
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pollAddBtnText: { color: "#94a3b8", fontSize: 13 },
  pollSubmitBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flex: 1,
    alignItems: "center",
  },
  pollSubmitBtnText: { color: "white", fontWeight: "600", fontSize: 13 },

  // Context menu
  contextMenu: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(148,163,184,0.22)",
    padding: 10,
    paddingBottom: Platform.OS === "ios" ? 36 : 16,
  },
  contextMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 12,
  },
  contextMenuDanger: {
    marginTop: 4,
  },
  contextMenuText: { color: "#e2e8f0", fontSize: 14 },
});
