import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from "react-native";
import {
  UserCheck,
  UserPlus,
  UserMinus,
  Clock,
  Check,
  X,
  MessageCircle,
  Loader2,
  Search,
  UserX,
  UserRoundSearch,
  Bell,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { useFriendStore } from "@/stores/useFriendStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { useChatStore } from "@/stores/useChatStore";
import SearchUserModal from "@/components/SearchUserModal";
import type { FriendRequest, Friend } from "@/types/user";
import { chatService } from "@/services/chatService";

type Tab = "friends" | "received" | "sent";

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

function Avatar({
  name,
  avatarUrl,
  size = 44,
}: {
  name: string;
  avatarUrl?: string;
  size?: number;
}) {
  const color = randomColor(name);
  const radius = Math.round(size * 0.28);

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius,
            resizeMode: "cover",
          },
          {
            shadowColor: color,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: color,
        },
        {
          shadowColor: color,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 4,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.36) }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

export default function FriendsPage() {
  const router = useRouter();
  const {
    loading,
    friends,
    newFriendIds,
    receivedList,
    sentList,
    getAllFriendRequest,
    getFriends,
    acceptRequest,
    declineRequest,
    cancelRequest,
    unfriend,
    clearNewFriends,
  } = useFriendStore();

  const socket = useSocketStore((state) => state.socket);
  const onlineUsers = useSocketStore((state) => state.onlineUsers);
  const { addConversation, setActiveConversation } = useChatStore();

  const [activeTab, setActiveTab] = useState<Tab>("friends");
  const [actionId, setActionId] = useState<string | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmUnfriend, setConfirmUnfriend] = useState<{
    friendId: string;
    name: string;
  } | null>(null);

  const socketListenerRef = useRef<boolean>(false);

  useEffect(() => {
    getAllFriendRequest();
    getFriends();
  }, []);

  // Listen for real-time friend updates
  useEffect(() => {
    if (!socket || socketListenerRef.current) return;

    const handleFriendUpdate = (update: {
      action: string;
      [key: string]: string | undefined;
    }) => {
      if (
        [
          "request_received",
          "request_accepted",
          "request_declined",
          "request_cancelled",
          "unfriend",
        ].includes(update.action)
      ) {
        getAllFriendRequest();
        getFriends();
      }
    };

    socketListenerRef.current = true;
    socket.off("friend_update");
    socket.on("friend_update", handleFriendUpdate);

    return () => {
      socket.off("friend_update", handleFriendUpdate);
      socketListenerRef.current = false;
    };
  }, [socket]);

  const handleAccept = async (requestId: string, name: string) => {
    setActionId(requestId);
    await acceptRequest(requestId);
    Toast.show({
      type: "success",
      text1: `Đã chấp nhận lời mời từ ${name}`,
    });
    setActionId(null);
    getFriends();
  };

  const handleDecline = async (requestId: string, name: string) => {
    setActionId(requestId);
    await declineRequest(requestId);
    Toast.show({
      type: "info",
      text1: `Đã từ chối lời mời từ ${name}`,
    });
    setActionId(null);
  };

  const handleCancel = async (requestId: string, name: string) => {
    setActionId(requestId);
    await cancelRequest(requestId);
    Toast.show({
      type: "info",
      text1: `Đã huỷ lời mời gửi đến ${name}`,
    });
    setActionId(null);
  };

  const handleUnfriend = (friendId: string, name: string) => {
    setConfirmUnfriend({ friendId, name });
  };

  const confirmUnfriendAction = async () => {
    if (!confirmUnfriend) return;
    setActionId(confirmUnfriend.friendId);
    await unfriend(confirmUnfriend.friendId);
    Toast.show({
      type: "info",
      text1: `Đã huỷ kết bạn với ${confirmUnfriend.name}`,
    });
    setActionId(null);
    setConfirmUnfriend(null);
  };

  const handleStartChat = async (friend: Friend) => {
    try {
      const convo = await chatService.getOrCreateDirectConversation(friend._id);
      if (!convo?._id) {
        Toast.show({
          type: "error",
          text1: "Lỗi",
          text2: "Không thể mở chat",
        });
        return;
      }
      addConversation(convo);
      setActiveConversation(convo._id);
      Toast.show({
        type: "success",
        text1: "Mở chat thành công",
      });
      // 🎯 Navigate tới ConversationList
      router.push("/(tabs)/");
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Không thể mở chat",
      });
    }
  };

  const enrichedFriends = friends.map((f) => ({
    ...f,
    isNew: newFriendIds.includes(f._id),
    isOnline: onlineUsers.includes(f._id),
  }));

  const sortedFriends = [...enrichedFriends].sort((a, b) => {
    if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
    return (a.displayName || "").localeCompare(b.displayName || "");
  });

  const filteredFriends = sortedFriends.filter((f) => {
    const name = f.displayName || f.username || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const tabItems = [
    { key: "friends" as Tab, label: "Bạn bè", count: friends.length },
    { key: "received" as Tab, label: "Nhận", count: receivedList.length },
    { key: "sent" as Tab, label: "Gửi", count: sentList.length },
  ];

  const renderFriendCard = ({
    item: friend,
  }: {
    item: (typeof enrichedFriends)[0];
  }) => {
    const name = friend.displayName || friend.username || "Người dùng";
    return (
      <View style={styles.friendCard}>
        <Avatar name={name} avatarUrl={friend.avatarUrl} size={46} />
        <View style={styles.friendInfo}>
          <View style={styles.friendNameRow}>
            <Text style={styles.friendName} numberOfLines={1}>
              {name}
            </Text>
            {friend.isNew && <Text style={styles.newBadge}>Bạn mới</Text>}
          </View>
          <Text style={styles.friendUsername} numberOfLines={1}>
            @{friend.username}
          </Text>
          <View
            style={[
              styles.friendOnline,
              {
                color: friend.isOnline ? "#06b6d4" : "#9ca3af",
              },
            ]}
          >
            <View
              style={[
                styles.onlineDot,
                {
                  backgroundColor: friend.isOnline ? "#06b6d4" : "#9ca3af",
                },
              ]}
            />
            <Text
              style={[
                styles.onlineText,
                { color: friend.isOnline ? "#06b6d4" : "#9ca3af" },
              ]}
            >
              {friend.isOnline ? "Đang hoạt động" : "Ngoại tuyến"}
            </Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.btnChat}
            onPress={() => handleStartChat(friend)}
          >
            <MessageCircle size={15} color="#60a5fa" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnUnfriend}
            disabled={actionId === friend._id}
            onPress={() => handleUnfriend(friend._id, name)}
          >
            {actionId === friend._id ? (
              <ActivityIndicator color="#f87171" size={15} />
            ) : (
              <UserX size={15} color="#f87171" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderReceivedCard = ({ item: req }: { item: FriendRequest }) => {
    const from = req.from || {};
    const name =
      (from as any)?.displayName || (from as any)?.username || "Người dùng";
    const isActing = actionId === req._id;
    return (
      <View style={styles.requestCard}>
        <Avatar name={name} avatarUrl={(from as any)?.avatarUrl} size={46} />
        <View style={styles.requestInfo}>
          <Text style={styles.requestName} numberOfLines={1}>
            {name}
          </Text>
          {req.message ? (
            <Text style={styles.requestMsg} numberOfLines={1}>
              "{req.message}"
            </Text>
          ) : (
            <Text style={styles.requestMsg} numberOfLines={1}>
              @{(from as any)?.username || name.toLowerCase()}
            </Text>
          )}
        </View>
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={styles.btnAccept}
            onPress={() => handleAccept(req._id, name)}
            disabled={isActing}
          >
            {isActing ? (
              <ActivityIndicator color="#fff" size={13} />
            ) : (
              <Check size={13} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnDecline}
            onPress={() => handleDecline(req._id, name)}
            disabled={isActing}
          >
            <X size={13} color="#f87171" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSentCard = ({ item: req }: { item: FriendRequest }) => {
    const to = req.to || {};
    const name =
      (to as any)?.displayName || (to as any)?.username || "Người dùng";
    const isActing = actionId === req._id;
    return (
      <View style={styles.requestCard}>
        <Avatar name={name} avatarUrl={(to as any)?.avatarUrl} size={46} />
        <View style={styles.requestInfo}>
          <Text style={styles.requestName} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.pendingRow}>
            <Clock size={11} color="#fbbf24" />
            <Text style={styles.pendingText}>Đang chờ phản hồi</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.btnCancel}
          onPress={() => handleCancel(req._id, name)}
          disabled={isActing}
        >
          {isActing ? (
            <ActivityIndicator color="#94a3b8" size={13} />
          ) : (
            <UserMinus size={13} color="#94a3b8" />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmpty = () => {
    if (activeTab === "friends" && loading && friends.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      );
    }

    let emptyMessage = "";
    if (activeTab === "friends") {
      emptyMessage = "Chưa có bạn bè";
    } else if (activeTab === "received") {
      emptyMessage = "Không có lời mời nào";
    } else {
      emptyMessage = "Chưa gửi lời mời nào";
    }

    return (
      <View style={styles.emptyState}>
        <UserCheck size={40} color="#475569" />
        <Text style={styles.emptyTitle}>{emptyMessage}</Text>
        <Text style={styles.emptySub}>
          {activeTab === "friends"
            ? "Gửi lời mời kết bạn để bắt đầu!"
            : activeTab === "received"
              ? "Khi có lời mời, nó sẽ xuất hiện ở đây"
              : "Tìm kiếm và gửi lời mời"}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerSection}>
        <View>
          <Text style={styles.headerTitle}>Danh sách bạn bè</Text>
          <Text style={styles.headerSub}>{friends.length} bạn bè</Text>
        </View>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => setShowSearchModal(true)}
        >
          <UserRoundSearch size={20} color="#60a5fa" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {tabItems.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => {
              setActiveTab(tab.key);
              if (tab.key === "friends") {
                clearNewFriends();
              }
            }}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <Text
                style={[
                  styles.tabBadge,
                  activeTab === tab.key && styles.tabBadgeActive,
                ]}
              >
                {tab.count > 99 ? "99+" : tab.count}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === "friends" && (
        <>
          {friends.length > 0 && (
            <View style={styles.searchInputContainer}>
              <Search size={14} color="#475569" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm trong danh sách bạn bè..."
                placeholderTextColor="#334155"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          )}
          <FlatList
            data={searchQuery ? filteredFriends : sortedFriends}
            renderItem={renderFriendCard}
            keyExtractor={(item) => item._id}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.contentContainer}
            scrollEnabled
          />
        </>
      )}

      {activeTab === "received" && (
        <FlatList
          data={receivedList}
          renderItem={renderReceivedCard}
          keyExtractor={(item) => item._id}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.contentContainer}
        />
      )}

      {activeTab === "sent" && (
        <FlatList
          data={sentList}
          renderItem={renderSentCard}
          keyExtractor={(item) => item._id}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.contentContainer}
        />
      )}

      {/* Search Modal */}
      <SearchUserModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onRequestSent={() => getAllFriendRequest()}
      />

      {/* Unfriend Confirmation */}
      {confirmUnfriend && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>
              Huỷ kết bạn với {confirmUnfriend.name}?
            </Text>
            <Text style={styles.confirmMessage}>
              Bạn sẽ không còn nhìn thấy bài viết của {confirmUnfriend.name}{" "}
              nữa, và họ cũng sẽ không thể nhìn thấy bài viết của bạn.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setConfirmUnfriend(null)}
              >
                <Text style={styles.confirmCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDelete}
                onPress={confirmUnfriendAction}
                disabled={actionId === confirmUnfriend.friendId}
              >
                {actionId === confirmUnfriend.friendId ? (
                  <ActivityIndicator color="#fff" size={16} />
                ) : (
                  <Text style={styles.confirmDeleteText}>Huỷ kết bạn</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#060d1f",
  },
  headerSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  headerSub: {
    fontSize: 12,
    color: "#475569",
    marginTop: 2,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(59,130,246,.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#818cf8",
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#94a3b8",
  },
  tabLabelActive: {
    color: "#c4b5fd",
  },
  tabBadge: {
    backgroundColor: "#6366f1",
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: "#818cf8",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  searchIcon: {
    position: "absolute",
    left: 26,
    zIndex: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 28,
    backgroundColor: "rgba(15,23,42,.9)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 12,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginVertical: 8,
  },
  emptySub: {
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
    maxWidth: 200,
  },
  friendCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(15,24,48,.9)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(99,102,246,.18)",
    marginBottom: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  friendName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  newBadge: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fbbf24",
    backgroundColor: "rgba(251, 191, 36, .15)",
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 3,
  },
  friendUsername: {
    fontSize: 11,
    color: "#475569",
    marginTop: 2,
  },
  friendOnline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  onlineText: {
    fontSize: 10,
  },
  cardActions: {
    flexDirection: "row",
    gap: 6,
  },
  btnChat: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(59,130,246,.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  btnUnfriend: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,.09)",
    justifyContent: "center",
    alignItems: "center",
  },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(15,24,48,.9)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(99,102,246,.18)",
    marginBottom: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  requestMsg: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    fontStyle: "italic",
  },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  pendingText: {
    fontSize: 10,
    color: "#fbbf24",
  },
  requestActions: {
    flexDirection: "row",
    gap: 8,
  },
  btnAccept: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
  },
  btnDecline: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  btnCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(100,116,139,.1)",
    borderWidth: 1,
    borderColor: "rgba(100,116,139,.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatar: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "800",
  },
  confirmOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmModal: {
    width: "90%",
    maxWidth: 320,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "rgba(10,16,32,.98)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  confirmTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 16,
    lineHeight: 18,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 8,
  },
  confirmCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(100,116,139,.1)",
    borderWidth: 1,
    borderColor: "rgba(100,116,139,.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmCancelText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94a3b8",
  },
  confirmDelete: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "linear-gradient(135deg,#ef4444,#dc2626)",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmDeleteText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
});
