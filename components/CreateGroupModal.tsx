// components/CreateGroupModal.tsx
import { Check, Search, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { useChatStore } from "../stores/useChatStore";
import { useFriendStore } from "../stores/useFriendStore";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialMembers?: any[]; // Pre-selected members (e.g., from ConversationInfoPanel)
  onGroupCreated?: () => void; // Callback sau khi tạo group
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

// ─── Component ────────────────────────────────────────────────────────────────
export default function CreateGroupModal({
  isOpen,
  onClose,
  initialMembers = [],
  onGroupCreated,
}: Props) {
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchResult, setSearchResult] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedStrangers, setSelectedStrangers] = useState<any[]>([]);

  const { friends, getFriends, searchByUserName } = useFriendStore();
  const { createConversation } = useChatStore();

  // Fetch friends once on component mount
  useEffect(() => {
    getFriends();
  }, []);

  // Reset khi mở modal, pre-select initialMembers
  useEffect(() => {
    if (isOpen) {
      setGroupName("");
      setSearchQuery("");

      // Pre-select initialMembers
      const initialIds = initialMembers.map((m) => m._id);
      setSelectedIds(initialIds);
      setSelectedStrangers(initialMembers);

      setSearchResult(null);
    }
  }, [isOpen]);

  // Debounce search username
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      const user = await searchByUserName(searchQuery.trim());
      setSearchResult(user);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggle = (id: string, stranger?: any) => {
    const isRemoving = selectedIds.includes(id);
    setSelectedIds((prev) =>
      isRemoving ? prev.filter((x) => x !== id) : [...prev, id],
    );
    if (isRemoving) {
      setSelectedStrangers((prev) => prev.filter((s) => s._id !== id));
    } else if (stranger) {
      setSelectedStrangers((prev) => [...prev, stranger]);
    }
  };

  // Filter: exclude initialMembers already selected (hide them from list)
  const filteredFriends = friends.filter((f) => {
    // Hide nếu đã được pre-select
    if (initialMembers.some((m) => m._id === f._id)) return false;

    return (
      f.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const selectedUsers = Array.from(
    new Map(
      [
        ...friends.filter((f) => selectedIds.includes(f._id)),
        ...selectedStrangers.filter((s) => selectedIds.includes(s._id)),
      ].map((u) => [u._id, u]),
    ).values(),
  );

  const handleCreate = async () => {
    if (!groupName.trim() || selectedIds.length < 2) return;
    setIsCreating(true);
    try {
      await createConversation({
        type: "group",
        name: groupName.trim(),
        memberIds: selectedIds,
      });
      onGroupCreated?.();
      onClose();
    } finally {
      setIsCreating(false);
    }
  };

  const canCreate = groupName.trim().length > 0 && selectedIds.length >= 2;

  // ─── Render friend row ────────────────────────────────────────────────────
  const renderFriendItem = ({
    item: f,
  }: {
    item: (typeof friends)[number];
  }) => {
    const selected = selectedIds.includes(f._id);
    const name = f.displayName || f.username || "";
    return (
      <TouchableOpacity
        style={[styles.friendRow, selected && styles.friendRowSelected]}
        onPress={() => toggle(f._id)}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View
          style={[
            styles.friendAvatar,
            {
              backgroundColor: f.avatarUrl
                ? "transparent"
                : getAvatarColor(name),
            },
          ]}
        >
          {f.avatarUrl ? (
            <Image
              source={{ uri: f.avatarUrl }}
              style={styles.friendAvatarImg}
            />
          ) : (
            <Text style={styles.friendAvatarText}>{getInitials(name)}</Text>
          )}
        </View>

        {/* Info */}
        <View style={styles.friendInfo}>
          <Text style={styles.friendName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.friendUsername}>@{f.username}</Text>
        </View>

        {/* Checkbox */}
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Check size={11} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.centered}
        >
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            {/* ── Header ── */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Tạo nhóm chat</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* ── Group name input ── */}
            <View style={styles.section}>
              <Text style={styles.label}>Tên nhóm</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập tên nhóm..."
                placeholderTextColor="#475569"
                value={groupName}
                onChangeText={setGroupName}
              />
            </View>

            {/* ── Search input ── */}
            <View style={[styles.section, { paddingTop: 0 }]}>
              <View style={styles.searchBox}>
                <Search size={14} color="#475569" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Tìm bạn bè hoặc nhập username..."
                  placeholderTextColor="#475569"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            {/* ── Selected tags ── */}
            {selectedUsers.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tagsContainer}
                style={styles.tagsScroll}
              >
                {selectedUsers.map((u) => {
                  const name = u.displayName || u.username || "";
                  return (
                    <View key={u._id} style={styles.tag}>
                      <View
                        style={[
                          styles.tagAvatar,
                          { backgroundColor: getAvatarColor(name) },
                        ]}
                      >
                        <Text style={styles.tagAvatarText}>
                          {getInitials(name)}
                        </Text>
                      </View>
                      <Text style={styles.tagName} numberOfLines={1}>
                        {name}
                      </Text>
                      <TouchableOpacity onPress={() => toggle(u._id)}>
                        <X size={11} color="#93c5fd" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* ── Friend list ── */}
            <View style={styles.listContainer}>
              <View style={styles.sectionLabel}>
                <Text style={styles.sectionLabelText}>BẠN BÈ</Text>
              </View>

              <FlatList
                data={filteredFriends}
                renderItem={renderFriendItem}
                keyExtractor={(item) => item._id}
                style={styles.list}
                scrollEnabled
                ListEmptyComponent={
                  !searchResult ? (
                    <Text style={styles.emptyText}>Không tìm thấy</Text>
                  ) : null
                }
              />

              {/* Username search result (người lạ) */}
              {searchResult &&
                !friends.find((f) => f._id === searchResult._id) && (
                  <>
                    <View
                      style={[styles.sectionLabel, styles.sectionLabelBorder]}
                    >
                      <Text style={styles.sectionLabelText}>
                        KẾT QUẢ TÌM KIẾM
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.friendRow,
                        selectedIds.includes(searchResult._id) &&
                          styles.friendRowSelected,
                      ]}
                      onPress={() => toggle(searchResult._id, searchResult)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.strangerAvatar}>
                        <Text style={styles.strangerAvatarText}>?</Text>
                      </View>
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName}>
                          {searchResult.displayName ||
                            `@${searchResult.username}`}
                        </Text>
                        <Text style={styles.friendUsername}>
                          Không phải bạn bè
                        </Text>
                      </View>
                      <View style={styles.strangerBadge}>
                        <Text style={styles.strangerBadgeText}>Người lạ</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
            </View>

            {/* ── Footer ── */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Huỷ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.createBtn,
                  !canCreate && styles.createBtnDisabled,
                ]}
                onPress={handleCreate}
                disabled={!canCreate || isCreating}
                activeOpacity={0.7}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.createBtnText}>
                    {`Tạo nhóm${selectedIds.length >= 2 ? ` (${selectedIds.length})` : ""}`}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
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
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  centered: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "rgba(8,14,28,0.97)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerTitle: { fontSize: 15, fontWeight: "600", color: "#f1f5f9" },
  closeBtn: { padding: 4 },

  // Sections
  section: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  label: { fontSize: 12, color: "#64748b", marginBottom: 6 },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: "#f1f5f9",
  },

  // Search
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, height: 38, fontSize: 13, color: "#f1f5f9" },

  // Selected tags
  tagsScroll: { maxHeight: 44 },
  tagsContainer: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(59,130,246,0.15)",
    borderRadius: 999,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 3,
  },
  tagAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tagAvatarText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  tagName: { color: "#93c5fd", fontSize: 12, maxWidth: 80 },

  // List
  listContainer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  list: { maxHeight: 220 },
  sectionLabel: {
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  sectionLabelBorder: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    marginTop: 4,
  },
  sectionLabelText: {
    fontSize: 11,
    color: "#475569",
    letterSpacing: 0.5,
  },
  emptyText: {
    textAlign: "center",
    color: "#475569",
    fontSize: 13,
    padding: 20,
  },

  // Friend row
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  friendRowSelected: { backgroundColor: "rgba(59,130,246,0.07)" },
  friendAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  friendAvatarImg: { width: 36, height: 36 },
  friendAvatarText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  friendInfo: { flex: 1, minWidth: 0 },
  friendName: { fontSize: 13, fontWeight: "500", color: "#cbd5e1" },
  friendUsername: { fontSize: 11, color: "#475569" },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },

  // Stranger
  strangerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  strangerAvatarText: { color: "#475569", fontSize: 12 },
  strangerBadge: {
    backgroundColor: "rgba(251,191,36,0.1)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    flexShrink: 0,
  },
  strangerBadgeText: { color: "#fbbf24", fontSize: 11 },

  // Footer
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    padding: 12,
    paddingHorizontal: 18,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cancelBtnText: { fontSize: 13, color: "#94a3b8" },
  createBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#3b82f6",
    minWidth: 90,
    alignItems: "center",
  },
  createBtnDisabled: { backgroundColor: "rgba(59,130,246,0.3)" },
  createBtnText: { fontSize: 13, fontWeight: "500", color: "#fff" },
});
