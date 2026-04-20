import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Modal,
  Image,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronDown,
  File,
  Link as LinkIcon,
  X,
  Search,
  Pin,
  Bell,
  Settings,
  Edit,
  LogOut,
  Trash2,
  UserPlus,
  UserCheck,
  UserX,
} from "lucide-react-native";
import type { Conversation, Message, Participant } from "@/types/chat";
import { decodeChatPayload } from "@/utils/chatMessageCodec";
import EditGroupMobileModal from "./EditGroupModal";

const { width } = Dimensions.get("window");

interface GroupConversationInfoPanelProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation;
  messages: Message[];
  currentUserId?: string;
  onUpdateMemberRole?: (targetUserId: string, role: "admin" | "member") => void;
  onRemoveMember?: (targetUserId: string) => void;
  // Các props mới đồng bộ từ web
  onLeaveGroup?: () => void;
  onDissolveGroup?: () => void;
  onDeleteConversation?: () => void;
  pendingRequests?: any[];
  onReviewRequest?: (
    requestId: string,
    action: "approved" | "rejected",
  ) => Promise<void>;
  onUpdateSettings?: (settings: {
    requireApprovalToJoin: boolean;
  }) => Promise<void>;
  isAdminOrOwnerProps?: boolean;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];

function isImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.includes(ext);
}

