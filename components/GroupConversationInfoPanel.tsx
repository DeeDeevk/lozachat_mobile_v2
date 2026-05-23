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
  Pressable,
  Dimensions,
  Alert,
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
  UserCheck,
  UserX,
  MessageSquare,
} from "lucide-react-native";
import type { Conversation, Message, Participant } from "@/types/chat";
import { decodeChatPayload } from "@/utils/chatMessageCodec";
import EditGroupMobileModal from "./EditGroupModal";
import ArchiveModal from "./ArchiveModal";
import ManageGroupModal from "./ManageGroupModal";

const { width } = Dimensions.get("window");

interface GroupConversationInfoPanelProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation;
  messages: Message[];
  currentUserId?: string;
  onUpdateMemberRole?: (targetUserId: string, role: "admin" | "member") => void;
  onRemoveMember?: (targetUserId: string) => void;
  onLeaveGroup?: () => void;
  onDissolveGroup?: () => void;
  onDeleteConversation?: () => void;
  pendingRequests?: any[];
  onReviewRequest?: (
    requestId: string,
    action: "approved" | "rejected",
  ) => Promise<void>;
  onUpdateSettings?: (settings: {
    requireApprovalToJoin?: boolean;
    whoCanEditGroup?: "all" | "admin";
    whoCanSendMessages?: "all" | "admin";
  }) => Promise<void>;
  isAdminOrOwnerProps?: boolean;
  // Pin support
  isPinned?: boolean;
  onTogglePin?: () => Promise<void>;
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

