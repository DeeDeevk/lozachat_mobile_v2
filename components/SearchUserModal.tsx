import { useRouter } from "expo-router";
import {
  Bell,
  CheckCircle,
  Clock,
  MessageCircle,
  Search,
  UserPlus,
  UserRoundSearch,
  X,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { chatService } from "../services/chatService";
import { friendService } from "../services/friendService";
import { useAuthStore } from "../stores/useAuthStore";
import { useChatStore } from "../stores/useChatStore";
import { useFriendStore } from "../stores/useFriendStore";
import { useSocketStore } from "../stores/useSocketStore";

// ─── Types ────────────────────────────────────────────────────────────────────
type RequestStatus = "none" | "sent" | "received" | "friend" | "self";

interface User {
  _id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
];

function randomColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string) {
  return (
    name
      ?.split(" ")
      .slice(-2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "U"
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SearchUserModal({
  isOpen,
  onClose,
  onRequestSent,
}: {
  isOpen: boolean;
  onClose: () => void;
  onRequestSent?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<User | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sendingReq, setSendingReq] = useState(false);
  const [introMessage, setIntroMessage] = useState(
    "Chào bạn ~ Có thể kết bạn được không?",
  );
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const currentUser = useAuthStore((s) => s.userProfile);
  const friendStore = useFriendStore();
  const { loading, searchByUserName } = friendStore;
  const onlineUsers = useSocketStore((s) => s.onlineUsers);
  const socket = useSocketStore((s) => s.socket);
  const { setActiveConversation, addConversation } = useChatStore();
  const router = useRouter();

  const requestStatus: RequestStatus = useFriendStore(
    (s) => s.targetStatuses[result?._id || ""] || "none",
  );
  const updateFriendStatus = friendStore.updateFriendStatus;

  const isOnline = result ? onlineUsers.includes(result._id) : false;
  const isSelf = requestStatus === "self" || currentUser?._id === result?._id;

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResult(null);
      setNotFound(false);
      setIntroMessage("Chào bạn ~ Có thể kết bạn được không?");
    }
  }, [isOpen]);

  // Socket realtime
  useEffect(() => {
    if (!socket || !result?._id) return;
    // ✅ Fix - check tất cả các field có liên quan
    const handleFriendUpdate = async (update: any) => {
      const involvedIds = [
        update.targetUserId,
        update.senderId,
        update.receiverId,
        update.fromUserId,
        update.newFriend?._id,
      ]
        .filter(Boolean)
        .map((id: string) => id.toString());

      if (involvedIds.includes(result._id.toString())) {
        setIsUpdatingStatus(true);
        try {
          await updateFriendStatus(result._id);
        } finally {
          setIsUpdatingStatus(false);
        }
      }
    };
    socket.on("friend_update", handleFriendUpdate);
    return () => {
      socket.off("friend_update", handleFriendUpdate);
    };
  }, [socket, result?._id, updateFriendStatus]);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setResult(null);
    setNotFound(false);
    const user = await searchByUserName(q);
    if (!user) {
      setNotFound(true);
      return;
    }
    setResult(user);
    await updateFriendStatus(user._id);
  };

  const handleSendRequest = async () => {
    if (!result) return;
    setSendingReq(true);
    try {
      await friendService.sendFriendRequest(
        result._id,
        introMessage || undefined,
      );
      Toast.show({
        type: "success",
        text1: "Đã gửi lời mời kết bạn!",
        text2: `Yêu cầu gửi đến ${result.displayName || result.username}`,
      });
      onRequestSent?.();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Không thể gửi lời mời";
      Toast.show({ type: "error", text1: "Lỗi", text2: msg });
    } finally {
      setSendingReq(false);
    }
  };

  const handleStartChat = async () => {
    if (!result) return;
    try {
      const convo = await chatService.getOrCreateDirectConversation(result._id);
      if (!convo?._id) return;

      // Cập nhật Store
      socket?.emit("join-conversation", { conversationId: convo._id });
      addConversation(convo);
      setActiveConversation(convo._id);

      // Đóng Modal
      onClose();

      setTimeout(() => {
        router.push({
          pathname: "/chat/[id]",
          params: { id: convo._id },
        });
      }, 300);
    } catch (err) {
      console.error("Lỗi điều hướng:", err);
      Toast.show({ type: "error", text1: "Lỗi", text2: "Không thể mở chat" });
    }
  };

  const avatarColor = result ? randomColor(result.username) : "#3b82f6";
  const initials = result
    ? getInitials(result.displayName || result.username)
    : "";

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable style={S.backdrop} onPress={onClose}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={S.modal}>
              {/* ── Header ── */}
              <View style={S.header}>
                <View style={S.headerLeft}>
                  <View style={S.headerIcon}>
                    <UserRoundSearch size={16} color="#818cf8" />
                  </View>
                  <Text style={S.headerTitle}>Tìm kiếm người dùng</Text>
                </View>
                <TouchableOpacity style={S.closeBtn} onPress={onClose}>
                  <X size={15} color="#64748b" />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* ── Search input ── */}
                <View style={S.section}>
                  <Text style={S.label}>Tên người dùng</Text>
                  <View style={S.inputRow}>
                    <TextInput
                      style={S.input}
                      placeholder="Nhập username để tìm kiếm..."
                      placeholderTextColor="#475569"
                      value={query}
                      onChangeText={(t) => {
                        setQuery(t);
                        if (result || notFound) {
                          setResult(null);
                          setNotFound(false);
                        }
                      }}
                      onSubmitEditing={handleSearch}
                      returnKeyType="search"
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={[
                        S.searchBtn,
                        (!query.trim() || loading) && S.searchBtnDisabled,
                      ]}
                      onPress={handleSearch}
                      disabled={!query.trim() || loading}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Search size={16} color="white" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ── Self ── */}
                {isSelf && (
                  <View style={S.selfBox}>
                    <Text style={S.selfEmoji}>🤡</Text>
                    <Text style={S.selfText}>
                      Bạn đang tìm ai vậy. Người này là chính bạn 😄
                    </Text>
                  </View>
                )}

                {/* ── Result card ── */}
                {result && !isSelf && (
                  <View style={S.card}>
                    {/* User row */}
                    <View style={S.userRow}>
                      {result.avatarUrl ? (
                        <Image
                          source={{ uri: result.avatarUrl }}
                          style={[S.avatar, { backgroundColor: avatarColor }]}
                        />
                      ) : (
                        <View
                          style={[S.avatar, { backgroundColor: avatarColor }]}
                        >
                          <Text style={S.avatarText}>{initials}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={S.userName}>
                          {result.displayName || result.username}
                        </Text>
                        <View style={S.usernameRow}>
                          <Text style={S.usernameText}>@{result.username}</Text>
                          {/* Online dot */}
                          <View
                            style={[
                              S.onlineDot,
                              isOnline ? S.dotOnline : S.dotOffline,
                            ]}
                          />
                          <Text
                            style={[
                              S.onlineLabel,
                              { color: isOnline ? "#06b6d4" : "#64748b" },
                            ]}
                          >
                            {isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Status banners */}
                    {requestStatus === "friend" && (
                      <View style={[S.banner, S.bannerFriend]}>
                        <CheckCircle size={14} color="#4ade80" />
                        <Text style={[S.bannerText, { color: "#4ade80" }]}>
                          Bạn và người này đã là bạn bè.
                        </Text>
                      </View>
                    )}
                    {requestStatus === "sent" && (
                      <View style={[S.banner, S.bannerSent]}>
                        {isUpdatingStatus ? (
                          <ActivityIndicator size="small" color="#fbbf24" />
                        ) : (
                          <Clock size={14} color="#fbbf24" />
                        )}
                        <Text style={[S.bannerText, { color: "#fbbf24" }]}>
                          Bạn đã gửi yêu cầu kết bạn. Vui lòng chờ phản hồi.
                        </Text>
                      </View>
                    )}
                    {requestStatus === "received" && (
                      <View style={[S.banner, S.bannerReceived]}>
                        {isUpdatingStatus ? (
                          <ActivityIndicator size="small" color="#818cf8" />
                        ) : (
                          <Bell size={14} color="#818cf8" />
                        )}
                        <Text style={[S.bannerText, { color: "#818cf8" }]}>
                          Người này đã gửi lời mời kết bạn cho bạn.
                        </Text>
                      </View>
                    )}

                    {/* Intro textarea (chỉ khi chưa kết bạn) */}
                    {requestStatus === "none" && (
                      <View style={S.introWrap}>
                        <Text style={S.introLabel}>Giới thiệu</Text>
                        <TextInput
                          style={S.introInput}
                          value={introMessage}
                          onChangeText={setIntroMessage}
                          placeholder="Nhập lời giới thiệu..."
                          placeholderTextColor="#475569"
                          multiline
                          maxLength={150}
                        />
                        <Text style={S.introCount}>
                          {introMessage.length}/150
                        </Text>
                      </View>
                    )}

                    {/* Actions */}
                    <View style={S.actions}>
                      <TouchableOpacity
                        style={S.btnChat}
                        onPress={handleStartChat}
                      >
                        <MessageCircle size={15} color="white" />
                        <Text style={S.btnText}>Nhắn tin</Text>
                      </TouchableOpacity>
                      {requestStatus === "none" && (
                        <TouchableOpacity
                          style={[S.btnFriend, sendingReq && S.btnDisabled]}
                          onPress={handleSendRequest}
                          disabled={sendingReq}
                        >
                          {sendingReq ? (
                            <ActivityIndicator size="small" color="white" />
                          ) : (
                            <UserPlus size={15} color="white" />
                          )}
                          <Text style={S.btnText}>Kết bạn</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* Not found */}
                {notFound && (
                  <View style={S.notFound}>
                    <UserRoundSearch size={28} color="#334155" />
                    <Text style={S.notFoundTitle}>
                      Không tìm thấy người dùng
                    </Text>
                    <Text style={S.notFoundSub}>
                      Vui lòng kiểm tra lại username và thử lại
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    maxHeight: 560,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIcon: {
    backgroundColor: "rgba(129,140,248,0.15)",
    borderRadius: 8,
    padding: 6,
  },
  headerTitle: { color: "white", fontSize: 15, fontWeight: "700" },
  closeBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    padding: 6,
  },

  // Search
  section: { marginBottom: 14 },
  label: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputRow: { flexDirection: "row", gap: 8 },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "white",
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  searchBtnDisabled: { backgroundColor: "#1e3a5f", opacity: 0.5 },

  // Self
  selfBox: {
    backgroundColor: "rgba(59,130,246,0.08)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  selfEmoji: { fontSize: 28 },
  selfText: { color: "#94a3b8", fontSize: 13, textAlign: "center" },

  // Card
  card: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarText: { color: "white", fontWeight: "700", fontSize: 14 },
  userName: { color: "white", fontWeight: "700", fontSize: 15 },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  usernameText: { color: "#64748b", fontSize: 12 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  dotOnline: { backgroundColor: "#06b6d4" },
  dotOffline: { backgroundColor: "#475569" },
  onlineLabel: { fontSize: 11 },

  // Banners
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bannerFriend: {
    backgroundColor: "rgba(74,222,128,0.1)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.2)",
  },
  bannerSent: {
    backgroundColor: "rgba(251,191,36,0.1)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.2)",
  },
  bannerReceived: {
    backgroundColor: "rgba(129,140,248,0.1)",
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.2)",
  },
  bannerText: { fontSize: 12, flex: 1 },

  // Intro
  introWrap: { gap: 6 },
  introLabel: { color: "#64748b", fontSize: 12, fontWeight: "600" },
  introInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 10,
    color: "white",
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: "top",
  },
  introCount: { color: "#475569", fontSize: 11, textAlign: "right" },

  // Actions
  actions: { flexDirection: "row", gap: 8 },
  btnChat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(59,130,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.3)",
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnFriend: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "white", fontSize: 13, fontWeight: "600" },

  // Not found
  notFound: { alignItems: "center", paddingVertical: 30, gap: 8 },
  notFoundTitle: { color: "#94a3b8", fontSize: 14, fontWeight: "600" },
  notFoundSub: { color: "#475569", fontSize: 12, textAlign: "center" },
});
