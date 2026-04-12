import { useAuthStore } from "@/stores/useAuthStore";
import { useChatStore } from "@/stores/useChatStore";
import { formatTime } from "@/utils/formatTime";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Image as ImageIcon, Send } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams(); // Chính là id từ router.push
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [input, setInput] = useState("");

  const {
    messages,
    fetchMessages,
    setActiveConversation,
    conversations,
    sendDirectMessage,
    sendGroupMessage,
  } = useChatStore();
  const { user } = useAuthStore();

  // Lấy dữ liệu hội thoại hiện tại
  const activeConv = conversations.find((c) => c._id === id);
  const currentMessages = messages[id as string]?.items || [];
  const otherUser = activeConv?.participants?.find(
    (p) => p._id !== user?.userId,
  );

  useEffect(() => {
    if (id) {
      setActiveConversation(id as string);
      fetchMessages(id as string);
    }
    return () => setActiveConversation(null);
  }, [id]);

  const handleSend = async () => {
    if (!input.trim()) return;

    try {
      if (activeConv?.group) {
        await sendGroupMessage(id as string, input);
      } else {
        // Kiểm tra chắc chắn có otherUser và _id rồi mới gửi
        if (otherUser?._id) {
          await sendDirectMessage(otherUser._id, input);
        } else {
          console.error("Không tìm thấy người nhận");
          return;
        }
      }
      setInput("");
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    } catch (error) {
      Alert.alert("Lỗi", "Không thể gửi tin nhắn");
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === user?.userId;
    return (
      <View
        style={[styles.msgContainer, isMe ? styles.myMsg : styles.otherMsg]}
      >
        <View
          style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}
        >
          <Text style={styles.msgText}>{item.content}</Text>
          <Text style={styles.msgTime}>{formatTime(item.createdAt)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Custom Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <ChevronLeft color="white" size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {activeConv?.group?.name || otherUser?.displayName || "Đang tải..."}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          ref={flatListRef}
          data={currentMessages}
          renderItem={renderMessage}
          keyExtractor={(item, index) =>
            item._id ? item._id.toString() : `msg-${index}`
          }
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <View style={styles.inputArea}>
            <TouchableOpacity style={styles.iconBtn}>
              <ImageIcon color="#94a3b8" size={24} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor="#64748b"
              value={input}
              onChangeText={setInput}
              multiline
              textAlignVertical="center"
            />
            <TouchableOpacity onPress={handleSend} disabled={!input.trim()}>
              <LinearGradient
                colors={
                  input.trim() ? ["#2563eb", "#3b82f6"] : ["#334155", "#475569"]
                }
                style={styles.sendBtn}
              >
                <Send color="white" size={18} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#060d1f" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },
  backBtn: { width: 40 },
  listContent: { padding: 16 },
  msgContainer: { marginBottom: 12, flexDirection: "row" },
  myMsg: { justifyContent: "flex-end" },
  otherMsg: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", padding: 12, borderRadius: 18 },
  myBubble: { backgroundColor: "#2563eb", borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: "#1e293b", borderBottomLeftRadius: 4 },
  msgText: { color: "white", fontSize: 15 },
  msgTime: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#0f172a",
    paddingBottom: Platform.OS === "ios" ? 35 : 15,
  },
  iconBtn: { padding: 8 },
  input: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 8,
    paddingBottom: Platform.OS === "ios" ? 12 : 8,
    color: "white",
    marginHorizontal: 8,
    fontSize: 16,
    minHeight: 44,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
