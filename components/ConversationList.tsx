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
import { formatTime } from "../utils/formatTime";

export default function ConversationList({
  conversations,
  activeId = null,
  onSelectConversation,
  onOpenSearch,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useAuthStore();
  const { onlineUsers } = useSocketStore();

  const getOtherUser = (conv: any) => {
    return conv.participants?.find(
      (p: any) => String(p._id) !== String(user?.userId),
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const otherUser = getOtherUser(item);
    const name = item.group
      ? item.group.name
      : otherUser?.displayName || "Unknown";
    const isOnline = otherUser ? onlineUsers.includes(otherUser._id) : false;

    return (
      <TouchableOpacity
        style={[styles.convItem, item._id === activeId && styles.activeItem]}
        onPress={() => onSelectConversation(item._id)}
      >
        <View style={styles.avatarContainer}>
          {otherUser?.avatarUrl ? (
            <Image
              source={{ uri: otherUser.avatarUrl }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[styles.avatarPlaceholder, { backgroundColor: "#3b82f6" }]}
            >
              <Text style={styles.avatarText}>
                {name.slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          {isOnline && <View style={styles.onlineDot} />}
        </View>

        <View style={styles.info}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.time}>
              {item.lastMessage ? formatTime(item.lastMessage.createdAt) : ""}
            </Text>
          </View>
          <Text style={styles.lastMsg} numberOfLines={1}>
            {item.lastMessage?.content || "Chưa có tin nhắn"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tin nhắn</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onOpenSearch?.()}
          >
            <UserRoundSearch size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <UsersRound size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Search size={16} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={conversations}
        renderItem={renderItem}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080e1c" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    alignItems: "center",
  },
  title: { color: "white", fontSize: 22, fontWeight: "800" },
  headerIcons: { flexDirection: "row", gap: 15 },
  iconBtn: { padding: 5 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 40, color: "white" },
  convItem: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
    gap: 12,
  },
  activeItem: { backgroundColor: "rgba(59, 130, 246, 0.1)" },
  avatarContainer: { position: "relative" },
  avatar: { width: 50, height: 50, borderRadius: 15 },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "white", fontWeight: "bold" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10b981",
    borderStroke: 2,
    borderColor: "#080e1c",
  },
  info: { flex: 1 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  name: { color: "white", fontWeight: "600", fontSize: 16 },
  time: { color: "#64748b", fontSize: 12 },
  lastMsg: { color: "#94a3b8", fontSize: 13 },
});
