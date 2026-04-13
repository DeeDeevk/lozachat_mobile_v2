import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StyleSheet,
  Keyboard,
  Alert,
  Image,
} from "react-native";
import {
  X,
  Search,
  UserPlus,
  MessageCircle,
  Loader2,
  Clock,
  Bell,
  UserCheck,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { friendService } from "@/services/friendService";
import { useAuthStore } from "@/stores/useAuthStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useSocketStore } from "@/stores/useSocketStore";
import type { User, RequestStatus } from "@/types/user";
import { useChatStore } from "@/stores/useChatStore";
import { chatService } from "@/services/chatService";

interface SearchUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestSent?: () => void;
}

const getInitials = (name: string) =>
  name
    ?.split(" ")
    .slice(-2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "U";

const randomColor = (str: string) => {
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
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function SearchUserModal({
  isOpen,
  onClose,
  onRequestSent,
}: SearchUserModalProps) {
  const currentUser = useAuthStore((s) => s.userProfile);
  const friendStore = useFriendStore();
  const { loading, searchByUserName } = friendStore;
  const onlineUsers = useSocketStore((s) => s.onlineUsers);
  const { addConversation } = useChatStore();

  const [query, setQuery] = useState("");
  const [result, setResult] = useState<User | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sendingReq, setSendingReq] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [introMessage, setIntroMessage] = useState(
    "Chào bạn ~ Có thể kết bạn được không?",
  );

  const updateFriendStatus = friendStore.updateFriendStatus;
  const socket = useSocketStore((s) => s.socket);
  const inputRef = useRef<TextInput>(null);
  const socketListenerRef = useRef<boolean>(false);

  // Subscribe to target statuses and re-compute when result._id changes
  const requestStatus = useFriendStore((s) => {
    if (!result?._id) return "none" as RequestStatus;
    const status = s.targetStatuses[result._id] || ("none" as RequestStatus);
    // console.log("📊 requestStatus for", result.username, ":", status);
    return status;
  });

  const isOnline = result ? onlineUsers.includes(result._id) : false;

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResult(null);
      setNotFound(false);
      setIntroMessage("Chào bạn ~ Có thể kết bạn được không?");
      socketListenerRef.current = false; // Reset listener flag
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (requestStatus !== "friend") {
      setIntroMessage("Chào bạn ~ Có thể kết bạn được không?");
    }
  }, [requestStatus]);

  // Reset listener flag when search result changes
  useEffect(() => {
    return () => {
      socketListenerRef.current = false;
    };
  }, [result?._id]);

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    Keyboard.dismiss();
    setResult(null);
    setNotFound(false);
    setIntroMessage("Chào bạn ~ Có thể kết bạn được không?");

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
    console.log("📤 Sending friend request to:", result.username);
    try {
      await friendService.sendFriendRequest(
        result._id,
        introMessage || undefined,
      );
      console.log("✅ Friend request sent successfully to:", result.username);
      Toast.show({
        type: "success",
        text1: "Đã gửi lời mời kết bạn!",
        text2: `Yêu cầu đã được gửi đến ${result.displayName || result.username}`,
      });
      // Update status immediately to show "sent" state
      await updateFriendStatus(result._id);
      onRequestSent?.();
    } catch (err) {
      const msg =
        (err as any)?.response?.data?.message ||
        "Không thể gửi lời mời. Vui lòng thử lại.";
      console.error("❌ Failed to send request:", msg);
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: msg,
      });
    } finally {
      setSendingReq(false);
    }
  };

  const handleStartChat = async (user: User) => {
    try {
      const res = await chatService.getOrCreateDirectConversation(user._id);
      const convo = res;
      if (!convo?._id) {
        Toast.show({
          type: "error",
          text1: "Lỗi",
          text2: "Conversation không hợp lệ",
        });
        return;
      }
      addConversation(convo);
      onClose();
      Toast.show({
        type: "success",
        text1: "Mở chat thành công",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể mở chat",
      });
    }
  };

  // Real-time socket listener - properly handle status updates
  useEffect(() => {
    if (!socket || !result?._id || socketListenerRef.current) return;

    socketListenerRef.current = true;
    console.log(
      "📡 Setting up socket listener for:",
      result.username,
      result._id,
    );

    const handleFriendUpdate = async (update: any) => {
      const targetId =
        update.targetUserId ||
        update.senderId ||
        update.receiverId ||
        update.fromUserId;

      if (targetId === result._id) {
        console.log(
          "🔥 SearchUserModal received real-time update for:",
          result.username,
          "action:",
          update.action,
        );
        setIsUpdatingStatus(true);
        try {
          // Fetch latest status from server
          await updateFriendStatus(result._id);
          console.log("✅ Status updated successfully");
        } catch (err) {
          console.error("❌ Failed to update status:", err);
        } finally {
          setIsUpdatingStatus(false);
        }
      }
    };

    socket.on("friend_update", handleFriendUpdate);

    return () => {
      console.log("🔌 Cleaning up socket listener for:", result.username);
      socket.off("friend_update", handleFriendUpdate);
      socketListenerRef.current = false;
    };
  }, [socket, result?._id]); // Simplified dependencies

  const avatarColor = result ? randomColor(result.username) : "#3b82f6";
  const initials = result
    ? getInitials(result.displayName || result.username)
    : "";
  const isSelf = requestStatus === "self" || currentUser?._id === result?._id;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Tìm kiếm người dùng</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Search Input */}
          <View style={styles.searchSection}>
            <Text style={styles.label}>Tên người dùng</Text>
            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Nhập username để tìm kiếm..."
                placeholderTextColor="#475569"
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  if (result || notFound) {
                    setResult(null);
                    setNotFound(false);
                    setIntroMessage("Chào bạn ~ Có thể kết bạn được không?");
                  }
                }}
                onSubmitEditing={handleSearch}
              />
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={handleSearch}
                disabled={loading || !query.trim()}
              >
                {loading ? (
                  <ActivityIndicator color="#818cf8" size={18} />
                ) : (
                  <Search size={18} color="#818cf8" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Self Alert */}
          {isSelf && (
            <View style={styles.selfAlert}>
              <Text style={styles.selfEmoji}>🤡</Text>
              <Text style={styles.selfText}>
                Bạn đang tìm ai vậy. Người này là chính bạn 😄
              </Text>
            </View>
          )}

          {/* Result Card */}
          {result && !isSelf && (
            <View style={styles.resultCard}>
              {/* User Info */}
              <View style={styles.userRow}>
                {result.avatarUrl ? (
                  <Image
                    source={{ uri: result.avatarUrl }}
                    style={[
                      styles.avatarImg,
                      {
                        shadowColor: avatarColor,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 5,
                      },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: avatarColor },
                      {
                        shadowColor: avatarColor,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                        elevation: 5,
                      },
                    ]}
                  >
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                )}
                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {result.displayName || result.username}
                  </Text>
                  <Text style={styles.userUsername} numberOfLines={1}>
                    @{result.username}
                  </Text>
                </View>
              </View>

              {/* Status Banners */}
              {requestStatus === "friend" && (
                <View style={styles.statusBanner}>
                  <UserCheck size={15} color="#10b981" />
                  <Text style={styles.statusText}>
                    Bạn và người này đã là bạn bè.
                  </Text>
                </View>
              )}

              {requestStatus === "sent" && (
                <View style={styles.statusBanner}>
                  {isUpdatingStatus ? (
                    <ActivityIndicator color="#fbbf24" size={15} />
                  ) : (
                    <Clock size={15} color="#fbbf24" />
                  )}
                  <Text style={styles.statusText}>
                    Bạn đã gửi yêu cầu kết bạn đến người này. Vui lòng chờ phản
                    hồi.
                  </Text>
                </View>
              )}

              {requestStatus === "received" && (
                <View style={styles.statusBanner}>
                  {isUpdatingStatus ? (
                    <ActivityIndicator color="#0ea5e9" size={15} />
                  ) : (
                    <Bell size={15} color="#0ea5e9" />
                  )}
                  <Text style={styles.statusText}>
                    Bạn đã được yêu cầu kết bạn từ người này. Vui lòng phản hồi.
                  </Text>
                </View>
              )}

              {/* Intro Message */}
              {requestStatus === "none" && (
                <View style={styles.introSection}>
                  <Text style={styles.introLabel}>Giới thiệu</Text>
                  <TextInput
                    style={styles.introInput}
                    placeholder="Nhập lời giới thiệu..."
                    placeholderTextColor="#334155"
                    value={introMessage}
                    onChangeText={setIntroMessage}
                    maxLength={150}
                    multiline
                  />
                  <Text style={styles.introCount}>
                    {introMessage.length}/150
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.btnChat}
                  onPress={() => handleStartChat(result)}
                >
                  <MessageCircle size={16} color="#60a5fa" />
                  <Text style={styles.btnChatText}>Nhắn tin</Text>
                </TouchableOpacity>
                {requestStatus === "none" && (
                  <TouchableOpacity
                    style={styles.btnFriend}
                    onPress={handleSendRequest}
                    disabled={sendingReq}
                  >
                    {sendingReq ? (
                      <ActivityIndicator color="#fff" size={16} />
                    ) : (
                      <UserPlus size={16} color="#fff" />
                    )}
                    <Text style={styles.btnFriendText}>Kết bạn</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Not Found State */}
          {notFound && (
            <View style={styles.notFound}>
              <View style={styles.notFoundIcon}>
                <Search size={40} color="#64748b" />
              </View>
              <Text style={styles.notFoundTitle}>
                Không tìm thấy người dùng
              </Text>
              <Text style={styles.notFoundSub}>
                Vui lòng kiểm tra lại username và thử lại
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#060d1f",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  closeBtn: {
    padding: 8,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  searchSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#e2e8f0",
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,.9)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,.07)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 13,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(99,102,246,.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  selfAlert: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(99,102,246,.1)",
    alignItems: "center",
    marginBottom: 16,
  },
  selfEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  selfText: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
  },
  resultCard: {
    backgroundColor: "rgba(15,24,48,.9)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(99,102,246,.18)",
    padding: 14,
    marginBottom: 16,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImg: {
    width: 46,
    height: 46,
    borderRadius: 10,
    resizeMode: "cover",
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  userUsername: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(99,102,246,.1)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    color: "#94a3b8",
    flex: 1,
  },
  introSection: {
    marginBottom: 12,
  },
  introLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e2e8f0",
    marginBottom: 6,
  },
  introInput: {
    backgroundColor: "rgba(15,23,42,.9)",
    borderWidth: 1,
    borderColor: "rgba(99,102,246,.2)",
    borderRadius: 10,
    padding: 10,
    color: "#fff",
    fontSize: 12,
    minHeight: 60,
    textAlignVertical: "top",
  },
  introCount: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 4,
    textAlign: "right",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  btnChat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,.12)",
  },
  btnChatText: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
  },
  btnFriend: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#6366f1",
  },
  btnFriendText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  notFound: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  notFoundIcon: {
    marginBottom: 12,
  },
  notFoundTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
    marginBottom: 4,
  },
  notFoundSub: {
    fontSize: 12,
    color: "#64748b",
  },
});
