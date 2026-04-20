import ConversationInfoPanel from "@/components/ConversationInfoPanel";
import GroupConversationInfoPanel from "@/components/GroupConversationInfoPanel";
import { lozaBotService } from "@/services/lozaBotService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import {
  CHAT_THEME_OPTIONS,
  getChatThemeById,
  useChatThemeStore,
} from "@/stores/useChatThemeStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type {
  ChatStructuredPayload,
  Message,
  MessageReaction,
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
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  BarChart3,
  ChevronLeft,
  Copy,
  FileUp,
  Image as ImageIcon,
  Info,
  Key,
  Mic,
  Palette,
  Pause,
  Pencil,
  Phone,
  Pin,
  PinOff,
  Play,
  Reply,
  RotateCcw,
  Send,
  SmilePlus,
  Sticker,
  Trash2,
  User as UserIcon,
  UserPlus,
  Video,
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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { styles } from "../style/chatstyle";
import { chatService } from "@/services/chatService";
import { useFriendStore } from "@/stores/useFriendStore";

// ─── Types ────────────────────────────────────────────────────────────────────
type PopupType = "media" | "sticker" | "audio" | "poll" | "theme" | null;

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

interface VoteDetailModalState {
  pollId: string;
  activeOptionId: string | null;
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

const REACTION_OPTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏"];
const VOTE_PAGE_SIZE = 5;
const LOZA_BOT_NAME = "LozaBot";
const LOZA_BOT_COMMAND_REGEX = /^@(LozaBot|lozabot)\s+(.+)$/i;
const LOZA_BOT_MENTION_REGEX = /^@(LozaBot|lozabot)\b/i;
const LOZA_BOT_SUGGESTIONS = [
  "Tóm tắt cuộc trò chuyện từ tin nhắn cuối cùng",
  "Liệt kê các việc cần làm theo mức ưu tiên",
  "Soạn câu trả lời ngắn gọn và lịch sự",
];

function createPollId() {
  return `poll_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getAudioUploadMeta(uri: string) {
  const ext = (uri.split(".").pop() || "m4a").toLowerCase();
  const mimeByExt: Record<string, string> = {
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    aac: "audio/aac",
    wav: "audio/wav",
    ogg: "audio/ogg",
    webm: "audio/webm",
    mp3: "audio/mpeg",
  };
  return {
    name: `recording-${Date.now()}.${ext}`,
    type: mimeByExt[ext] || "audio/mp4",
  };
}

function getSenderName(
  message: Message,
  myId: string | undefined,
  participants: Array<{ _id: string; displayName: string }> = [],
) {
  // Tìm trong participants luôn, không phân biệt mình hay người khác
  return (
    participants.find((p) => p._id === message.senderId)?.displayName ||
    "Người dùng"
  );
}

function formatCallDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatMessageDateTime(dateString: string) {
  return new Date(dateString).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAvatarColor(name: string) {
  const colors = [
    "#3b82f6",
    "#10b981",
    "#8b5cf6",
    "#f59e0b",
    "#ef4444",
    "#06b6d4",
    "#ec4899",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SenderAvatarProps {
  participant?: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
    role?: "owner" | "admin" | "member";
  };
  size?: number;
}

function SenderAvatar({ participant, size = 28 }: SenderAvatarProps) {
  const name = participant?.displayName || "?";
  const color = getAvatarColor(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: participant?.avatarUrl ? undefined : color,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        alignSelf: "flex-end",
        marginBottom: 2,
        flexShrink: 0,
      }}
    >
      {participant?.avatarUrl ? (
        <Image
          source={{ uri: participant.avatarUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text
          style={{ color: "white", fontWeight: "700", fontSize: size * 0.38 }}
        >
          {name.slice(0, 2).toUpperCase()}
        </Text>
      )}
      {participant?.role === "owner" && (
        <View style={styles.roleIcon}>
          <Key size={8} color="yellow" />
        </View>
      )}
      {participant?.role === "admin" && (
        <View style={styles.roleIcon}>
          <Key size={8} color="white" />
        </View>
      )}
    </View>
  );
}

interface GroupSeenAvatarsProps {
  seenParticipants: Array<{
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  }>;
}

function GroupSeenAvatars({ seenParticipants }: GroupSeenAvatarsProps) {
  if (seenParticipants.length === 0) return null;
  const MAX_SHOW = 4;
  const shown = seenParticipants.slice(0, MAX_SHOW);
  const overflow = seenParticipants.length - MAX_SHOW;
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 2,
        paddingRight: 4,
      }}
    >
      {shown.map((p, i) => (
        <View
          key={p._id}
          style={{
            width: 16,
            height: 16,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: "#0f172a",
            marginLeft: i === 0 ? 0 : -5,
            backgroundColor: "#334155",
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {p.avatarUrl ? (
            <Image
              source={{ uri: p.avatarUrl }}
              style={{ width: 16, height: 16 }}
            />
          ) : (
            <Text style={{ fontSize: 7, color: "#cbd5e1", fontWeight: "700" }}>
              {p.displayName?.[0]?.toUpperCase()}
            </Text>
          )}
        </View>
      ))}
      {overflow > 0 && (
        <View
          style={{
            marginLeft: -5,
            width: 16,
            height: 16,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: "#0f172a",
            backgroundColor: "#475569",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 7, color: "#f1f5f9", fontWeight: "700" }}>
            {overflow}+
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── AddMemberModal ───────────────────────────────────────────────────────────
interface AddMemberModalProps {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  currentParticipantIds: string[];
  onAdd: (targetUserId: string) => Promise<void>;
}

function AddMemberModal({
  visible,
  onClose,
  currentParticipantIds,
  onAdd,
}: AddMemberModalProps) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  // Lấy danh sách bạn bè chính thức từ Store
  const { friends, getFriends } = useFriendStore();

  useEffect(() => {
    if (visible) getFriends();
  }, [visible, getFriends]);

  // Lọc: Bạn bè + Chưa có trong nhóm + Theo tên search
  const eligible = useMemo(() => {
    return friends.filter(
      (f) =>
        !currentParticipantIds.includes(f._id) &&
        f.displayName.toLowerCase().includes(search.toLowerCase()),
    );
  }, [friends, currentParticipantIds, search]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {/* Lớp nền bấm để đóng */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.popupSheet, { height: "70%", width: "92%" }]}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <Text style={styles.popupTitle}>Thêm thành viên</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.pollInput}
            placeholder="Tìm bạn bè..."
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
          />

          <FlatList
            data={eligible}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <Text
                style={[
                  styles.emptyText,
                  { textAlign: "center", marginTop: 20 },
                ]}
              >
                Không tìm thấy bạn bè nào hợp lệ
              </Text>
            }
            renderItem={({ item: p }) => (
              <View style={styles.popupAction}>
                <SenderAvatar participant={p as any} size={32} />
                <Text
                  style={[styles.popupActionText, { flex: 1, marginLeft: 10 }]}
                >
                  {p.displayName}
                </Text>
                <TouchableOpacity
                  disabled={adding === p._id}
                  onPress={async () => {
                    setAdding(p._id);
                    await onAdd(p._id);
                    setAdding(null);
                  }}
                  style={{
                    backgroundColor: adding === p._id ? "#334155" : "#2563eb",
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  {adding === p._id ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text
                      style={{
                        color: "white",
                        fontWeight: "600",
                        fontSize: 12,
                      }}
                    >
                      Thêm
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
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
  const [voteDetailModal, setVoteDetailModal] =
    useState<VoteDetailModalState | null>(null);
  const [votePage, setVotePage] = useState(1);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageLoading, setPreviewImageLoading] = useState(false);
  const [previewImageError, setPreviewImageError] = useState<string | null>(
    null,
  );

  // Edit message
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editInput, setEditInput] = useState("");

  // Reaction
  const [reactionMenuMessage, setReactionMenuMessage] =
    useState<Message | null>(null);
  const [reactionViewerMessage, setReactionViewerMessage] =
    useState<Message | null>(null);

  // Pinned
  const [showPinnedModal, setShowPinnedModal] = useState(false);

  // Add member
  const [showAddMember, setShowAddMember] = useState(false);

  // Audio recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  // Forward
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(
    null,
  );
  const [forwardSearch, setForwardSearch] = useState("");
  const [selectedConvs, setSelectedConvs] = useState<string[]>([]);

  // Info panel
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  // LozaBot
  const [showLozaBotSuggestions, setShowLozaBotSuggestions] = useState(false);

  const conversationId =
    typeof id === "string" ? id : Array.isArray(id) ? String(id[0]) : undefined;

  if (!conversationId) return null;

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
    forwardMessage,
    editMessage,
    reactMessage,
    togglePinMessage,
    fetchPinnedMessages,
    addMemberToGroup,
    reviewJoinRequest,
    fetchJoinRequests,
    joinRequests,
  } = useChatStore();

  const { user, userProfile } = useAuthStore();
  const { socket, onlineUsers } = useSocketStore();

  const selectedThemeId = useChatThemeStore(
    (s) => s.selectedByConversation[conversationId],
  );
  const theme = getChatThemeById(selectedThemeId);

  const setThemeForConversation = useChatThemeStore(
    (s) => s.setThemeForConversation,
  );
  const dynamicStyles = {
    mainContainer: {
      flex: 1,
      backgroundColor: theme.appBackgroundColor,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 15,
      backgroundColor: theme.messageAreaOverlay,
    },

    myBubble: {
      backgroundColor: theme.mineBubbleColor,
    },
  };
  // ─── Derived data ───────────────────────────────────────────────────────────
  const activeConv = useMemo(
    () => conversations.find((c) => c._id === id),
    [conversations, id],
  );

  const isAdminOrOwner = useMemo(() => {
    if (!activeConv?.group) return false;
    const me = activeConv.participants.find((p) => p._id === user?.userId);
    return me?.role === "owner" || me?.role === "admin";
  }, [activeConv, user?.userId]);

  const activeChatTheme = useMemo(
    () => getChatThemeById(selectedThemeId),
    [selectedThemeId],
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

  const pinnedMessages = useMemo(
    () =>
      [...(activeConv?.pinnedMessages || [])]
        .sort(
          (a, b) =>
            new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime(),
        )
        .slice(0, 5),
    [activeConv?.pinnedMessages],
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

  const activeVotePoll = useMemo(() => {
    if (!voteDetailModal?.pollId) return null;
    return pollAggregates.get(voteDetailModal.pollId) || null;
  }, [pollAggregates, voteDetailModal?.pollId]);

  const activeVoteOptionId =
    voteDetailModal?.activeOptionId || activeVotePoll?.options[0]?.id || null;

  const activeVoteList = useMemo(() => {
    if (!activeVotePoll || !activeVoteOptionId) return [];
    return activeVotePoll.votes
      .filter((v) => v.optionId === activeVoteOptionId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [activeVoteOptionId, activeVotePoll]);

  const totalVotePages = useMemo(
    () => Math.max(1, Math.ceil(activeVoteList.length / VOTE_PAGE_SIZE)),
    [activeVoteList.length],
  );

  const pagedVoteList = useMemo(() => {
    const start = (votePage - 1) * VOTE_PAGE_SIZE;
    return activeVoteList.slice(start, start + VOTE_PAGE_SIZE);
  }, [activeVoteList, votePage]);

  const voteModalHeight = useMemo(() => {
    const rows = Math.min(VOTE_PAGE_SIZE, Math.max(1, activeVoteList.length));
    return Math.min(560, 250 + rows * 52);
  }, [activeVoteList.length]);

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

  // Group seen map
  const groupSeenMap = useMemo(() => {
    if (!activeConv?.group)
      return new Map<string, typeof activeConv.participants>();
    const map = new Map<string, typeof activeConv.participants>();
    activeConv.participants.forEach((p) => {
      if (p._id === user?.userId) return;
      if (!p.lastReadMessageId) return;
      const existing = map.get(p.lastReadMessageId) || [];
      map.set(p.lastReadMessageId, [...existing, p]);
    });
    return map;
  }, [activeConv, user?.userId]);

  // ─── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (id) {
      setActiveConversation(id as string);
      fetchMessages(id as string);
    }
    return () => {
      setActiveConversation(null);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void fetchPinnedMessages(id as string).catch(() => undefined);
  }, [id]);

  useEffect(() => {
    if (isAdminOrOwner && id) {
      fetchJoinRequests(id as string);
    }
  }, [id, isAdminOrOwner]);

  useEffect(() => {
    if (!id || !activeConv?.chatThemeId) return;
    setThemeForConversation(id as string, activeConv.chatThemeId);
  }, [activeConv?.chatThemeId, id, setThemeForConversation]);

  useEffect(() => {
    if (!id || !socket) return;
    const items = currentMessages;
    if (items.length === 0) return;
    const lastMsg = items.at(-1);
    if (!lastMsg || lastMsg.senderId === user?.userId) return;
    socket.emit("mark-read", { conversationId: id, messageId: lastMsg._id });
  }, [id, currentMessages, socket, user?.userId]);

  useEffect(() => {
    if (displayMessages.length > 0) {
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  }, [displayMessages.length]);

  useEffect(() => {
    setVotePage(1);
  }, [voteDetailModal?.pollId, voteDetailModal?.activeOptionId]);

  useEffect(() => {
    if (votePage > totalVotePages) setVotePage(totalVotePages);
  }, [totalVotePages, votePage]);

  useEffect(() => {
    setShowLozaBotSuggestions(LOZA_BOT_MENTION_REGEX.test(input.trim()));
  }, [input]);

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

  const isPinnedMessage = useCallback(
    (messageId: string) =>
      !!(activeConv?.pinnedMessages || []).find(
        (item) => item.messageId === messageId,
      ),
    [activeConv?.pinnedMessages],
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

  // ─── Audio ──────────────────────────────────────────────────────────────────
  const stopAndReleaseSound = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
    } catch {
    } finally {
      soundRef.current = null;
      setPlayingMessageId(null);
      setLoadingAudioId(null);
    }
  }, []);

  const handleToggleAudioPlayback = useCallback(
    async (messageId: string, audioUrl: string) => {
      try {
        if (playingMessageId === messageId) {
          await stopAndReleaseSound();
          return;
        }
        setLoadingAudioId(messageId);
        await stopAndReleaseSound();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          playThroughEarpieceAndroid: false,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true, volume: 1 },
        );
        soundRef.current = sound;
        setPlayingMessageId(messageId);
        setLoadingAudioId(null);
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          if (status.didJustFinish) void stopAndReleaseSound();
        });
      } catch {
        setLoadingAudioId(null);
        setPlayingMessageId(null);
        Alert.alert("Lỗi", "Không thể phát âm thanh");
      }
    },
    [playingMessageId, stopAndReleaseSound],
  );

  // ─── Send text ───────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    if (!input.trim() || sending) return;
    try {
      setSending(true);
      const trimmedInput = input.trim();
      const botMatch = trimmedInput.match(LOZA_BOT_COMMAND_REGEX);
      const isBotMention = LOZA_BOT_MENTION_REGEX.test(trimmedInput);

      const payload: ChatStructuredPayload = {
        version: 1,
        kind: replyingTo ? "reply" : "text",
        text: trimmedInput,
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

      if (isBotMention && botMatch?.[2]) {
        const botRequest = botMatch[2].trim();
        const lastOwnIndex = [...displayMessages].reverse().findIndex((m) => {
          if (m.senderId !== user?.userId) return false;
          const p = decodeChatPayload(m.content);
          const text = p?.text || m.content || "";
          return !LOZA_BOT_MENTION_REGEX.test(text.trim());
        });
        const startIndex =
          lastOwnIndex < 0
            ? 0
            : Math.max(0, displayMessages.length - 1 - lastOwnIndex);
        const contextWindow = displayMessages.slice(startIndex);
        const contextMessages = contextWindow.map((m) => {
          const preview = getSafeMessagePreview(m.content);
          const senderName =
            m.senderId === user?.userId
              ? userProfile?.displayName || user?.username || "Bạn"
              : getSenderName(m, user?.userId, activeConv?.participants || []);
          return {
            sender: (m.senderId === user?.userId ? "me" : "other") as
              | "me"
              | "other",
            senderName,
            at: m.createdAt,
            content: preview,
          };
        });
        try {
          const answer = await lozaBotService.ask({
            conversationId: id as string,
            request: botRequest,
            fromLastOwnMessage: true,
            messages:
              contextMessages.length > 0
                ? contextMessages
                : [
                    {
                      sender: "me",
                      senderName:
                        userProfile?.displayName || user?.username || "Bạn",
                      at: new Date().toISOString(),
                      content: botRequest,
                    },
                  ],
          });
          const botReply =
            answer?.trim() || "Mình chưa có dữ liệu để trả lời lúc này.";
          const systemContent = `{{system}}🤖 LozaBot: ${botReply}`;
          if (activeConv?.group) {
            await sendGroupMessage(id as string, { content: systemContent });
          } else if (otherUser?._id) {
            await sendDirectMessage(otherUser._id, { content: systemContent });
          }
        } catch {
          Alert.alert("LozaBot", "LozaBot đang bận, thử lại sau nhé");
        }
      } else if (isBotMention && !botMatch?.[2]) {
        Alert.alert(
          "LozaBot",
          "Thêm yêu cầu sau @LozaBot, ví dụ: @LozaBot tóm tắt đoạn chat",
        );
      }

      setInput("");
      setReplyingTo(null);
      setShowLozaBotSuggestions(false);
      if (socket?.connected) socket.emit("stop-typing", { conversationId: id });
    } catch {
      Alert.alert("Lỗi", "Không thể gửi tin nhắn");
    } finally {
      setSending(false);
    }
  }, [
    activeConv?.participants,
    activeConv?.group,
    displayMessages,
    id,
    input,
    otherUser?._id,
    replyingTo,
    sendDirectMessage,
    sendGroupMessage,
    sendStructuredMessage,
    sending,
    socket,
    user?.userId,
    user?.username,
    userProfile?.displayName,
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

  // ─── Pick image (multiple) ───────────────────────────────────────────────────
  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (!result.canceled && result.assets.length > 0) {
      try {
        setSending(true);
        if (result.assets.length === 1) {
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
        } else {
          const uploadedList = await Promise.all(
            result.assets.map((asset) =>
              uploadAttachment({
                uri: asset.uri,
                name: asset.fileName || `image-${Date.now()}.jpg`,
                type: asset.mimeType || "image/jpeg",
                size: asset.fileSize,
              } as any),
            ),
          );
          await sendStructuredMessage({
            version: 1,
            kind: "image",
            attachments: uploadedList.map((u) => ({
              name: u.fileName,
              url: u.url,
              mimeType: u.mimeType,
              size: u.size,
            })),
          });
        }
      } catch {
        Alert.alert("Lỗi", "Upload ảnh thất bại");
      } finally {
        setSending(false);
        setActivePopup(null);
      }
    }
  }, [sendAttachmentMessage, sendStructuredMessage, uploadAttachment]);

  const handlePickFile = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
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
      recordingTimerRef.current = setInterval(
        () => setRecordSeconds((prev) => prev + 1),
        1000,
      );
    } catch {
      Alert.alert("Lỗi", "Không thể truy cập micro để ghi âm");
    }
  }, [isRecording]);

  const stopRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        playThroughEarpieceAndroid: false,
      });
      const uri = recording.getURI();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setRecordSeconds(0);
      recordingRef.current = null;
      if (uri) {
        const audioMeta = getAudioUploadMeta(uri);
        await sendAttachmentMessage(
          { uri, name: audioMeta.name, type: audioMeta.type },
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

  // ─── Recall / Delete / Edit ──────────────────────────────────────────────────
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

  const handleEdit = useCallback(async () => {
    if (!editingMessage || !id || !editInput.trim()) return;
    if (editInput.trim() === editingMessage.content) {
      setEditingMessage(null);
      return;
    }
    try {
      await editMessage(editingMessage._id, id as string, editInput.trim());
    } catch {
      Alert.alert("Lỗi", "Không thể sửa tin nhắn");
    } finally {
      setEditingMessage(null);
      setEditInput("");
    }
  }, [editingMessage, id, editInput, editMessage]);

  const handleTogglePin = useCallback(
    async (message: Message) => {
      if (!id) return;
      setContextMenu(null);
      try {
        await togglePinMessage(message._id, id as string);
      } catch {
        Alert.alert("Lỗi", "Không thể cập nhật ghim");
      }
    },
    [id, togglePinMessage],
  );

  const handlePickReaction = useCallback(
    async (message: Message, emoji: string) => {
      if (!id) return;
      setReactionMenuMessage(null);
      try {
        await reactMessage(message._id, id as string, emoji);
      } catch {
        Alert.alert("Lỗi", "Không thể thả cảm xúc");
      }
    },
    [id, reactMessage],
  );

  // ─── Copy ────────────────────────────────────────────────────────────────────
  const getCopyableMessageText = useCallback((message: Message) => {
    if (message.isRecalled) return "";
    const payload = decodeChatPayload(message.content);
    if (!payload) return message.content?.trim() || message.imgUrl || "";
    if (payload.kind === "text") return payload.text?.trim() || "";
    if (payload.kind === "reply") return payload.text?.trim() || "";
    if (payload.kind === "emoji") return payload.emoji || "";
    if (payload.kind === "image") return payload.attachment?.url || "";
    if (payload.kind === "sticker") return payload.stickerUrl || "";
    if (payload.kind === "poll" && payload.poll)
      return `${payload.poll.question}\n${payload.poll.options.map((o) => `- ${o.label}`).join("\n")}`;
    return getSafeMessagePreview(message.content);
  }, []);

  const isFileMessage = useCallback((message: Message) => {
    const payload = decodeChatPayload(message.content);
    return payload?.kind === "file" && !!payload.attachment;
  }, []);

  const handleCopyMessage = useCallback(async () => {
    if (!contextMenu) return;
    if (isFileMessage(contextMenu.message)) {
      Alert.alert("Thông báo", "Tin nhắn file không cho phép sao chép");
      setContextMenu(null);
      return;
    }
    const copyText = getCopyableMessageText(contextMenu.message);
    if (!copyText) {
      Alert.alert("Thông báo", "Tin nhắn này không có nội dung để sao chép");
      return;
    }
    try {
      await Clipboard.setStringAsync(copyText);
      Alert.alert("Đã sao chép", "Nội dung tin nhắn đã được sao chép");
    } catch {
      Alert.alert("Lỗi", "Không thể sao chép tin nhắn");
    } finally {
      setContextMenu(null);
    }
  }, [contextMenu, getCopyableMessageText, isFileMessage]);

  const handleOpenAttachment = useCallback(async (url: string) => {
    if (!url) return;
    try {
      await WebBrowser.openBrowserAsync(encodeURI(url));
    } catch {
      Alert.alert("Lỗi", "Không thể mở tệp này");
    }
  }, []);

  const openImagePreview = useCallback((url?: string | null) => {
    if (!url) return;
    setPreviewImageError(null);
    setPreviewImageLoading(true);
    setPreviewImageUrl(encodeURI(url));
  }, []);

  // ─── Render message ──────────────────────────────────────────────────────────
  const renderStructuredMessage = useCallback(
    (message: Message, isMine: boolean) => {
      if (message.isRecalled) {
        return (
          <Text style={styles.recalledText}>Tin nhắn đã được thu hồi</Text>
        );
      }

      // System message inline
      if (
        message.type === "system" ||
        message.content?.startsWith("{{system}}")
      ) {
        const text = message.content.replace("{{system}}", "");
        return (
          <View
            style={{
              alignItems: "center",
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{ fontSize: 12, color: "#94a3b8", textAlign: "center" }}
            >
              {text}
            </Text>
          </View>
        );
      }

      const payload = decodeChatPayload(message.content);
      const openMenu = () => {
        if (!message.isRecalled) setContextMenu({ message, visible: true });
      };

      if (!payload) {
        if (message.imgUrl) {
          return (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => openImagePreview(message.imgUrl)}
            >
              <Image
                source={{ uri: message.imgUrl }}
                style={styles.imageMsg}
                resizeMode="cover"
              />
            </TouchableOpacity>
          );
        }
        return (
          <Text style={[styles.msgText, isMine && styles.msgTextMine]}>
            {message.content || ""}
          </Text>
        );
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
            <Text style={[styles.msgText, isMine && styles.msgTextMine]}>
              {payload.text || ""}
            </Text>
          </View>
        );
      }

      if (payload.kind === "emoji") {
        return <Text style={styles.emojiMsg}>{payload.emoji || "🙂"}</Text>;
      }

      if (payload.kind === "image" && payload.attachment?.url) {
        return (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => openImagePreview(payload.attachment?.url)}
            onLongPress={openMenu}
            delayLongPress={300}
          >
            <Image
              source={{ uri: payload.attachment.url }}
              style={styles.imageMsg}
              resizeMode="cover"
            />
          </TouchableOpacity>
        );
      }

      // Multiple images
      if (payload.kind === "image" && payload.attachments?.length) {
        const atts = payload.attachments;
        if (atts.length === 1) {
          return (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => openImagePreview(atts[0].url)}
              onLongPress={openMenu}
              delayLongPress={300}
            >
              <Image
                source={{ uri: atts[0].url }}
                style={styles.imageMsg}
                resizeMode="cover"
              />
            </TouchableOpacity>
          );
        }
        return (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 4,
              maxWidth: 220,
            }}
          >
            {atts.map((img, index) => (
              <TouchableOpacity
                key={img.url || index}
                activeOpacity={0.9}
                onPress={() => openImagePreview(img.url)}
                onLongPress={openMenu}
                delayLongPress={300}
              >
                <Image
                  source={{ uri: img.url }}
                  style={{ width: 104, height: 104, borderRadius: 10 }}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </View>
        );
      }

      if (payload.kind === "file" && payload.attachment) {
        return (
          <TouchableOpacity
            style={styles.fileAction}
            onPress={() => void handleOpenAttachment(payload.attachment!.url)}
            onLongPress={openMenu}
            delayLongPress={300}
          >
            <Text style={styles.fileMsg}>📎 {payload.attachment.name}</Text>
            <Text style={styles.fileHint}>Nhấn để mở tệp</Text>
          </TouchableOpacity>
        );
      }

      if (payload.kind === "audio" && payload.attachment?.url) {
        const messageId = message._id?.toString() || message.createdAt;
        const isPlaying = playingMessageId === messageId;
        const isLoading = loadingAudioId === messageId;
        return (
          <TouchableOpacity
            style={styles.audioPlayer}
            onPress={() =>
              void handleToggleAudioPlayback(messageId, payload.attachment!.url)
            }
            activeOpacity={0.8}
          >
            <View style={styles.audioPlayBtn}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#1e293b" />
              ) : isPlaying ? (
                <Pause size={16} color="#1e293b" />
              ) : (
                <Play size={16} color="#1e293b" />
              )}
            </View>
            <Text style={styles.audioMsg}>
              {isPlaying ? "Đang phát ghi âm..." : "Nhấn để phát ghi âm"}
            </Text>
          </TouchableOpacity>
        );
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

      // Call message
      if (payload.kind === "call" && payload.call) {
        const callLabel =
          payload.call.callType === "video"
            ? "Cuộc gọi video"
            : "Cuộc gọi thoại";
        return (
          <View style={styles.callCard}>
            <View
              style={[
                styles.callIconWrapper,
                {
                  backgroundColor:
                    payload.call.callType === "video"
                      ? "rgba(59,130,246,.15)"
                      : "rgba(16,185,129,.15)",
                },
              ]}
            >
              {payload.call.callType === "video" ? (
                <Video size={18} color="#60a5fa" />
              ) : (
                <Phone size={18} color="#34d399" />
              )}
            </View>
            <View>
              <Text style={styles.callLabel}>{callLabel}</Text>
              <Text style={styles.callDuration}>
                {formatCallDuration(payload.call.durationSeconds || 0)} •{" "}
                {payload.call.endedAt
                  ? formatMessageDateTime(payload.call.endedAt)
                  : "Đang diễn ra"}
              </Text>
              {payload.call.upgradedFrom === "voice" &&
                payload.call.upgradedTo === "video" && (
                  <Text style={styles.callUpgradeNote}>
                    Đã nâng cấp từ gọi thoại sang video
                  </Text>
                )}
            </View>
          </View>
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
            <TouchableOpacity
              style={styles.pollDetailBtn}
              onPress={() =>
                setVoteDetailModal({
                  pollId: payload.poll!.id,
                  activeOptionId:
                    votedOption || payload.poll?.options[0]?.id || null,
                })
              }
            >
              <Text style={styles.pollDetailBtnText}>Xem người vote</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <Text style={[styles.msgText, isMine && styles.msgTextMine]}>
          {payload.text || payload.emoji || message.content || ""}
        </Text>
      );
    },
    [
      openImagePreview,
      handleOpenAttachment,
      handleToggleAudioPlayback,
      handleVote,
      loadingAudioId,
      playingMessageId,
      pollAggregates,
      user?.userId,
    ],
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => {
      const isMine = item.senderId === user?.userId;
      const isGroup = !!activeConv?.group;
      const payload = decodeChatPayload(item.content);

      // System message
      if (item.type === "system" || item.content?.startsWith("{{system}}")) {
        const text = item.content.replace("{{system}}", "");
        return (
          <View style={styles.systemMsgWrapper}>
            <Text style={styles.systemMsgText}>{text}</Text>
          </View>
        );
      }

      const isPollCard =
        payload?.kind === "poll" && !!payload.poll && !item.isRecalled;
      const isImageCard =
        !item.isRecalled &&
        ((payload?.kind === "image" &&
          (!!payload.attachment?.url || !!payload.attachments?.length)) ||
          (!payload && !!item.imgUrl));
      const isFileCard = payload?.kind === "file" && !!payload.attachment;
      const isAudioCard =
        payload?.kind === "audio" && !!payload.attachment?.url;
      const isAttachmentCard = isFileCard || isAudioCard;
      const isLastRead =
        otherLastReadMessageId &&
        item._id?.toString() === otherLastReadMessageId.toString();
      const groupSeenParticipants = isGroup
        ? groupSeenMap.get(item._id?.toString()) || []
        : [];

      const senderParticipant = !isMine
        ? activeConv?.participants.find((p) => p._id === item.senderId)
        : undefined;

      return (
        <View style={styles.msgWrapper}>
          {/* Group sender name */}
          {!isMine && (
            <Text style={styles.senderName}>
              {senderParticipant?.displayName || "Người dùng"}
            </Text>
          )}
          <View
            style={[
              styles.msgRow,
              isPollCard
                ? styles.msgRowPoll
                : isMine
                  ? styles.msgRowMine
                  : styles.msgRowOther,
            ]}
          >
            {/* Group sender avatar */}
            {!isMine && senderParticipant && (
              <SenderAvatar participant={senderParticipant} />
            )}

            {/* Reaction button left (for others) */}
            {isMine && !item.isRecalled && (
              <TouchableOpacity
                onPress={() => setReactionMenuMessage(item)}
                style={styles.reactionBtn}
              >
                <SmilePlus size={16} color="#64748b" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onLongPress={() => {
                if (!item.isRecalled)
                  setContextMenu({ message: item, visible: true });
              }}
              delayLongPress={300}
              activeOpacity={0.85}
              style={[
                isPollCard
                  ? styles.pollCardShell
                  : isImageCard
                    ? styles.imageCardShell
                    : isAttachmentCard
                      ? styles.attachmentCardShell
                      : styles.bubble,
                !isPollCard &&
                  !isImageCard &&
                  !isAttachmentCard &&
                  (item.isRecalled
                    ? styles.recalledBubble
                    : isMine
                      ? styles.myBubble
                      : styles.otherBubble),
              ]}
            >
              {renderStructuredMessage(item, isMine)}
            </TouchableOpacity>

            {/* Reaction button right (for mine) */}
            {!isMine && !item.isRecalled && (
              <TouchableOpacity
                onPress={() => setReactionMenuMessage(item)}
                style={[styles.reactionBtn, { marginRight: 6 }]}
              >
                <SmilePlus size={16} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>

          {/* Reactions display */}
          {!!item.reactions?.length && (
            <View
              style={[
                styles.reactionsRow,
                {
                  alignSelf: isMine ? "flex-end" : "flex-start",
                  flexDirection: "row",
                },
              ]}
            >
              {(
                Object.entries(
                  (item.reactions || []).reduce(
                    (acc: Record<string, number>, r: MessageReaction) => {
                      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                      return acc;
                    },
                    {} as Record<string, number>,
                  ),
                ) as Array<[string, number]>
              ).map(([emoji, count]) => (
                <TouchableOpacity
                  key={`${item._id}-${emoji}`}
                  onPress={() => setReactionViewerMessage(item)}
                  style={styles.reactionChip}
                >
                  <Text style={styles.reactionChipText}>
                    {emoji} {count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View
            style={[
              styles.msgTimeRow,
              isPollCard
                ? styles.msgTimeRowCenter
                : isMine
                  ? styles.msgTimeRowMine
                  : styles.msgTimeRowOther,
            ]}
          >
            {item.isEdited && !item.isRecalled && (
              <Text
                style={[styles.editedLabel, isMine ? { color: "#94a3b8" } : {}]}
              >
                (đã chỉnh sửa){" "}
              </Text>
            )}
            <Text
              style={[
                styles.msgTime,
                isMine ? styles.msgTimeMine : styles.msgTimeOther,
                (isFileCard || isAudioCard) && styles.msgTimeLightCard,
              ]}
            >
              {formatTime(item.createdAt)}
            </Text>
          </View>

          {/* Direct: seen avatar */}
          {isMine && !item.isRecalled && isLastRead && !isGroup && (
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

          {/* Group: seen avatars */}
          {isMine &&
            !item.isRecalled &&
            isGroup &&
            groupSeenParticipants.length > 0 && (
              <GroupSeenAvatars seenParticipants={groupSeenParticipants} />
            )}
        </View>
      );
    },
    [
      activeConv,
      groupSeenMap,
      otherLastReadMessageId,
      otherUser?.avatarUrl,
      renderStructuredMessage,
      user?.userId,
    ],
  );

  // ─── Render ──────────────────────────────────────────────────────────────────
  const myReaction = reactionMenuMessage
    ? (reactionMenuMessage.reactions || []).find(
        (r) => r.userId === user?.userId,
      )?.emoji
    : undefined;

  const groupAvatars =
    activeConv?.participants?.map((p) => p.avatarUrl).filter(Boolean) || [];

  return (
    <View style={[styles.mainContainer, dynamicStyles.mainContainer]}>
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
            <View
              style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
            >
              {/* ================= AVATAR SECTION ================= */}
              <View style={{ position: "relative", marginRight: 12 }}>
                {activeConv?.group ? (
                  <View style={styles.triangleAvatar}>
                    {activeConv.group.avatar ? (
                      <Image
                        source={{ uri: activeConv.group.avatar }}
                        style={{
                          width: 44, // Tăng nhẹ kích thước để cân đối
                          height: 44,
                          borderRadius: 14, // Bo góc kiểu Squircle hiện đại hơn
                          borderWidth: 1.5,
                          borderColor: "rgba(255,255,255,0.1)",
                        }}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={{ width: 44, height: 44, position: "relative" }}
                      >
                        {/* Logic Triangle Avatar tối ưu lại vị trí */}
                        {groupAvatars[0] && (
                          <Image
                            source={{ uri: groupAvatars[0] }}
                            style={[
                              styles.avtTop,
                              { width: 26, height: 26, borderRadius: 13 },
                            ]}
                          />
                        )}
                        {groupAvatars[1] && (
                          <Image
                            source={{ uri: groupAvatars[1] }}
                            style={[
                              styles.avtLeft,
                              {
                                width: 26,
                                height: 26,
                                borderRadius: 13,
                                borderWidth: 2,
                                borderColor: "#0f172a",
                              },
                            ]}
                          />
                        )}
                        {groupAvatars[2] && (
                          <View
                            style={[
                              styles.avtRight,
                              {
                                width: 26,
                                height: 26,
                                borderRadius: 13,
                                backgroundColor: "#1e293b",
                                justifyContent: "center",
                                alignItems: "center",
                                borderWidth: 2,
                                borderColor: "#0f172a",
                              },
                            ]}
                          >
                            {groupAvatars.length > 3 ? (
                              <Text
                                style={{
                                  color: "#60a5fa",
                                  fontSize: 10,
                                  fontWeight: "800",
                                }}
                              >
                                +{groupAvatars.length - 2}
                              </Text>
                            ) : (
                              <Image
                                source={{ uri: groupAvatars[2] }}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  borderRadius: 13,
                                }}
                              />
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  /* ONE CHAT AVATAR */
                  <View>
                    {otherUser?.avatarUrl ? (
                      <Image
                        source={{ uri: otherUser.avatarUrl }}
                        style={{ width: 44, height: 44, borderRadius: 22 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: getAvatarColor(
                            otherUser?.displayName || "",
                          ),
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            color: "white",
                            fontWeight: "bold",
                            fontSize: 18,
                          }}
                        >
                          {otherUser?.displayName?.[0]}
                        </Text>
                      </View>
                    )}
                    {/* Status Indicator gọn hơn cho 1-1 */}
                    {onlineUsers.includes(otherUser?._id!) && (
                      <View
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: "#10b981",
                          borderWidth: 2,
                          borderColor: "#0f172a",
                        }}
                      />
                    )}
                  </View>
                )}
              </View>

              {/* ================= TEXT INFO SECTION ================= */}
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Text
                  style={{
                    color: "#f8fafc",
                    fontSize: 17,
                    fontWeight: "700",
                    letterSpacing: 0.3,
                    marginBottom: 2,
                  }}
                  numberOfLines={1}
                >
                  {activeConv?.group?.name ||
                    otherUser?.displayName ||
                    "Đang tải..."}
                </Text>

                {/* Subtitle logic */}
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {activeConv?.group ? (
                    <Text
                      style={{
                        color: "#94a3b8",
                        fontSize: 12,
                        fontWeight: "500",
                      }}
                    >
                      {activeConv.participants.length} thành viên
                      {typingUsers.length > 0 && (
                        <Text style={{ color: "#60a5fa" }}>
                          {" "}
                          • đang soạn...
                        </Text>
                      )}
                    </Text>
                  ) : (
                    <Text
                      style={{
                        color: onlineUsers.includes(otherUser?._id!)
                          ? "#10b981"
                          : "#64748b",
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {onlineUsers.includes(otherUser?._id!)
                        ? "Đang hoạt động"
                        : "Ngoại tuyến"}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </View>
          <View style={styles.headerActions}>
            {activeConv?.group && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setShowAddMember(true)}
              >
                <UserPlus size={20} color="#94a3b8" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() =>
                setActivePopup((p) => (p === "theme" ? null : "theme"))
              }
            >
              <Palette
                size={20}
                color={activePopup === "theme" ? "#60a5fa" : "#94a3b8"}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => {}}>
              <Phone size={20} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => {}}>
              <Video size={20} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setShowInfoPanel(true)}
            >
              <Info size={20} color={showInfoPanel ? "#2563eb" : "#94a3b8"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Pinned messages banner */}
        {pinnedMessages.length > 0 && (
          <TouchableOpacity
            style={styles.pinnedBanner}
            onPress={() => setShowPinnedModal(true)}
          >
            <Pin size={13} color="#93c5fd" />
            <Text style={styles.pinnedBannerText} numberOfLines={1}>
              {getSafeMessagePreview(pinnedMessages[0].content || "Tin nhắn")}
            </Text>
            <Text style={styles.pinnedBannerCount}>
              Xem ghim ({pinnedMessages.length})
            </Text>
          </TouchableOpacity>
        )}

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

            {/* Edit banner */}
            {editingMessage && (
              <View style={styles.editBanner}>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <Text style={styles.editBannerTitle}>
                    ✏️ Đang chỉnh sửa tin nhắn
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingMessage(null);
                      setEditInput("");
                    }}
                  >
                    <X size={14} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[
                      styles.textInput,
                      { flex: 1, borderColor: "rgba(234,179,8,.4)" },
                    ]}
                    value={editInput}
                    onChangeText={setEditInput}
                    autoFocus
                    onSubmitEditing={() => void handleEdit()}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    onPress={() => void handleEdit()}
                    disabled={!editInput.trim()}
                    style={{
                      backgroundColor: editInput.trim() ? "#ca8a04" : "#334155",
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      Lưu
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* LozaBot suggestions */}
            {showLozaBotSuggestions && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 8 }}
              >
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {LOZA_BOT_SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setInput(`@${LOZA_BOT_NAME} ${s}`)}
                      style={styles.lozaSuggestion}
                    >
                      <Text style={styles.lozaSuggestionText}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
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
            </View>

            {/* Text input row */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                placeholder="Nhập tin nhắn... hoặc @LozaBot"
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

      {/* ── Popups ── */}

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
              <Text style={styles.popupActionText}>Chọn ảnh (tối đa 10)</Text>
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

      {/* Theme picker popup */}
      <Modal
        visible={activePopup === "theme"}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePopup(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActivePopup(null)}
        >
          <View style={styles.popupSheet}>
            <Text style={styles.popupTitle}>Giao diện chat</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CHAT_THEME_OPTIONS.map((theme) => {
                const isActive = theme.id === activeChatTheme.id;
                const isGradient = theme.mode === "gradient";
                return (
                  <TouchableOpacity
                    key={theme.id}
                    style={[
                      styles.popupAction,
                      isActive && {
                        borderColor: "#60a5fa",
                        backgroundColor: "rgba(37,99,235,.12)",
                      },
                    ]}
                    onPress={() => {
                      if (id) setThemeForConversation(id as string, theme.id);
                      setActivePopup(null);
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        backgroundColor: isGradient
                          ? theme.mineBubbleColors?.[0]
                          : theme.mineBubbleColor,
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,.2)",
                      }}
                    />
                    <Text
                      style={[
                        styles.popupActionText,
                        isActive && { color: "#bfdbfe", fontWeight: "700" },
                      ]}
                    >
                      {theme.name}
                    </Text>
                    {isActive && (
                      <Text style={{ color: "#60a5fa", fontSize: 12 }}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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

      {/* Poll popup */}
      <Modal
        visible={activePopup === "poll"}
        transparent
        animationType="slide"
        onRequestClose={() => setActivePopup(null)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setActivePopup(null)}
          >
            <Pressable onPress={() => {}}>
              <View style={[styles.popupSheet, styles.pollPopupSheet]}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.pollScrollContent}
                  showsVerticalScrollIndicator={false}
                >
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
                      <Text style={styles.pollSubmitBtnText}>
                        Tạo bình chọn
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Reaction menu */}
      <Modal
        visible={!!reactionMenuMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setReactionMenuMessage(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setReactionMenuMessage(null)}
        >
          <View style={styles.reactionMenuSheet}>
            <View style={styles.reactionMenuRow}>
              {REACTION_OPTIONS.map((emoji) => {
                const active = myReaction === emoji;
                return (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() =>
                      reactionMenuMessage &&
                      void handlePickReaction(reactionMenuMessage, emoji)
                    }
                    style={[
                      styles.reactionEmojiBtn,
                      active && styles.reactionEmojiBtnActive,
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {myReaction && reactionMenuMessage && (
              <TouchableOpacity
                style={styles.cancelReactionBtn}
                onPress={() =>
                  reactionMenuMessage &&
                  void handlePickReaction(reactionMenuMessage, myReaction)
                }
              >
                <Text style={styles.cancelReactionBtnText}>Hủy reaction</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Reaction viewer */}
      <Modal
        visible={!!reactionViewerMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setReactionViewerMessage(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setReactionViewerMessage(null)}
        >
          <View style={[styles.popupSheet, { maxHeight: 360 }]}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={styles.popupTitle}>Cảm xúc tin nhắn</Text>
              <TouchableOpacity onPress={() => setReactionViewerMessage(null)}>
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(reactionViewerMessage?.reactions || []).length === 0 ? (
                <Text style={styles.emptyText}>Không có cảm xúc</Text>
              ) : (
                (reactionViewerMessage?.reactions || []).map(
                  (reaction, index) => {
                    const participant = activeConv?.participants.find(
                      (p) => p._id === reaction.userId,
                    );
                    return (
                      <View
                        key={`${reaction.userId}-${reaction.emoji}-${index}`}
                        style={[
                          styles.popupAction,
                          { justifyContent: "space-between" },
                        ]}
                      >
                        <Text style={styles.popupActionText}>
                          {participant?.displayName ||
                          reaction.userId === user?.userId
                            ? "Bạn"
                            : "Người dùng"}
                        </Text>
                        <Text style={{ fontSize: 20 }}>{reaction.emoji}</Text>
                      </View>
                    );
                  },
                )
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Pinned messages modal */}
      <Modal
        visible={showPinnedModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPinnedModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPinnedModal(false)}
        >
          <View style={[styles.popupSheet, { maxHeight: 420 }]}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Text style={styles.popupTitle}>Tin nhắn đã ghim</Text>
              <TouchableOpacity onPress={() => setShowPinnedModal(false)}>
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {pinnedMessages.length === 0 ? (
                <Text style={styles.emptyText}>Chưa có tin ghim</Text>
              ) : (
                pinnedMessages.map((item) => (
                  <TouchableOpacity
                    key={item.messageId}
                    style={styles.popupAction}
                    onPress={() => {
                      setShowPinnedModal(false);
                      // Scroll to message
                      const index = displayMessages.findIndex(
                        (m) => m._id === item.messageId,
                      );
                      if (index >= 0)
                        flatListRef.current?.scrollToIndex({
                          index,
                          animated: true,
                          viewPosition: 0.5,
                        });
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.popupActionText} numberOfLines={2}>
                        {getSafeMessagePreview(item.content || "Tin nhắn")}
                      </Text>
                      <Text
                        style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}
                      >
                        Ghim lúc {formatMessageDateTime(item.pinnedAt)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Vote detail modal */}
      <Modal
        visible={!!voteDetailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setVoteDetailModal(null)}
      >
        <Pressable
          style={[styles.modalOverlay, styles.voteModalOverlay]}
          onPress={() => setVoteDetailModal(null)}
        >
          <Pressable onPress={() => {}}>
            <View
              style={[
                styles.popupSheet,
                styles.voteModalSheet,
                { height: voteModalHeight },
              ]}
            >
              <View style={styles.voteModalHeader}>
                <Text style={[styles.popupTitle, { marginBottom: 0 }]}>
                  Chi tiết vote
                </Text>
                <TouchableOpacity
                  style={styles.voteCloseBtn}
                  onPress={() => setVoteDetailModal(null)}
                >
                  <X size={16} color="#cbd5e1" />
                </TouchableOpacity>
              </View>
              {!!activeVotePoll?.question && (
                <Text style={styles.voteModalQuestion} numberOfLines={2}>
                  {activeVotePoll.question}
                </Text>
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.voteTabsRow}
              >
                {(activeVotePoll?.options || []).map((option) => {
                  const count = activeVotePoll?.votes.filter(
                    (v) => v.optionId === option.id,
                  ).length;
                  const isActive = option.id === activeVoteOptionId;
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.voteTab, isActive && styles.voteTabActive]}
                      onPress={() =>
                        setVoteDetailModal((prev) =>
                          prev ? { ...prev, activeOptionId: option.id } : prev,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.voteTabOption,
                          isActive && styles.voteTabOptionActive,
                        ]}
                        numberOfLines={2}
                      >
                        {`${option.label} (${count} vote)`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <ScrollView
                style={styles.voteList}
                contentContainerStyle={styles.voteListContent}
                showsVerticalScrollIndicator={false}
              >
                {pagedVoteList.length > 0 ? (
                  pagedVoteList.map((vote) => (
                    <View
                      key={`${vote.userId}-${vote.createdAt}`}
                      style={styles.voteUserRow}
                    >
                      <Text style={styles.voteUserName}>
                        {vote.userName ||
                          activeConv?.participants.find(
                            (p) => p._id === vote.userId,
                          )?.displayName ||
                          "Người dùng"}
                      </Text>
                      <Text style={styles.voteUserTime}>
                        {formatTime(vote.createdAt)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.voteEmptyText}>
                    Chưa có người vote lựa chọn này
                  </Text>
                )}
              </ScrollView>
              {totalVotePages > 1 && (
                <View style={styles.votePagerRow}>
                  <TouchableOpacity
                    style={[
                      styles.votePagerBtn,
                      votePage === 1 && styles.votePagerBtnDisabled,
                    ]}
                    onPress={() => setVotePage((p) => Math.max(1, p - 1))}
                    disabled={votePage === 1}
                  >
                    <Text style={styles.votePagerBtnText}>Trang trước</Text>
                  </TouchableOpacity>
                  <Text style={styles.votePagerText}>
                    Trang {votePage}/{totalVotePages}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.votePagerBtn,
                      votePage === totalVotePages &&
                        styles.votePagerBtnDisabled,
                    ]}
                    onPress={() =>
                      setVotePage((p) => Math.min(totalVotePages, p + 1))
                    }
                    disabled={votePage === totalVotePages}
                  >
                    <Text style={styles.votePagerBtnText}>Trang sau</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Pressable>
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
            {contextMenu &&
              !contextMenu.message.isRecalled &&
              !isFileMessage(contextMenu.message) && (
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => void handleCopyMessage()}
                >
                  <Copy size={16} color="#e2e8f0" />
                  <Text style={styles.contextMenuText}>Sao chép</Text>
                </TouchableOpacity>
              )}
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
            {contextMenu && !contextMenu.message.isRecalled && (
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={() => void handleTogglePin(contextMenu.message)}
              >
                {isPinnedMessage(contextMenu.message._id) ? (
                  <PinOff size={16} color="#e2e8f0" />
                ) : (
                  <Pin size={16} color="#e2e8f0" />
                )}
                <Text style={styles.contextMenuText}>
                  {isPinnedMessage(contextMenu.message._id)
                    ? "Bỏ ghim"
                    : "Ghim tin nhắn"}
                </Text>
              </TouchableOpacity>
            )}
            {contextMenu &&
              contextMenu.message.senderId === user?.userId &&
              !contextMenu.message.isRecalled &&
              canRecall(contextMenu.message) && (
                <TouchableOpacity
                  style={styles.contextMenuItem}
                  onPress={() => {
                    const payload = decodeChatPayload(
                      contextMenu.message.content,
                    );
                    const currentText =
                      payload?.text || contextMenu.message.content || "";
                    setEditInput(currentText);
                    setEditingMessage(contextMenu.message);
                    setContextMenu(null);
                  }}
                >
                  <Pencil size={16} color="#e2e8f0" />
                  <Text style={styles.contextMenuText}>Chỉnh sửa</Text>
                </TouchableOpacity>
              )}
            {contextMenu && !contextMenu.message.isRecalled && (
              <TouchableOpacity
                style={styles.contextMenuItem}
                onPress={() => {
                  setForwardingMessage(contextMenu.message);
                  setIsForwardModalOpen(true);
                  setContextMenu(null);
                }}
              >
                <Send size={16} color="#e2e8f0" />
                <Text style={styles.contextMenuText}>Chuyển tiếp</Text>
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

      {/* Forward modal */}
      <Modal
        visible={isForwardModalOpen && !!forwardingMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setIsForwardModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.popupSheet,
              {
                height: "70%",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
              },
            ]}
          >
            <View style={styles.audioHeader}>
              <Text style={styles.popupTitle}>Chuyển tiếp tới...</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsForwardModalOpen(false);
                  setSelectedConvs([]);
                }}
              >
                <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <TextInput
              placeholder="Tìm hội thoại..."
              placeholderTextColor="#64748b"
              value={forwardSearch}
              onChangeText={setForwardSearch}
              style={[styles.pollInput, { marginBottom: 15 }]}
            />
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
            >
              {conversations
                .filter((c) => {
                  const name =
                    c.group?.name ||
                    c.participants.find((p) => p._id !== user?.userId)
                      ?.displayName ||
                    "";
                  return name
                    .toLowerCase()
                    .includes(forwardSearch.toLowerCase());
                })
                .map((conv) => {
                  const isSelected = selectedConvs.includes(conv._id);
                  const chatName =
                    conv.group?.name ||
                    conv.participants.find((p) => p._id !== user?.userId)
                      ?.displayName ||
                    "Đoạn chat";
                  return (
                    <TouchableOpacity
                      key={conv._id}
                      style={[
                        styles.popupAction,
                        isSelected && {
                          borderColor: "#2563eb",
                          backgroundColor: "rgba(37,99,235,0.1)",
                        },
                      ]}
                      onPress={() => {
                        if (isSelected)
                          setSelectedConvs((prev) =>
                            prev.filter((cid) => cid !== conv._id),
                          );
                        else setSelectedConvs((prev) => [...prev, conv._id]);
                      }}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          borderWidth: 2,
                          borderColor: isSelected ? "#2563eb" : "#475569",
                          backgroundColor: isSelected
                            ? "#2563eb"
                            : "transparent",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        {isSelected && (
                          <Text style={{ color: "white", fontSize: 12 }}>
                            ✓
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.popupActionText,
                          isSelected && { color: "white", fontWeight: "600" },
                        ]}
                      >
                        {chatName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                style={[styles.pollAddBtn, { flex: 1, alignItems: "center" }]}
                onPress={() => {
                  setIsForwardModalOpen(false);
                  setSelectedConvs([]);
                }}
              >
                <Text style={styles.pollAddBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={selectedConvs.length === 0 || sending}
                style={[
                  styles.pollSubmitBtn,
                  { flex: 2, opacity: selectedConvs.length === 0 ? 0.5 : 1 },
                ]}
                onPress={async () => {
                  setSending(true);
                  try {
                    await forwardMessage(forwardingMessage!, selectedConvs);
                    setIsForwardModalOpen(false);
                    setSelectedConvs([]);
                    setForwardingMessage(null);
                    Alert.alert("Thành công", "Đã chuyển tiếp tin nhắn");
                  } catch {
                    Alert.alert("Lỗi", "Không thể chuyển tiếp tin nhắn");
                  } finally {
                    setSending(false);
                  }
                }}
              >
                <Text style={styles.pollSubmitBtnText}>
                  {sending ? "Đang gửi..." : `Gửi (${selectedConvs.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full-screen image preview */}
      <Modal
        visible={!!previewImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPreviewImageUrl(null);
          setPreviewImageLoading(false);
          setPreviewImageError(null);
        }}
      >
        <Pressable
          style={styles.previewRoot}
          onPress={() => {
            setPreviewImageUrl(null);
            setPreviewImageLoading(false);
            setPreviewImageError(null);
          }}
        >
          <Pressable
            style={styles.previewCloseBtn}
            onPress={() => {
              setPreviewImageUrl(null);
              setPreviewImageLoading(false);
              setPreviewImageError(null);
            }}
          >
            <X size={20} color="#f8fafc" />
          </Pressable>
          {!!previewImageUrl && (
            <Pressable style={styles.previewImageWrap} onPress={() => {}}>
              {previewImageLoading && !previewImageError && (
                <ActivityIndicator size="large" color="#bfdbfe" />
              )}
              {!!previewImageError && (
                <Text style={styles.previewErrorText}>{previewImageError}</Text>
              )}
              <Image
                source={{ uri: previewImageUrl }}
                style={styles.previewImage}
                resizeMode="contain"
                onLoadStart={() => {
                  setPreviewImageLoading(true);
                  setPreviewImageError(null);
                }}
                onLoadEnd={() => setPreviewImageLoading(false)}
                onError={() => {
                  setPreviewImageLoading(false);
                  setPreviewImageError("Không tải được ảnh");
                }}
              />
            </Pressable>
          )}
        </Pressable>
      </Modal>

      {/* Add member modal */}
      {activeConv?.group && (
        <AddMemberModal
          visible={showAddMember}
          onClose={() => setShowAddMember(false)}
          conversationId={id as string}
          currentParticipantIds={activeConv.participants.map((p) => p._id)}
          onAdd={async (targetUserId) => {
            try {
              console.log("Adding user:", targetUserId, "to convo:", id);
              const result = await addMemberToGroup(id as string, targetUserId);

              // Nếu thành công
              if (result) {
                if (result.needsApproval) {
                  Alert.alert(
                    "Thông báo",
                    "Yêu cầu đã gửi, chờ trưởng/phó nhóm duyệt",
                  );
                } else {
                  // CẬP NHẬT LẠI STORE NGAY LẬP TỨC
                  // Giả sử API trả về object member mới, nếu không Khoa cần fetch lại convo
                  // fetchConversations();
                  Alert.alert("Thành công", "Đã thêm thành viên vào nhóm");
                }
                setShowAddMember(false);
              }
            } catch (error: any) {
              console.error(
                "Lỗi API thêm thành viên:",
                error.response?.data || error.message,
              );
              const errorMsg =
                error.response?.data?.message || "Không thể thêm thành viên";
              Alert.alert("Lỗi", errorMsg);
            }
          }}
        />
      )}

      {/* Conversation Info Panels */}
      {!activeConv?.group && activeConv && (
        <ConversationInfoPanel
          visible={showInfoPanel}
          onClose={() => setShowInfoPanel(false)}
          conversation={activeConv}
          messages={currentMessages}
          currentUserId={user?.userId}
        />
      )}
      {activeConv?.group && activeConv && (
        <GroupConversationInfoPanel
          visible={showInfoPanel}
          onClose={() => setShowInfoPanel(false)}
          conversation={activeConv}
          messages={currentMessages}
          currentUserId={user?.userId}
          onUpdateSettings={async (settings) => {
            if (!activeConv._id) return;
            try {
              await chatService.updateGroupSettings(activeConv._id, settings);
              console.log("Cập nhật thành công");
            } catch {
              Alert.alert("Lỗi", "Không thể cập nhật cài đặt nhóm");
            }
          }}
          // TRUYỀN THÊM CÁC HÀM NÀY:
          // onLeaveGroup={() => handleLeaveGroup()}
          // onDissolveGroup={() => handleDissolve()}
          // onUpdateSettings={(s) => handleUpdateGroupSettings(s)}
          onReviewRequest={(id, action) =>
            reviewJoinRequest(activeConv._id, id, action)
          }
          pendingRequests={joinRequests[activeConv._id] || []}
          onUpdateMemberRole={async (targetUserId, role) => {
            if (!activeConv._id) return;
            try {
              await chatService.updateMemberRole(
                activeConv._id,
                targetUserId,
                role,
              );
            } catch (error) {
              console.error("Lỗi khi cập nhật role:", error);
              alert("Không thể cập nhật quyền thành viên");
            }
          }}
        />
      )}
    </View>
  );
}
