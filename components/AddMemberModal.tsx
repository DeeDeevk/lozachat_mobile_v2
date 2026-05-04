// components/AddMemberModal.tsx
import React, { useEffect, useMemo, useState } from "react";
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
import { UserPlus, X, Search } from "lucide-react-native";
import { useFriendStore } from "../stores/useFriendStore";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AddMemberModalProps {
  conversationId: string;
  currentParticipantIds: string[];
  onClose: () => void;
  onAdd: (targetUserId: string) => Promise<void>;
}

// ─── Avatar color helper (Đồng bộ với logic màu của bạn) ──────────────────────
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

export default function AddMemberModal({
  visible,
  currentParticipantIds,
  onClose,
  onAdd,
}: AddMemberModalProps) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState<string | null>(null);
  const { friends, getFriends } = useFriendStore();

  useEffect(() => {
    if (visible) {
      getFriends(); // Load lại danh sách bạn bè khi mở modal
    }
  }, [visible]);
  // Lọc bạn bè chưa có trong nhóm - Đồng bộ logic filter từ Web
  const eligible = useMemo(() => {
    return friends.filter(
      (f) =>
        !currentParticipantIds.includes(f._id) &&
        f.displayName.toLowerCase().includes(search.toLowerCase()),
    );
  }, [friends, currentParticipantIds, search]);

  const handleAdd = async (friendId: string) => {
    setAdding(friendId);
    await onAdd(friendId);
    setAdding(null);
  };

  const renderItem = ({ item }: { item: any }) => {
    const isAdding = adding === item._id;
    const color = getAvatarColor(item.displayName);

    return (
      <View style={styles.friendItem}>
        {/* Avatar Cluster */}
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

        {/* Add button - Style đồng bộ bản Web */}
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* 1. Lớp backdrop căn giữa tuyệt đối */}
      <View style={styles.backdrop}>
        {/* 2. Nhấn ra ngoài để đóng */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        {/* 3. Dùng KeyboardAvoidingView để đẩy modal lên khi hiện bàn phím */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.centeredView} // Dùng style mới ở dưới
        >
          {/* 4. Thẻ Modal chính */}
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            {/* Nội dung Header, Search, FlatList giữ nguyên của Khoa */}
            <View style={styles.modalHeader}>
              <Text style={styles.title}>Thêm thành viên</Text>
              <TouchableOpacity onPress={onClose}>
                <X size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Ô Search */}
            <View style={styles.searchContainer}>
              <Search size={16} color="#475569" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm bạn bè..."
                placeholderTextColor="#64748b"
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
            </View>

            {/* Danh sách */}
            <FlatList
              data={eligible}
              keyExtractor={(item) => item._id}
              showsVerticalScrollIndicator={true}
              style={{ maxHeight: 400 }} // Giới hạn chiều cao để không tràn màn hình
              contentContainerStyle={
                eligible.length === 0 ? styles.emptyContainer : { gap: 10 }
              }
              renderItem={renderItem} // Dùng hàm renderItem bạn đã viết bên trên
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  Không tìm thấy bạn bè phù hợp
                </Text>
              }
            />
          </Pressable>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    width: "auto",
  },
  centered: {
    width: "100%",
    flex: 1, // Quan trọng: chiếm hết chiều cao khả dụng
    justifyContent: "center", // Căn giữa nội dung theo chiều dọc
    alignItems: "center", // Căn giữa nội dung theo chiều ngang
  },
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  card: {
    width: "90%", // Chiếm 90% chiều ngang điện thoại
    maxWidth: 400, // Giới hạn giống bản Web
    alignSelf: "center", // Tự căn giữa chính nó trong cha
    backgroundColor: "#1e293b",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    // Hiệu ứng bóng đổ
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },

  // Style cho ô search để giống Web hơn
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    height: 45,
    color: "#f1f5f9",
    fontSize: 15,
  },

  // Style từng hàng friend item (như Web)
  friendItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "rgba(148,163,184,0.05)",
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: { color: "#f1f5f9", fontSize: 16, fontWeight: "600" },
  closeBtn: { padding: 4 },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarText: { color: "white", fontWeight: "700", fontSize: 13 },
  friendName: { flex: 1, color: "#f1f5f9", fontSize: 14, fontWeight: "500" },

  // Button đồng bộ style web
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  addBtnDisabled: { backgroundColor: "#334155" },
  addBtnText: { color: "white", fontSize: 12, fontWeight: "600" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  popupTitle: {
    color: "#f1f5f9",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    textAlign: "center",
  },
});
