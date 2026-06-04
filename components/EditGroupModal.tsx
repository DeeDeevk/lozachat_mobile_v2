import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from "react-native";
import { Camera, Check, AlertCircle, ChevronLeft } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Conversation } from "@/types/chat";
import { chatService } from "@/services/chatService";
import { useChatStore } from "@/stores/useChatStore";

interface EditGroupModalProps {
  visible: boolean;
  conversation: Conversation;
  onClose: () => void;
}

export default function EditGroupMobileModal({
  visible,
  conversation,
  onClose,
}: EditGroupModalProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(conversation.group?.name || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    conversation.group?.avatar || null,
  );
  const [avatarFile, setAvatarFile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isDirty =
    name.trim() !== (conversation.group?.name || "") || avatarFile !== null;

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const selected = result.assets[0];

      // Giới hạn 5MB
      if (selected.fileSize && selected.fileSize > 5 * 1024 * 1024) {
        setError("Ảnh không được vượt quá 5MB");
        return;
      }

      setError(null);
      setAvatarPreview(selected.uri);
      setAvatarFile({
        uri: selected.uri,
        name: selected.fileName || "avatar.jpg",
        type: selected.mimeType || "image/jpeg",
      });
    }
  };

  const handleSubmit = async () => {
    if (!isDirty || loading) return;
    const trimmedName = name.trim();

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      if (trimmedName !== conversation.group?.name) {
        formData.append("name", trimmedName);
      }
      if (avatarFile) {
        // @ts-ignore
        formData.append("avatar", avatarFile);
      }

      const updated = await chatService.updateGroupInfo(
        conversation._id,
        formData,
      );

      useChatStore.getState().updateConversation(updated.conversation);
      setSuccess(true);

      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: "#0f172a" }]}>
        <StatusBar barStyle="light-content" />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Header với xử lý Safe Area (Tai thỏ) */}
          <View
            style={[
              styles.header,
              {
                paddingTop:
                  Platform.OS === "ios" ? insets.top : insets.top + 10,
                height:
                  Platform.OS === "ios" ? 55 + insets.top : 65 + insets.top,
              },
            ]}
          >
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <ChevronLeft size={28} color="white" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Chỉnh sửa nhóm</Text>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!isDirty || loading || success}
              style={styles.headerBtn}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#6366f1" />
              ) : (
                <Text
                  style={[
                    styles.saveTxt,
                    (!isDirty || success) && { color: "#475569" },
                  ]}
                >
                  Lưu
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + 20 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Ảnh đại diện */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                onPress={pickImage}
                activeOpacity={0.8}
                style={styles.avatarContainer}
              >
                {avatarPreview ? (
                  <Image
                    source={{ uri: avatarPreview }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitial}>
                      {(name || "G").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Camera size={16} color="white" />
                </View>
                {avatarFile && (
                  <View style={styles.checkBadge}>
                    <Check size={10} color="white" />
                  </View>
                )}
              </TouchableOpacity>
              <Text style={styles.avatarHint}>
                Chạm để thay đổi ảnh đại diện
              </Text>
            </View>

            {/* Nhập tên nhóm */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Tên nhóm</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  setError(null);
                }}
                placeholder="Nhập tên nhóm..."
                placeholderTextColor="#64748b"
                maxLength={100}
                returnKeyType="done"
              />
              <Text
                style={[
                  styles.charCount,
                  name.length > 90 && { color: "#ef4444" },
                ]}
              >
                {name.length}/100
              </Text>
            </View>

            {/* Thông báo lỗi */}
            {error && (
              <View style={styles.errorBox}>
                <AlertCircle size={16} color="#f87171" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          {/* Màn hình thông báo thành công */}
          {success && (
            <View style={styles.successOverlay}>
              <View style={styles.successCircle}>
                <Check size={40} color="white" />
              </View>
              <Text style={styles.successText}>Đã lưu thay đổi</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: "#0f172a",
  },
  headerTitle: { color: "white", fontSize: 17, fontWeight: "700" },
  headerBtn: { minWidth: 45, alignItems: "center", justifyContent: "center" },
  saveTxt: { color: "#6366f1", fontSize: 16, fontWeight: "700" },
  scrollContent: { padding: 24, alignItems: "center" },

  avatarSection: { marginBottom: 32, alignItems: "center" },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: "#312e81",
    borderStyle: "dashed",
    padding: 4,
    position: "relative",
  },
  avatarImage: { width: "100%", height: "100%", borderRadius: 50 },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
    backgroundColor: "#312e81",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { color: "white", fontSize: 36, fontWeight: "bold" },
  cameraBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "#6366f1",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#0f172a",
  },
  checkBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "#10b981",
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0f172a",
  },
  avatarHint: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 12,
    fontWeight: "500",
  },

  formGroup: {
    width: "100%",
    backgroundColor: "#1e293b",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
  },
  label: {
    color: "#6366f1",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    color: "white",
    fontSize: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.2)",
  },
  charCount: {
    textAlign: "right",
    color: "#475569",
    fontSize: 11,
    marginTop: 8,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(239,68,68,0.1)",
    padding: 14,
    borderRadius: 12,
    marginTop: 20,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
  errorText: { color: "#f87171", fontSize: 13, fontWeight: "500" },

  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#059669",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  successText: { color: "white", fontSize: 18, fontWeight: "700" },
});
