import api from "@/lib/axios";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const C = {
  bgDark: "#060D1F",
  bgCard: "#0F172A",
  bgItem: "#1E293B",
  accentBlue: "#3B82F6",
  textGrey: "#94A3B8",
  border: "#1E293B",
};

export interface QuickMessage {
  _id: string;
  shortcut: string;
  content: string;
  createdAt: string;
}

// ─── VIEW: danh sách ───────────────────────────────────────────────────────────
function ListView({
  items,
  loading,
  deletingId,
  onAdd,
  onEdit,
  onDelete,
  onClose,
}: {
  items: QuickMessage[];
  loading: boolean;
  deletingId: string | null;
  onAdd: () => void;
  onEdit: (item: QuickMessage) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const confirmDelete = (item: QuickMessage) => {
    Alert.alert(
      "Xóa tin nhắn nhanh?",
      `Bạn chắc muốn xóa shortcut "${item.shortcut}"?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: () => onDelete(item._id),
        },
      ],
    );
  };

  return (
    <View
      style={{
        backgroundColor: C.bgCard,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: Platform.OS === "ios" ? 36 : 24,
        height: "75%",
      }}
    >
      {/* Handle + X */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 12,
          marginBottom: 4,
        }}
      >
        <View
          style={{
            width: 36,
            height: 4,
            backgroundColor: "rgba(255,255,255,0.15)",
            borderRadius: 2,
          }}
        />
        <TouchableOpacity
          onPress={onClose}
          hitSlop={12}
          style={{ position: "absolute", right: 16 }}
        >
          <Ionicons name="close" size={22} color={C.textGrey} />
        </TouchableOpacity>
      </View>

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
        }}
      >
        <View>
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "bold" }}>
            Tin nhắn nhanh
          </Text>
          <Text style={{ color: C.textGrey, fontSize: 12, marginTop: 2 }}>
            {items.length} shortcut đã lưu
          </Text>
        </View>
        <TouchableOpacity
          onPress={onAdd}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: C.accentBlue,
            borderRadius: 10,
            paddingHorizontal: 14,
            paddingVertical: 8,
            gap: 6,
          }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "600", fontSize: 13 }}>
            Thêm
          </Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      {loading ? (
        <View style={{ paddingVertical: 60, alignItems: "center" }}>
          <ActivityIndicator size="large" color={C.accentBlue} />
        </View>
      ) : items.length === 0 ? (
        <View
          style={{
            paddingVertical: 60,
            alignItems: "center",
            paddingHorizontal: 40,
          }}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={48}
            color="rgba(255,255,255,0.15)"
          />
          <Text
            style={{
              color: C.textGrey,
              fontSize: 14,
              marginTop: 14,
              textAlign: "center",
              lineHeight: 20,
            }}
          >
            Chưa có tin nhắn nhanh nào.{"\n"}Nhấn{" "}
            <Text style={{ color: C.accentBlue, fontWeight: "600" }}>
              + Thêm
            </Text>{" "}
            để tạo shortcut đầu tiên!
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i._id}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 8,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View
              style={{
                opacity: deletingId === item._id ? 0.4 : 1,
                backgroundColor: C.bgItem,
                borderRadius: 12,
                padding: 14,
                marginBottom: 10,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{
                  backgroundColor: `${C.accentBlue}22`,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  marginRight: 12,
                  minWidth: 72,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: C.accentBlue,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                  numberOfLines={1}
                >
                  {item.shortcut}
                </Text>
              </View>
              <Text
                style={{
                  flex: 1,
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 13,
                  lineHeight: 18,
                }}
                numberOfLines={2}
              >
                {item.content}
              </Text>
              <View style={{ flexDirection: "row", gap: 4, marginLeft: 8 }}>
                <TouchableOpacity
                  onPress={() => onEdit(item)}
                  disabled={!!deletingId}
                  style={{
                    padding: 6,
                    borderRadius: 8,
                    backgroundColor: "rgba(255,255,255,0.05)",
                  }}
                >
                  <Ionicons
                    name="pencil-outline"
                    size={16}
                    color={C.accentBlue}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(item)}
                  disabled={!!deletingId}
                  style={{
                    padding: 6,
                    borderRadius: 8,
                    backgroundColor: "rgba(255,255,255,0.05)",
                  }}
                >
                  {deletingId === item._id ? (
                    <ActivityIndicator size={14} color="#F87171" />
                  ) : (
                    <Ionicons name="trash-outline" size={16} color="#F87171" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ─── VIEW: form tạo / sửa ──────────────────────────────────────────────────────
function FormView({
  editing,
  existingShortcuts,
  onBack,
  onSaved,
}: {
  editing: QuickMessage | null;
  existingShortcuts: string[];
  onBack: () => void;
  onSaved: (item: QuickMessage) => void;
}) {
  const [shortcut, setShortcut] = useState(editing?.shortcut ?? "");
  const [content, setContent] = useState(editing?.content ?? "");
  const [errors, setErrors] = useState<{ shortcut?: string; content?: string }>(
    {},
  );
  const [saving, setSaving] = useState(false);
  const contentRef = useRef<TextInput>(null);

  const validate = () => {
    const e: typeof errors = {};
    const normalized = shortcut.trim().startsWith("/")
      ? shortcut.trim()
      : shortcut.trim()
        ? `/${shortcut.trim()}`
        : "";

    if (!normalized) {
      e.shortcut = "Vui lòng nhập shortcut";
    } else {
      const isDuplicate = existingShortcuts.some(
        (s) => s === normalized && s !== editing?.shortcut,
      );
      if (isDuplicate) e.shortcut = `Shortcut "${normalized}" đã tồn tại`;
    }
    if (!content.trim()) e.content = "Vui lòng nhập nội dung";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put(`/messages/quick-messages/${editing._id}`, {
          shortcut: shortcut.trim(),
          content: content.trim(),
        });
        onSaved(res.data.quickMessage);
      } else {
        const res = await api.post("/messages/quick-messages", {
          shortcut: shortcut.trim(),
          content: content.trim(),
        });
        onSaved(res.data.quickMessage);
      }
      onBack();
    } catch (error: any) {
      const msg = error?.response?.data?.message ?? "Thao tác thất bại";
      if (error?.response?.status === 409) {
        setErrors((p) => ({ ...p, shortcut: msg }));
      } else {
        Alert.alert("Lỗi", msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    // ScrollView để nội dung đẩy lên khi bàn phím mở,
    // KeyboardAvoidingView ở root modal sẽ co lại đúng chỗ
    <View
      style={{
        backgroundColor: C.bgCard,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: Platform.OS === "ios" ? 36 : 24,
      }}
    >
      {/* Header cố định */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          gap: 10,
        }}
      >
        <TouchableOpacity onPress={onBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color={C.textGrey} />
        </TouchableOpacity>
        <Text
          style={{ color: "#fff", fontSize: 17, fontWeight: "bold", flex: 1 }}
        >
          {editing ? "Sửa tin nhắn nhanh" : "Thêm tin nhắn nhanh"}
        </Text>
        <TouchableOpacity
          onPress={submit}
          disabled={saving}
          style={{
            backgroundColor: C.accentBlue,
            borderRadius: 8,
            paddingVertical: 8,
            paddingHorizontal: 16,
            minWidth: 70,
            alignItems: "center",
          }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ color: "#fff", fontWeight: "600" }}>
              {editing ? "Lưu" : "Thêm"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Fields cuộn được khi bàn phím che */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Shortcut */}
        <View style={{ marginBottom: 16 }}>
          <Text
            style={{
              color: C.textGrey,
              fontSize: 12,
              marginBottom: 6,
              fontWeight: "600",
              letterSpacing: 0.5,
            }}
          >
            SHORTCUT
          </Text>
          <View>
            <View
              style={{
                position: "absolute",
                left: 14,
                top: 0,
                bottom: 0,
                justifyContent: "center",
                zIndex: 1,
              }}
            >
              <Text
                style={{
                  color: C.accentBlue,
                  fontSize: 15,
                  fontWeight: "bold",
                }}
              >
                /
              </Text>
            </View>
            <TextInput
              value={shortcut.startsWith("/") ? shortcut.slice(1) : shortcut}
              onChangeText={(t) => {
                const clean = t.replace(/\//g, "");
                setShortcut(clean ? `/${clean}` : "");
                setErrors((p) => ({ ...p, shortcut: undefined }));
              }}
              placeholder="xinchao"
              placeholderTextColor={C.textGrey}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => contentRef.current?.focus()}
              style={{
                backgroundColor: "rgba(255,255,255,0.05)",
                borderWidth: 1,
                borderColor: errors.shortcut
                  ? "#F87171"
                  : "rgba(255,255,255,0.1)",
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingLeft: 28,
                paddingVertical: 12,
                color: "#fff",
                fontSize: 14,
              }}
            />
          </View>
          {errors.shortcut ? (
            <Text style={{ color: "#F87171", fontSize: 11, marginTop: 4 }}>
              {errors.shortcut}
            </Text>
          ) : (
            <Text style={{ color: C.textGrey, fontSize: 11, marginTop: 4 }}>
              Gõ{" "}
              <Text style={{ color: C.accentBlue }}>
                /
                {shortcut.startsWith("/")
                  ? shortcut.slice(1) || "shortcut"
                  : "shortcut"}
              </Text>{" "}
              trong chat để điền nhanh
            </Text>
          )}
        </View>

        {/* Content */}
        <View style={{ marginBottom: 8 }}>
          <Text
            style={{
              color: C.textGrey,
              fontSize: 12,
              marginBottom: 6,
              fontWeight: "600",
              letterSpacing: 0.5,
            }}
          >
            NỘI DUNG
          </Text>
          <TextInput
            ref={contentRef}
            value={content}
            onChangeText={(t) => {
              setContent(t);
              setErrors((p) => ({ ...p, content: undefined }));
            }}
            placeholder="Nhập nội dung tin nhắn..."
            placeholderTextColor={C.textGrey}
            multiline
            maxLength={1000}
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={submit}
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1,
              borderColor: errors.content ? "#F87171" : "rgba(255,255,255,0.1)",
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: "#fff",
              fontSize: 14,
              minHeight: 100,
              textAlignVertical: "top",
            }}
          />
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            {errors.content ? (
              <Text style={{ color: "#F87171", fontSize: 11 }}>
                {errors.content}
              </Text>
            ) : (
              <View />
            )}
            <Text style={{ color: C.textGrey, fontSize: 11 }}>
              {content.length}/1000
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── MAIN: 1 modal duy nhất, KeyboardAvoidingView bọc toàn bộ ─────────────────
type Screen = "list" | "form";

export function QuickMessageModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("list");
  const [editingItem, setEditingItem] = useState<QuickMessage | null>(null);
  const [items, setItems] = useState<QuickMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/messages/quick-messages");
      setItems(res.data.quickMessages ?? []);
    } catch (error: any) {
      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ?? "Không thể tải tin nhắn nhanh",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setScreen("list");
      setEditingItem(null);
      fetchItems();
    }
  }, [visible]);

  const openAdd = () => {
    setEditingItem(null);
    setScreen("form");
  };

  const openEdit = (item: QuickMessage) => {
    setEditingItem(item);
    setScreen("form");
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/messages/quick-messages/${id}`);
      setItems((prev) => prev.filter((i) => i._id !== id));
    } catch (error: any) {
      Alert.alert("Lỗi", error?.response?.data?.message ?? "Xóa thất bại");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaved = (saved: QuickMessage) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i._id === saved._id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  const handleClose = () => {
    setScreen("list");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/*
        KeyboardAvoidingView bọc toàn bộ overlay — đây là cách duy nhất
        hoạt động đúng trên cả iOS và Android trong bottom sheet modal.
        behavior="padding" trên iOS đẩy sheet lên đúng khoảng cách bàn phím.
        behavior="height" trên Android co chiều cao sheet lại.
      */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
        <Pressable
          style={{
            // overlay tối phía trên — không flex:1 để không chen vào KAV
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
          onPress={screen === "list" ? handleClose : undefined}
        />
        {/* Card nội dung — không Pressable lồng, dùng pointerEvents */}
        <View pointerEvents="box-none">
          {screen === "list" ? (
            <ListView
              items={items}
              loading={loading}
              deletingId={deletingId}
              onAdd={openAdd}
              onEdit={openEdit}
              onDelete={handleDelete}
              onClose={handleClose}
            />
          ) : (
            <FormView
              editing={editingItem}
              existingShortcuts={items.map((i) => i.shortcut)}
              onBack={() => setScreen("list")}
              onSaved={handleSaved}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