const Section = ({
  title,
  count,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  count?: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <View style={styles.sectionWrap}>
    <Pressable style={styles.sectionHeader} onPress={onToggle}>
      <Text style={styles.sectionTitle}>
        {title} {count !== undefined ? `(${count})` : ""}
      </Text>
      <View
        style={{
          transform: isOpen ? [{ rotate: "180deg" }] : [],
        }}
      >
        <ChevronDown size={18} color="#94a3b8" />
      </View>
    </Pressable>
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
  isPinned = false,
  onTogglePin,
}: GroupConversationInfoPanelProps) {
  const insets = useSafeAreaInsets();

  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    media: true,
    files: true,
    links: true,
    members: true,
  });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [searchMember, setSearchMember] = useState("");
  const [selectedMember, setSelectedMember] = useState<Participant | null>(
    null,
  );
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [processingIds, setProcessingIds] = useState<string[]>([]);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  const currentParticipant = useMemo(
    () => conversation.participants.find((p) => p._id === currentUserId),
    [conversation.participants, currentUserId],
  );

  const isOwner = currentParticipant?.role === "owner";
  const isAdminOrOwner = isOwner || currentParticipant?.role === "admin";
  const [isManageGroupOpen, setIsManageGroupOpen] = useState(false);
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleLongPressMember = (member: Participant) => {
    if (!isAdminOrOwner) return;
    if (member._id === currentUserId) return;
    if (member.role === "owner") return;
    setSelectedMember(member);
  };

  const handleUpdateRole = async (
    targetId: string,
    role: "admin" | "member",
  ) => {
    if (isUpdating) return;
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
    const media: Array<{
      type: "image" | "audio";
      url: string;
      timestamp: string;
      senderName?: string;
    }> = [];

    messages.forEach((msg) => {
      const payload = decodeChatPayload(msg.content);
      if (!payload) return;
      const kind = payload.kind?.toLowerCase();
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

      if (kind === "image" && payload.attachment?.url) {
        pushImage(payload.attachment.url);
      }
      if (kind === "file" && payload.attachment) {
        if (isImageFile(payload.attachment.name)) {
          pushImage(payload.attachment.url);
        }
      }
      if (payload.attachments?.length) {
        payload.attachments.forEach((att: any) => {
          if (isImageFile(att.name)) pushImage(att.url);
        });
      }
      if ((msg as any).attachments?.length) {
        (msg as any).attachments.forEach((att: any) => {
          if (isImageFile(att.name)) pushImage(att.url);
        });
      }
    });

    return media.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [messages, conversation.participants]);

  const fileList = useMemo(() => {
    const files: Array<{ url: string; name: string; timestamp: string }> = [];

    messages.forEach((msg) => {
      const payload = decodeChatPayload(msg.content);
      if (!payload) return;
      const kind = payload.kind?.toLowerCase();

      if (kind === "file" && payload.attachment) {
        if (!isImageFile(payload.attachment.name)) {
          files.push({
            url: payload.attachment.url,
            name: payload.attachment.name,
            timestamp: msg.createdAt,
          });
        }
      }
      if (payload.attachments?.length) {
        payload.attachments.forEach((att: any) => {
          if (!isImageFile(att.name)) {
            files.push({
              url: att.url,
              name: att.name,
              timestamp: msg.createdAt,
            });
          }
        });
      }
    });

    return files.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [messages]);

  const links = useMemo(() => {
    const linkList: Array<{ url: string; preview: string; timestamp: string }> =
      [];

    messages.forEach((msg) => {
      const payload = decodeChatPayload(msg.content);
      if (!payload) return;

      if (payload.kind === "text" && payload.text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = payload.text.match(urlRegex);
        if (matches) {
          matches.forEach((url: string) => {
            linkList.push({
              url,
              preview: url.length > 40 ? url.substring(0, 40) + "..." : url,
              timestamp: msg.createdAt,
            });
          });
        }
      }
    });

    return linkList.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [messages]);

  const mediaDisplay = mediaFiles.slice(0, 6);
  const fileDisplay = fileList.slice(0, 3);
  const linkDisplay = links.slice(0, 3);

  const filteredMembers = useMemo(() => {
    return (conversation.participants || []).filter((p) =>
      p.displayName.toLowerCase().includes(searchMember.toLowerCase()),
    );
  }, [conversation.participants, searchMember]);

  const uniquePendingRequests = useMemo(() => {
    if (!pendingRequests || !Array.isArray(pendingRequests)) return [];
    const map = new Map();
    pendingRequests.forEach((req) => {
      if (req) {
        const uId =
          typeof req.invitedUserId === "object"
            ? req.invitedUserId._id
            : req.invitedUserId;
        if (uId) map.set(uId, req);
      }
    });
    return Array.from(map.values());
  }, [pendingRequests]);

  const hasAnyMedia =
    mediaFiles.length > 0 || fileList.length > 0 || links.length > 0;

  return (
    <>
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
                      {conversation.group?.name
                        ?.substring(0, 1)
                        .toUpperCase() || "G"}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.profileName}>
                {conversation.group?.name || "Nhóm chat"}
              </Text>

              {/* Action Buttons — đồng bộ với ConversationInfoPanel */}
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={[styles.actionBtn, isPinned && styles.actionBtnActive]}
                  onPress={onTogglePin}
                >
                  <Pin
                    size={16}
                    color={isPinned ? "#f59e0b" : "#94a3b8"}
                    fill={isPinned ? "#f59e0b" : "none"}
                  />
                  <Text
                    style={[
                      styles.actionBtnText,
                      isPinned && styles.actionBtnTextActive,
                    ]}
                  >
                    {isPinned ? "Bỏ ghim" : "Ghim"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn}>
                  <Bell size={16} color="#94a3b8" />
                  <Text style={styles.actionBtnText}>Tắt thông báo</Text>
                </TouchableOpacity>

                {isAdminOrOwner && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setIsManageGroupOpen(true)}
                  >
                    <Settings size={16} color="#94a3b8" />
                    <Text style={styles.actionBtnText}>Quản lý</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Pending Requests — chỉ hiện cho Admin/Owner */}
            {isAdminOrOwner && uniquePendingRequests.length > 0 && (
              <Section
                title="Chờ duyệt"
                count={uniquePendingRequests.length}
                isOpen={true}
                onToggle={() => {}}
              >
                {uniquePendingRequests.map((req) => (
                  <View key={req._id} style={styles.requestCard}>
                    <View style={styles.requestAvatar}>
                      <Text style={styles.avatarTxt}>
                        {(req.invitedUserId?.displayName ||
                          "N")[0].toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName} numberOfLines={1}>
                        {req.invitedUserId?.displayName || "Người dùng mới"}
                      </Text>
                      <Text style={styles.requestSub} numberOfLines={1}>
                        mời bởi {req.invitedBy?.displayName || "Admin"}
                      </Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        onPress={() => handleReview(req._id, "approved")}
                        style={[styles.actionIconButton, styles.approveBlueBg]}
                        disabled={processingIds.includes(req._id)}
                      >
                        {processingIds.includes(req._id) ? (
                          <ActivityIndicator size="small" color="#3b82f6" />
                        ) : (
                          <UserCheck size={18} color="#60a5fa" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleReview(req._id, "rejected")}
                        style={[styles.actionIconButton, styles.rejectAmberBg]}
                        disabled={processingIds.includes(req._id)}
                      >
                        <UserX size={18} color="#fbbf24" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </Section>
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
              {mediaFiles.length === 0 ? (
                <Text style={styles.emptyText}>
                  Chưa có Ảnh/Video được chia sẻ
                </Text>
              ) : (
                <View style={styles.mediaGrid}>
                  {mediaDisplay.map((item, i) => (
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
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </Section>

            {/* Files Section */}
            <Section
              title="File"
              isOpen={expandedSections.files}
              onToggle={() => toggleSection("files")}
            >
              {fileList.length === 0 ? (
                <Text style={styles.emptyText}>Chưa có File được chia sẻ</Text>
              ) : (
                <>
                  {fileDisplay.map((file, idx) => (
                    <View key={idx} style={styles.fileItem}>
                      <File size={14} color="#8b5cf6" />
                      <Text style={styles.fileText} numberOfLines={1}>
                        {file.name}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </Section>

            {/* Links Section */}
            <Section
              title="Link"
              isOpen={expandedSections.links}
              onToggle={() => toggleSection("links")}
            >
              {links.length === 0 ? (
                <Text style={styles.emptyText}>Chưa có Link được chia sẻ</Text>
              ) : (
                <>
                  {linkDisplay.map((link, idx) => (
                    <View key={idx} style={styles.linkItem}>
                      <LinkIcon size={14} color="#f59e0b" />
                      <Text style={styles.linkText} numberOfLines={1}>
                        {link.preview}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </Section>

            {/* View All Button */}
            {hasAnyMedia && (
              <TouchableOpacity
                style={styles.viewAllBtn}
                onPress={() => setIsArchiveOpen(true)}
              >
                <Text style={styles.viewAllBtnText}>Xem tất cả</Text>
              </TouchableOpacity>
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

        {/* Image Preview Modal */}
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

        {/* Member Action Sheet */}
        {selectedMember && (
          <Modal transparent animationType="fade">
            <TouchableOpacity
              style={styles.sheetOverlay}
              onPress={() => setSelectedMember(null)}
              activeOpacity={1}
            >
              <View style={styles.sheetContainer}>
                <Text style={styles.sheetTitle}>
                  {selectedMember.displayName}
                </Text>

                {isOwner && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      const newRole =
                        selectedMember.role === "admin" ? "member" : "admin";
                      handleUpdateRole(selectedMember._id, newRole);
                    }}
                    disabled={isUpdating}
                  >
                    <Text style={styles.menuText}>
                      {selectedMember.role === "admin"
                        ? "Gỡ quyền phó nhóm"
                        : "Thêm làm phó nhóm"}
                    </Text>
                  </TouchableOpacity>
                )}

                {(isOwner ||
                  (currentParticipant?.role === "admin" &&
                    selectedMember.role === "member")) && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      const memberToDelete = selectedMember;
                      setSelectedMember(null);
                      Alert.alert(
                        "Xác nhận",
                        `Xóa ${memberToDelete.displayName} khỏi nhóm?`,
                        [
                          { text: "Hủy", style: "cancel" },
                          {
                            text: "Xóa",
                            style: "destructive",
                            onPress: async () => {
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

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => setSelectedMember(null)}
                >
                  <Text style={[styles.menuText, { color: "#94a3b8" }]}>
                    Hủy
                  </Text>
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
      {/* Archive Modal — nằm ngoài Modal chính để tránh z-index issues */}
      <ArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        mediaFiles={mediaFiles}
        fileList={fileList}
        links={links}
      />
      <ManageGroupModal
        isOpen={isManageGroupOpen}
        onClose={() => setIsManageGroupOpen(false)}
        settings={conversation.group?.settings}
        onUpdateSettings={onUpdateSettings}
      />
    </>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
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

  // Profile
  profileSection: {
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.15)",
    gap: 12,
  },
  bigAvatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "rgba(59,130,246,0.3)",
    overflow: "hidden",
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
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 20,
  },

  // Action Buttons — đồng bộ với ConversationInfoPanel
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    backgroundColor: "rgba(148,163,184,0.05)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionBtnActive: {
    borderColor: "rgba(245,158,11,0.4)",
    backgroundColor: "rgba(245,158,11,0.12)",
  },
  actionBtnText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600",
  },
  actionBtnTextActive: {
    color: "#f59e0b",
  },

  // Sections
  sectionWrap: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.15)",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  sectionTitle: { color: "#f1f5f9", fontSize: 14, fontWeight: "600" },
  sectionContent: { paddingHorizontal: 16, paddingBottom: 16 },
  emptyText: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 12,
  },

  // Media Grid
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mediaThumb: {
    width: (width - 48) / 3,
    height: (width - 48) / 3,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#1e293b",
  },
  mediaImage: { width: "100%", height: "100%" },

  // Files
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "rgba(148,163,184,0.08)",
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  fileText: { color: "#2563eb", fontSize: 12, flex: 1 },

  // Links
  linkItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "rgba(148,163,184,0.08)",
    borderRadius: 8,
    marginBottom: 8,
    gap: 8,
  },
  linkText: { color: "#2563eb", fontSize: 12, flex: 1 },

  // View All
  viewAllBtn: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(37,99,235,0.3)",
    backgroundColor: "rgba(37,99,235,0.08)",
  },
  viewAllBtnText: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  // Members
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
    backgroundColor: "rgba(234,179,8,0.12)",
    borderColor: "rgba(234,179,8,0.4)",
  },
  adminBadge: {
    backgroundColor: "rgba(148,163,184,0.12)",
    borderColor: "rgba(148,163,184,0.4)",
  },
  roleText: { fontSize: 10, fontWeight: "700" },
  ownerText: { color: "#facc15" },
  adminText: { color: "#94a3b8" },

  // Pending Requests
  requestCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.1)",
  },
  requestAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  requestInfo: { flex: 1, marginRight: 8 },
  requestName: { color: "#f1f5f9", fontSize: 14, fontWeight: "600" },
  requestSub: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  requestActions: { flexDirection: "row", gap: 8 },
  actionIconButton: {
    padding: 10,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 40,
  },
  approveBlueBg: {
    backgroundColor: "rgba(59,130,246,0.15)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.3)",
  },
  rejectAmberBg: {
    backgroundColor: "rgba(251,191,36,0.12)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.25)",
  },

  // Group Settings
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

  // Danger Zone
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

  // Image Preview
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: { width: "90%", height: "70%" },

  // Member Action Sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#1e293b",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheetTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  menuItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  menuText: { color: "white", fontSize: 15 },
});
