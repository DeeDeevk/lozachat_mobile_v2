import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  UserPlus,
  Clock,
  Bell,
  UserCheck,
  MessageCircle,
} from "lucide-react-native";
import { friendService } from "@/services/friendService";
import { useFriendStore } from "@/stores/useFriendStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { useChatStore } from "@/stores/useChatStore";
import { chatService } from "@/services/chatService";
import { useRouter } from "expo-router";
import type { RequestStatus } from "../types/user";

interface FriendActionButtonProps {
  userId: string;
  displayName?: string;
  username?: string;
  /** Hiển thị nút "Nhắn tin" bên cạnh — mặc định false */
  showChat?: boolean;
  /** Gọi lại sau khi gửi lời mời thành công */
  onRequestSent?: () => void;
  style?: object;
}

export default function FriendActionButton({
  userId,
  displayName,
  username,
  showChat = false,
  onRequestSent,
  style,
}: FriendActionButtonProps) {
  const [sending, setSending] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const { updateFriendStatus } = useFriendStore();
  const requestStatus = useFriendStore(
    (s) => s.targetStatuses[userId] || ("none" as RequestStatus),
  );
  const socket = useSocketStore((s) => s.socket);
  const { setActiveConversation, addConversation } = useChatStore();
  const router = useRouter();

  // Load trạng thái khi mount
  useEffect(() => {
    if (userId) updateFriendStatus(userId);
  }, [userId, updateFriendStatus]);

  // Real-time update qua socket
  useEffect(() => {
    if (!socket || !userId) return;

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

      if (involvedIds.includes(userId.toString())) {
        setIsUpdatingStatus(true);
        try {
          await updateFriendStatus(userId);
        } finally {
          setIsUpdatingStatus(false);
        }
      }
    };

    socket.on("friend_update", handleFriendUpdate);
    return () => socket.off("friend_update", handleFriendUpdate);
  }, [socket, userId, updateFriendStatus]);

  const handleSendRequest = async () => {
    setSending(true);
    try {
      await friendService.sendFriendRequest(userId);
      await updateFriendStatus(userId);
      onRequestSent?.();
    } catch (err) {
      // Có thể dùng Alert.alert nếu muốn hiển thị lỗi
    } finally {
      setSending(false);
    }
  };

  const handleStartChat = async () => {
    try {
      const convo = await chatService.getOrCreateDirectConversation(userId);
      if (!convo?._id) return;
      const socket = useSocketStore.getState().socket;
      socket?.emit("join-conversation", { conversationId: convo._id });
      addConversation(convo);
      setActiveConversation(convo._id);
      router.push("/chat");
    } catch {
      // Có thể dùng Alert.alert nếu muốn hiển thị lỗi
    }
  };

  return (
    <View style={[styles.wrapper, style]}>
      {/* ĐÃ LÀ BẠN BÈ */}
      {requestStatus === "friend" && (
        <View style={[styles.statusBanner, styles.bannerFriend]}>
          <UserCheck size={13} color="#34d399" />
          <Text style={[styles.bannerText, styles.bannerTextFriend]}>
            Bạn bè
          </Text>
        </View>
      )}

      {/* ĐÃ GỬI YÊU CẦU */}
      {requestStatus === "sent" && (
        <View style={[styles.statusBanner, styles.bannerSent]}>
          {isUpdatingStatus ? (
            <ActivityIndicator size="small" color="#93c5fd" />
          ) : (
            <Clock size={13} color="#93c5fd" />
          )}
          <Text style={[styles.bannerText, styles.bannerTextSent]}>
            Đang chờ được đồng ý kết bạn
          </Text>
        </View>
      )}

      {/* ĐÃ NHẬN YÊU CẦU */}
      {requestStatus === "received" && (
        <View style={[styles.statusBanner, styles.bannerReceived]}>
          {isUpdatingStatus ? (
            <ActivityIndicator size="small" color="#fbbf24" />
          ) : (
            <Bell size={13} color="#fbbf24" />
          )}
          <Text style={[styles.bannerText, styles.bannerTextReceived]}>
            Đã nhận lời mời kết bạn từ người này
          </Text>
        </View>
      )}

      {/* CHƯA KẾT BẠN */}
      {requestStatus === "none" && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnFriend]}
            onPress={handleSendRequest}
            disabled={sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#93c5fd" />
            ) : (
              <UserPlus size={14} color="#93c5fd" />
            )}
            <Text style={[styles.btnText, styles.btnTextFriend]}>
              Gửi kết bạn
            </Text>
          </TouchableOpacity>

          {showChat && (
            <TouchableOpacity
              style={[styles.btn, styles.btnChat]}
              onPress={handleStartChat}
              activeOpacity={0.8}
            >
              <MessageCircle size={14} color="#94a3b8" />
              <Text style={[styles.btnText, styles.btnTextChat]}>Nhắn tin</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Nút chat riêng khi đã là bạn / sent / received */}
      {showChat && requestStatus !== "none" && (
        <TouchableOpacity
          style={[styles.btn, styles.btnChat, { marginLeft: 8 }]}
          onPress={handleStartChat}
          activeOpacity={0.8}
        >
          <MessageCircle size={14} color="#94a3b8" />
          <Text style={[styles.btnText, styles.btnTextChat]}>Nhắn tin</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",  // thêm
  marginVertical: 8,
  flexWrap: "wrap",
  gap: 8,
},

  // Status banners
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 5,
  },
  bannerFriend: {
    backgroundColor: "rgba(52,211,153,0.12)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.3)",
  },
  bannerSent: {
    backgroundColor: "rgba(147,197,253,0.1)",
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.25)",
  },
  bannerReceived: {
    backgroundColor: "rgba(251,191,36,0.1)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
  },
  bannerText: {
    fontSize: 11,
    fontWeight: "600",
  },
  bannerTextFriend: { color: "#34d399" },
  bannerTextSent: { color: "#93c5fd" },
  bannerTextReceived: { color: "#fbbf24" },

  // Actions row
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // Buttons
  btn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 6,
  },
  btnFriend: {
    backgroundColor: "rgba(37,99,235,0.15)",
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.35)",
  },
  btnChat: {
    backgroundColor: "rgba(148,163,184,0.1)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  btnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  btnTextFriend: { color: "#93c5fd" },
  btnTextChat: { color: "#94a3b8" },
});