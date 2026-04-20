// components/AddMemberModal.tsx
import { UserPlus, X, Search } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFriendStore } from "../stores/useFriendStore";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AddMemberModalProps {
  conversationId: string;
  currentParticipantIds: string[];
  onClose: () => void;
  onAdd: (targetUserId: string) => Promise<void>;
}

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
export default function AddMemberModal({
  conversationId,
  currentParticipantIds,
  onClose,
  onAdd,
}: AddMemberModalProps) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const { friends, getFriends } = useFriendStore();

  useEffect(() => {
    getFriends();
  }, [getFriends]);

  // Lọc bạn bè chưa có trong nhóm (giống web)
  const eligible = friends.filter(
    (f) =>
      !currentParticipantIds.includes(f._id) &&
      f.displayName.toLowerCase().includes(search.toLowerCase()),
  );

  const handleAdd = async (friendId: string) => {
    setAdding(friendId);
    await onAdd(friendId);
    setAdding(null);
  };

  // ─── Render friend item ───────────────────────────────────────────────────
  const renderItem = ({ item }: { item: (typeof friends)[number] }) => {
    const color = getAvatarColor(item.displayName);
    const isAdding = adding === item._id;

    return (
      <View style={styles.friendItem}>
        {/* Avatar */}
        <View
          style={[
            styles.avatar,
            { backgroundColor: item.avatarUrl ? "transparent" : color },
          ]}
        >
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>
              {item.displayName?.[0]?.toUpperCase()}
            </Text>
          )}
        </View>

        {/* Name */}
        <Text style={styles.friendName} numberOfLines={1}>
          {item.displayName}
        </Text>

        {/* Add button */}
        <TouchableOpacity
          style={[styles.addBtn, isAdding && styles.addBtnDisabled]}
          onPress={() => handleAdd(item._id)}
          disabled={isAdding}
          activeOpacity={0.7}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <UserPlus size={14} color="white" />
          )}
          <Text style={styles.addBtnText}>
            {isAdding ? "Đang thêm..." : "Thêm"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.centered}
        >
          {/* Modal card */}
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Thêm thành viên</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchBox}>
              <Search size={14} color="#475569" />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm bạn bè..."
                placeholderTextColor="#475569"
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            </View>

            {/* Friend list */}
            <FlatList
              data={eligible}
              renderItem={renderItem}
              keyExtractor={(item) => item._id}
              style={styles.list}
              contentContainerStyle={
                eligible.length === 0 ? styles.emptyContainer : { gap: 6 }
              }
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  Không có bạn bè nào để thêm
                </Text>
              }
            />
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  centered: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { color: "#f1f5f9", fontSize: 16, fontWeight: "600" },
  closeBtn: { padding: 4 },

  // Search
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(148,163,184,0.05)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: { flex: 1, height: 40, color: "#f1f5f9", fontSize: 13 },

  // List
  list: { maxHeight: 320 },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  emptyText: { color: "#475569", fontSize: 13 },

  // Friend item
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "rgba(148,163,184,0.05)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarImg: { width: 36, height: 36 },
  avatarText: { color: "white", fontWeight: "700", fontSize: 13 },
  friendName: { flex: 1, color: "#f1f5f9", fontSize: 14 },

  // Add button
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
  },
  addBtnDisabled: { backgroundColor: "#334155" },
  addBtnText: { color: "white", fontSize: 12, fontWeight: "600" },
});
