import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

interface ManageGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: {
    requireApprovalToJoin?: boolean;
    whoCanEditGroup?: "all" | "admin";
    whoCanSendMessages?: "all" | "admin";
  };
  onUpdateSettings?: (settings: {
    requireApprovalToJoin?: boolean;
    whoCanEditGroup?: "all" | "admin";
    whoCanSendMessages?: "all" | "admin";
  }) => Promise<void>;
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────
function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
  disabled,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleInfo}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDesc}>{description}</Text>
      </View>
      <TouchableOpacity
        onPress={onToggle}
        disabled={disabled}
        activeOpacity={0.8}
        style={[
          styles.toggleTrack,
          enabled && styles.toggleTrackOn,
          disabled && { opacity: 0.5 },
        ]}
      >
        <View style={[styles.toggleThumb, enabled && styles.toggleThumbOn]} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ManageGroupModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: ManageGroupModalProps) {
  const insets = useSafeAreaInsets();

  const [requireApproval, setRequireApproval] = useState(
    settings?.requireApprovalToJoin ?? false,
  );
  const [allowMembersEditInfo, setAllowMembersEditInfo] = useState(
    settings?.whoCanEditGroup === "all",
  );
  const [allowMembersChat, setAllowMembersChat] = useState(
    settings?.whoCanSendMessages === "all",
  );

  useEffect(() => {
    if (!settings) return;
    setRequireApproval(settings.requireApprovalToJoin ?? false);
    setAllowMembersEditInfo(settings.whoCanEditGroup === "all");
    setAllowMembersChat(settings.whoCanSendMessages === "all");
  }, [
    settings?.requireApprovalToJoin,
    settings?.whoCanEditGroup,
    settings?.whoCanSendMessages,
  ]);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sheet */}
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quản lý nhóm</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Cài đặt</Text>

            <ToggleRow
              title="Phê duyệt thành viên mới"
              description="Thành viên mới cần được duyệt trước khi vào nhóm"
              enabled={requireApproval}
              onToggle={() => {
                const next = !requireApproval;
                setRequireApproval(next);
                onUpdateSettings?.({ requireApprovalToJoin: next });
              }}
              disabled={!onUpdateSettings}
            />

            <View style={styles.divider} />

            <ToggleRow
              title="Thay đổi ảnh và tên nhóm"
              description={
                allowMembersEditInfo
                  ? "Tất cả thành viên có thể thay đổi ảnh và tên nhóm"
                  : "Chỉ trưởng nhóm và phó nhóm mới có thể thay đổi"
              }
              enabled={allowMembersEditInfo}
              onToggle={() => {
                const next = !allowMembersEditInfo;
                setAllowMembersEditInfo(next);
                onUpdateSettings?.({ whoCanEditGroup: next ? "all" : "admin" });
              }}
              disabled={!onUpdateSettings}
            />

            <View style={styles.divider} />

            <ToggleRow
              title="Gửi tin nhắn"
              description={
                allowMembersChat
                  ? "Tất cả thành viên có thể nhắn tin trong nhóm"
                  : "Chỉ trưởng nhóm và phó nhóm mới được nhắn tin"
              }
              enabled={allowMembersChat}
              onToggle={() => {
                const next = !allowMembersChat;
                setAllowMembersChat(next);
                onUpdateSettings?.({
                  whoCanSendMessages: next ? "all" : "admin",
                });
              }}
              disabled={!onUpdateSettings}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
    maxHeight: "80%",
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(148,163,184,0.3)",
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.1)",
  },
  headerTitle: {
    color: "#f1f5f9",
    fontSize: 17,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(148,163,184,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
    gap: 10,
  },
  sectionLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(148,163,184,0.08)",
    marginVertical: 2,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.05)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    gap: 12,
  },
  toggleInfo: { flex: 1 },
  toggleTitle: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
  },
  toggleDesc: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.3)",
    justifyContent: "center",
    flexShrink: 0,
    paddingHorizontal: 4,
  },
  toggleTrackOn: {
    backgroundColor: "#2563eb",
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "white",
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: {
    alignSelf: "flex-end",
  },
});