function getAvatarColor(name: string = "Unknown") {
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
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const Section = ({ title, count, isOpen, onToggle, children }: any) => (
  <View style={styles.sectionWrap}>
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Text style={styles.sectionTitle}>
        {title} {count !== undefined ? `(${count})` : ""}
      </Text>
      <ChevronDown
        size={20}
        color="#94a3b8"
        style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
      />
    </TouchableOpacity>
    {isOpen && <View style={styles.sectionContent}>{children}</View>}
  </View>
);

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function GroupConversationInfoPanel({
  visible,
  onClose,
  conversation,
  messages,
  currentUserId,
  onUpdateMemberRole,
  onRemoveMember,
  onLeaveGroup,
  onDissolveGroup,
  onDeleteConversation,
  pendingRequests = [],
  onReviewRequest,
  onUpdateSettings,
}: GroupConversationInfoPanelProps) {
  const insets = useSafeAreaInsets();
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    media: true,
    files: false,
    members: true,
    links: false,
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [searchMember, setSearchMember] = useState("");
  const [selectedMember, setSelectedMember] = useState<Participant | null>(
    null,
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [processingIds, setProcessingIds] = useState<string[]>([]);
  const [requireApproval, setRequireApproval] = useState(
    conversation.group?.settings?.requireApprovalToJoin || false,
  );

  const currentParticipant = useMemo(
    () => conversation.participants.find((p) => p._id === currentUserId),
    [conversation.participants, currentUserId],
  );

  const isOwner = currentParticipant?.role === "owner";
  const isAdminOrOwner = isOwner || currentParticipant?.role === "admin";

  useEffect(() => {
    setRequireApproval(
      conversation.group?.settings?.requireApprovalToJoin || false,
    );
  }, [conversation.group?.settings?.requireApprovalToJoin]);

  const handleLongPressMember = (member: Participant) => {
    if (!isAdminOrOwner) return;
    if (member._id === currentUserId) return;
    if (member.role === "owner") return;

    setSelectedMember(member);
  };

  const handleUpdateRole = async (targetId, role) => {
    if (isUpdating) return; // Nếu đang chạy thì chặn
    setIsUpdating(true);
    try {
      await onUpdateMemberRole?.(targetId, role);
      setSelectedMember(null);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReview = async (id: string, action: "approved" | "rejected") => {
    if (processingIds.includes(id)) return;

    setProcessingIds((prev) => [...prev, id]);

    try {
      await onReviewRequest?.(id, action);
    } catch (err) {
      Alert.alert("Lỗi", "Không thể xử lý yêu cầu");
    } finally {
      setProcessingIds((prev) => prev.filter((x) => x !== id));
    }
  };

  // ─── DATA LOGIC ────────────────────────────────────────────────────────────
  const mediaFiles = useMemo(() => {
    const media: any[] = [];

    messages.forEach((msg) => {
      const payload = decodeChatPayload(msg.content);
      if (!payload) return;

      const kind = payload.kind?.toLowerCase(); // ✅ normalize

      const sender = conversation.participants.find(
        (p) => p._id === msg.senderId,
      );

      const pushImage = (url: string) => {
        if (!url) return;
        media.push({
          type: "image",
          url,
          timestamp: msg.createdAt,
          senderName: sender?.displayName,
        });
      };

      // ✅ single image
      if (kind === "image" && payload.attachment?.url) {
        pushImage(payload.attachment.url);
      }

      // ✅ file nhưng là ảnh
      if (kind === "file" && payload.attachment) {
        if (isImageFile(payload.attachment.name)) {
          pushImage(payload.attachment.url);
        }
      }

      // ✅ multiple attachments
      if (payload.attachments?.length) {
        payload.attachments.forEach((att: any) => {
          if (isImageFile(att.name)) {
            pushImage(att.url);
          }
        });
      }

      // ✅ fallback nếu BE khác format
      if ((msg as any).attachments?.length) {
        (msg as any).attachments.forEach((att: any) => {
          if (isImageFile(att.name)) {
            pushImage(att.url);
          }
        });
      }
    });

    return media.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [messages, conversation.participants]);

  const filteredMembers = useMemo(() => {
    return (conversation.participants || []).filter((p) =>
      p.displayName.toLowerCase().includes(searchMember.toLowerCase()),
    );
  }, [conversation.participants, searchMember]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const uniquePendingRequests = useMemo(() => {
    if (!pendingRequests || !Array.isArray(pendingRequests)) return [];

    const map = new Map();
    pendingRequests.forEach((req) => {
      if (req) {
        // Quan trọng: Phải lấy ID của người được mời để làm key
        const uId =
          typeof req.invitedUserId === "object"
            ? req.invitedUserId._id
            : req.invitedUserId;

        if (uId) map.set(uId, req);
      }
    });
    return Array.from(map.values());
  }, [pendingRequests]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: "#0f172a" }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <X size={26} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông tin nhóm</Text>
          <TouchableOpacity
            onPress={() => setShowEditModal(true)}
            style={styles.headerBtn}
          >
            <Edit size={20} color="white" />
          </TouchableOpacity>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {/* Profile Section */}
          <View style={styles.profileSection}>
            <View style={styles.bigAvatarContainer}>
              {conversation.group?.avatar ? (
                <Image
                  source={{ uri: conversation.group.avatar }}
                  style={styles.bigAvatar}
                />
              ) : (
                <View style={[styles.bigAvatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarTxtLarge}>
                    {conversation.group?.name?.substring(0, 1).toUpperCase() ||
                      "G"}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.profileName}>
              {conversation.group?.name || "Nhóm chat"}
            </Text>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.actionBtn}>
                <View style={styles.actionIconCircle}>
                  <Pin size={20} color="#94a3b8" />
                </View>
                <Text style={styles.actionLabel}>Ghim</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <View style={styles.actionIconCircle}>
                  <Bell size={20} color="#94a3b8" />
                </View>
                <Text style={styles.actionLabel}>Thông báo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn}>
                <View style={styles.actionIconCircle}>
                  <Settings size={20} color="#94a3b8" />
                </View>
                <Text style={styles.actionLabel}>Quản lý</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pending Requests */}
          {/* Pending Requests - Chỉ hiện cho Admin/Owner */}
          {isAdminOrOwner && uniquePendingRequests.length > 0 && (
            <View
              style={[
                styles.sectionWrap,
                { backgroundColor: "rgba(59,130,246,0.05)" },
              ]}
            >
              <Section
                title="Chờ duyệt"
                count={uniquePendingRequests.length}
                isOpen={true} // Nên để mặc định mở để Admin dễ thấy
                onToggle={() => {}}
              >
                {uniquePendingRequests.map((req) => (
                  <View key={req._id} style={styles.requestCard}>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName}>
                        {req.invitedUserId?.displayName || "Người dùng mới"}
                      </Text>
                      <Text style={styles.requestSub}>
                        mời bởi {req.invitedBy?.displayName || "Admin"}
                      </Text>
                    </View>

                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        onPress={() => handleReview(req._id, "approved")}
                        style={[
                          styles.approveBtn,
                          {
                            backgroundColor: "rgba(16,185,129,0.1)",
                            padding: 8,
                            borderRadius: 8,
                          },
                        ]}
                        disabled={processingIds.includes(req._id)}
                      >
                        {processingIds.includes(req._id) ? (
                          <ActivityIndicator size="small" color="#10b981" />
                        ) : (
                          <UserCheck size={20} color="#10b981" />
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleReview(req._id, "rejected")}
                        style={[
                          styles.rejectBtn,
                          {
                            backgroundColor: "rgba(239,68,68,0.1)",
                            padding: 8,
                            borderRadius: 8,
                          },
                        ]}
                        disabled={processingIds.includes(req._id)}
                      >
                        <UserX size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </Section>
            </View>
          )}

          {/* Members Section */}
          <Section
            title="Thành viên"
            count={conversation.participants.length}
            isOpen={expandedSections.members}
            onToggle={() => toggleSection("members")}
          >
            <View style={styles.searchWrapper}>
              <Search size={16} color="#94a3b8" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm thành viên..."
                placeholderTextColor="#64748b"
                value={searchMember}
                onChangeText={setSearchMember}
              />
            </View>
            {filteredMembers.map((member) => (
              <TouchableOpacity
                key={member._id}
                style={styles.memberItem}
                onLongPress={() => handleLongPressMember(member)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.miniAvatar,
                    {
                      backgroundColor: member.avatarUrl
                        ? "transparent"
                        : getAvatarColor(member.displayName),
                    },
                  ]}
                >
                  {member.avatarUrl ? (
                    <Image
                      source={{ uri: member.avatarUrl }}
                      style={styles.miniAvatarImg}
                    />
                  ) : (
                    <Text style={styles.avatarTxt}>
                      {member.displayName?.[0]?.toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {member.displayName}{" "}
                    {member._id === currentUserId && (
                      <Text style={styles.meTag}>(Bạn)</Text>
                    )}
                  </Text>
                  {member.role !== "member" && (
                    <View
                      style={[
                        styles.roleBadge,
                        member.role === "owner"
                          ? styles.ownerBadge
                          : styles.adminBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.roleText,
                          member.role === "owner"
                            ? styles.ownerText
                            : styles.adminText,
                        ]}
                      >
                        {member.role === "owner" ? "Trưởng nhóm" : "Phó nhóm"}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </Section>

          {/* Media Section */}
          <Section
            title="Ảnh/Video"
            isOpen={expandedSections.media}
            onToggle={() => toggleSection("media")}
          >
            <View style={styles.mediaGrid}>
              {mediaFiles.slice(0, 9).map((item, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSelectedImage(item.url)}
                  activeOpacity={0.8}
                  style={styles.mediaThumb}
                >
                  <Image
                    source={{ uri: item.url }}
                    style={styles.mediaImage}
                    resizeMode="cover"
                    onError={() => console.log("IMG FAIL:", item.url)} // ✅ debug
                  />
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {/* Group Settings */}
          {isAdminOrOwner && (
            <View style={styles.settingsArea}>
              <Text style={styles.settingsHeader}>Cài đặt nhóm</Text>
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Chế độ phê duyệt</Text>
                  <Text style={styles.settingSubLabel}>
                    Duyệt thành viên mới vào nhóm
                  </Text>
                </View>
                <Switch
                  value={requireApproval}
                  onValueChange={async (val) => {
                    setRequireApproval(val); // Cập nhật UI ngay lập tức
                    try {
                      await onUpdateSettings?.({ requireApprovalToJoin: val });
                    } catch (err) {
                      setRequireApproval(!val); // Rollback nếu lỗi
                      Alert.alert("Lỗi", "Không thể cập nhật cài đặt");
                    }
                  }}
                  trackColor={{ false: "#1e293b", true: "#2563eb" }}
                />
              </View>
            </View>
          )}

          {/* Danger Zone */}
          <View style={styles.dangerZone}>
            <TouchableOpacity style={styles.dangerBtn} onPress={onLeaveGroup}>
              <LogOut size={18} color="#ef4444" />
              <Text style={styles.dangerBtnText}>Rời khỏi nhóm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={onDeleteConversation}
            >
              <Trash2 size={18} color="#ef4444" />
              <Text style={styles.dangerBtnText}>Xóa lịch sử trò chuyện</Text>
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity
                style={[styles.dangerBtn, styles.dissolveBtn]}
                onPress={onDissolveGroup}
              >
                <Trash2 size={18} color="#ef4444" />
                <Text style={styles.dangerBtnText}>Giải tán nhóm</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
      {selectedImage && (
        <Modal transparent animationType="fade">
          <TouchableOpacity
            style={styles.previewOverlay}
            onPress={() => setSelectedImage(null)}
            activeOpacity={1}
          >
            <Image
              source={{ uri: selectedImage }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          </TouchableOpacity>
        </Modal>
      )}
      {selectedMember && (
        <Modal transparent animationType="fade">
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
            onPress={() => setSelectedMember(null)}
            activeOpacity={1}
          >
            <View
              style={{
                backgroundColor: "#1e293b",
                padding: 16,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontSize: 16,
                  fontWeight: "600",
                  marginBottom: 16,
                }}
              >
                {selectedMember.displayName}
              </Text>

              {/* OWNER: thêm / gỡ admin */}
              {isOwner && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const newRole =
                      selectedMember.role === "admin" ? "member" : "admin";
                    // Chỉ gọi nếu khác với role hiện tại của member đó
                    if (selectedMember.role !== newRole) {
                      onUpdateMemberRole?.(selectedMember._id, newRole);
                    }
                    setSelectedMember(null);
                  }}
                >
                  <Text style={styles.menuText}>
                    {selectedMember.role === "admin"
                      ? "Gỡ quyền phó nhóm"
                      : "Thêm làm phó nhóm"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* ADMIN hoặc OWNER: xóa member */}
              {(isOwner ||
                (currentParticipant?.role === "admin" &&
                  selectedMember.role === "member")) && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    const memberToDelete = selectedMember; // Lưu lại ref trước khi đóng modal
                    setSelectedMember(null); // Đóng modal chọn lựa

                    Alert.alert(
                      "Xác nhận",
                      `Xóa ${memberToDelete.displayName} khỏi nhóm?`,
                      [
                        { text: "Hủy", style: "cancel" },
                        {
                          text: "Xóa",
                          style: "destructive",
                          onPress: async () => {
                            // ✅ Gọi prop được truyền từ [id].tsx
                            if (onRemoveMember) {
                              await onRemoveMember(memberToDelete._id);
                            }
                          },
                        },
                      ],
                    );
                  }}
                >
                  <Text style={[styles.menuText, { color: "#ef4444" }]}>
                    Xóa khỏi nhóm
                  </Text>
                </TouchableOpacity>
              )}

              {/* Cancel */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setSelectedMember(null)}
              >
                <Text style={[styles.menuText, { color: "#94a3b8" }]}>Hủy</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
      <EditGroupMobileModal
        visible={showEditModal}
        conversation={conversation}
        onClose={() => setShowEditModal(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },

  menuText: {
    color: "white",
    fontSize: 15,
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  mediaThumb: {
    width: (width - 48) / 3,
    height: (width - 48) / 3,
    borderRadius: 12,
    overflow: "hidden", // ✅ quan trọng
    backgroundColor: "#1e293b",
  },

  mediaImage: {
    width: "100%",
    height: "100%",
  },

  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },

  previewImage: {
    width: "90%",
    height: "70%",
  },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  headerTitle: { color: "white", fontSize: 18, fontWeight: "700" },
  headerBtn: { padding: 4 },
  profileSection: {
    alignItems: "center",
    paddingVertical: 30,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  bigAvatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: "rgba(59,130,246,0.3)",
    overflow: "hidden",
    marginBottom: 15,
  },
  bigAvatar: { width: "100%", height: "100%" },
  avatarPlaceholder: {
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarTxtLarge: { color: "white", fontSize: 32, fontWeight: "800" },
  profileName: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 30,
    marginTop: 25,
  },
  actionBtn: { alignItems: "center", gap: 8 },
  actionIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(148,163,184,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: { color: "#94a3b8", fontSize: 11 },
  sectionWrap: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
    alignItems: "center",
  },
  sectionTitle: { color: "#cbd5e1", fontSize: 16, fontWeight: "600" },
  sectionContent: { paddingHorizontal: 16, paddingBottom: 20 },
  searchWrapper: { position: "relative", marginBottom: 15 },
  searchIcon: { position: "absolute", left: 12, top: 14, zIndex: 1 },
  searchInput: {
    backgroundColor: "#1e293b",
    borderRadius: 10,
    padding: 12,
    paddingLeft: 40,
    color: "white",
    fontSize: 15,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 14,
  },
  miniAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  miniAvatarImg: { width: "100%", height: "100%" },
  avatarTxt: { color: "white", fontWeight: "bold", fontSize: 16 },
  memberInfo: { flex: 1 },
  memberName: { color: "#f1f5f9", fontSize: 15, fontWeight: "600" },
  meTag: { color: "#64748b", fontSize: 13, fontWeight: "400" },
  roleBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  ownerBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderColor: "rgba(234, 179, 8, 0.4)",
  },
  adminBadge: {
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    borderColor: "rgba(148, 163, 184, 0.4)",
  },
  roleText: { fontSize: 10, fontWeight: "700" },
  ownerText: { color: "#facc15" },
  adminText: { color: "#94a3b8" },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mediaThumb: { width: (width - 48) / 3, aspectRatio: 1, borderRadius: 12 },
  settingsArea: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  settingsHeader: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 15,
  },
  settingRow: { flexDirection: "row", alignItems: "center" },
  settingLabel: { color: "#f1f5f9", fontSize: 14 },
  settingSubLabel: { color: "#64748b", fontSize: 11, marginTop: 2 },
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.6)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  requestInfo: { flex: 1 },
  requestName: { color: "white", fontSize: 14, fontWeight: "600" },
  requestSub: { color: "#64748b", fontSize: 11 },
  requestActions: { flexDirection: "row", gap: 12 },
  dangerZone: { padding: 16, gap: 12 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(248,113,113,0.08)",
  },
  dangerBtnText: { color: "#f87171", fontWeight: "600", fontSize: 14 },
  dissolveBtn: { backgroundColor: "rgba(239,68,68,0.15)", marginTop: 5 },
});
