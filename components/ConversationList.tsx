import { Search, UserRoundSearch, UsersRound } from "lucide-react-native";
import React, { useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuthStore } from "../stores/useAuthStore";
import { useSocketStore } from "../stores/useSocketStore";
import { getSafeMessagePreview } from "../utils/chatMessageCodec";
import { formatTime } from "../utils/formatTime";
import SearchUserModal from "./SearchUserModal";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Conversation {
  _id: string;
  group?: { name: string; avatar?: string };
  participants: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  }[];
  lastMessage?: {
    content: string;
    createdAt: string;
  };
  unread?: number;
  isStranger?: boolean;
  strangerStatus?: string;
}

type Tab = "all" | "direct" | "group";

// ─── Avatar color helper ──────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ConversationList({
  conversations = [],
  activeId = null,
  onSelectConversation,
  onOpenCreateGroup,
}: {
  conversations: Conversation[];
  activeId?: string | null;
  onSelectConversation: (id: string) => void;
  onOpenCreateGroup?: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [showSearchModal, setShowSearchModal] = useState(false); // quản lý modal ở đây, giống web

  const { user } = useAuthStore();
  const { onlineUsers } = useSocketStore();

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const getOtherUser = (conv: Conversation) =>
    conv.participants?.find((p) => String(p._id) !== String(user?.userId));

  const getName = (conv: Conversation) => {
    if (conv.group) return conv.group.name;
    return getOtherUser(conv)?.displayName || "Unknown";
  };

  const getAvatarUrl = (conv: Conversation) => {
    if (conv.group) return null;
    return getOtherUser(conv)?.avatarUrl ?? null;
  };

  const isOnline = (conv: Conversation) => {
    if (conv.group) return false;
    const other = getOtherUser(conv);
    return other ? onlineUsers.includes(other._id) : false;
  };

  // ─── Filter ───────────────────────────────────────────────────────────────
  const filtered = conversations.filter((c) => {
    const matchSearch = getName(c)
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    if (activeTab === "group") return matchSearch && !!c.group;
    if (activeTab === "direct") return matchSearch && !c.group;
    return matchSearch;
  });

  // ─── Tabs config ──────────────────────────────────────────────────────────
  const TABS: { key: Tab; label: string }[] = [
    { key: "all", label: "Tất cả" },
    { key: "direct", label: "Đoạn chat" },
    { key: "group", label: "Nhóm chat" },
  ];

  // ─── Render item ──────────────────────────────────────────────────────────
  const renderItem = ({ item }: { item: Conversation }) => {
    const name = getName(item);
    const avatarUrl = getAvatarUrl(item);
    const online = isOnline(item);
    const color = getAvatarColor(name);
    const unread = item.unread ?? 0;
    const isActive = item._id === activeId;

    return (
      <TouchableOpacity
        style={[styles.convItem, isActive && styles.activeItem]}
        onPress={() => onSelectConversation(item._id)}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View
            style={[
              styles.avatarBox,
              { backgroundColor: color },
              isActive && {
                shadowColor: color,
                shadowOpacity: 0.5,
                shadowRadius: 8,
                elevation: 6,
              },
            ]}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>
                {name.slice(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          <View
            style={[
              styles.statusDot,
              online ? styles.dotOnline : styles.dotOffline,
            ]}
          />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.row}>
            <Text
              style={[styles.name, unread > 0 && styles.nameBold]}
              numberOfLines={1}
            >
              {name}
            </Text>
            <View style={styles.rowRight}>
              {item.isStranger && item.strangerStatus === "pending" && (
                <View style={styles.strangerBadge}>
                  <Text style={styles.strangerBadgeText}>Mới</Text>
                </View>
              )}
              {item.lastMessage && (
                <Text style={styles.time}>
                  {formatTime(item.lastMessage.createdAt)}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.row}>
            <Text
              style={[styles.lastMsg, unread > 0 && styles.lastMsgUnread]}
              numberOfLines={1}
            >
              {getSafeMessagePreview
                ? getSafeMessagePreview(
                    item.lastMessage?.content,
                    "Chưa có tin nhắn",
                  )
                : item.lastMessage?.content || "Chưa có tin nhắn"}
            </Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {unread > 9 ? "9+" : unread}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Tin nhắn</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setShowSearchModal(true)}
            >
              <UserRoundSearch size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onOpenCreateGroup}
            >
              <UsersRound size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Search size={15} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Search size={28} color="#334155" />
              <Text style={styles.emptyText}>
                Không tìm thấy cuộc trò chuyện
              </Text>
            </View>
          }
        />
      </View>
      <SearchUserModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 0, backgroundColor: "#080e1c", maxHeight: "100%" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  title: { color: "white", fontSize: 22, fontWeight: "800" },
  headerIcons: { flexDirection: "row", gap: 12 },
  iconBtn: {
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, height: 40, color: "white", fontSize: 14 },

  tabs: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  tabActive: {
    backgroundColor: "rgba(59,130,246,0.2)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.4)",
  },
  tabText: { color: "#64748b", fontSize: 12, fontWeight: "500" },
  tabTextActive: { color: "#93c5fd", fontWeight: "700" },

  convItem: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    marginHorizontal: 8,
    marginVertical: 2,
  },
  activeItem: { backgroundColor: "rgba(59,130,246,0.1)" },

  avatarWrap: { position: "relative", flexShrink: 0 },
  avatarBox: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 50, height: 50 },
  avatarText: { color: "white", fontWeight: "700", fontSize: 14 },
  statusDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#080e1c",
  },
  dotOnline: { backgroundColor: "#10b981" },
  dotOffline: { backgroundColor: "#334155" },

  info: { flex: 1, minWidth: 0 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
    marginLeft: 4,
  },
  name: { color: "#cbd5e1", fontSize: 14, fontWeight: "500", flex: 1 },
  nameBold: { color: "white", fontWeight: "700" },
  time: { color: "#475569", fontSize: 11 },
  lastMsg: { color: "#475569", fontSize: 12, flex: 1 },
  lastMsgUnread: { color: "#94a3b8" },

  unreadBadge: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  unreadText: { color: "white", fontSize: 11, fontWeight: "700" },
  strangerBadge: {
    backgroundColor: "rgba(248,113,113,0.15)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.3)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  strangerBadgeText: { color: "#fca5a5", fontSize: 10 },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyText: { color: "#475569", fontSize: 13 },
});
