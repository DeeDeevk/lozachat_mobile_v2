import { useFriendStore } from "@/stores/useFriendStore";
import type { Conversation, Message } from "@/types/chat";
import { decodeChatPayload } from "@/utils/chatMessageCodec";
import {
  Bell,
  ChevronDown,
  File,
  Link as LinkIcon,
  MessageSquare,
  Pin,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ArchiveModal from "./ArchiveModal";
import CreateGroupModal from "./CreateGroupModal";

const { width } = Dimensions.get("window");

interface ConversationInfoPanelProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation;
  messages: Message[];
  currentUserId?: string;
  onDeleteConversation?: () => Promise<void>;
  isPinned?: boolean; // Từ conversation.pinnedAt
  onTogglePin?: () => Promise<void>;
  onCreateGroup?: () => void;
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
export default function ConversationInfoPanel({
  visible,
  onClose,
  conversation,
  messages,
  currentUserId,
  onDeleteConversation,
  isPinned = false,
  onTogglePin,
  onCreateGroup,
}: ConversationInfoPanelProps) {
  const insets = useSafeAreaInsets();

  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    media: true,
    files: true,
    links: true,
  });
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const otherUser = useMemo(
    () => conversation.participants.find((p) => p._id !== currentUserId),
    [conversation.participants, currentUserId],
  );

  const { friends, getFriends } = useFriendStore();

  useEffect(() => {
    getFriends();
  }, []);

  const isStranger =
    !!otherUser && !friends.some((f) => f._id === otherUser._id);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // ─── DATA LOGIC ────────────────────────────────────────────────────────────
  const mediaFiles = useMemo(() => {
    const media: Array<{
      type: "image" | "audio";
      url: string;
      timestamp: string;
    }> = [];

    messages.forEach((msg) => {
      const payload = decodeChatPayload(msg.content);
      if (!payload) return;

      if (payload.kind === "image" && payload.attachment) {
        media.push({
          type: "image",
          url: payload.attachment.url,
          timestamp: msg.createdAt,
        });
      } else if (payload.kind === "audio" && payload.attachment) {
        media.push({
          type: "audio",
          url: payload.attachment.url,
          timestamp: msg.createdAt,
        });
      } else if (payload.kind === "file" && payload.attachment) {
        if (isImageFile(payload.attachment.name)) {
          media.push({
            type: "image",
            url: payload.attachment.url,
            timestamp: msg.createdAt,
          });
        }
      }

      // Xử lý gửi nhiều ảnh 1 lượt
      if (payload.kind === "image" && payload.attachments?.length) {
        payload.attachments.forEach((att: { url: string }) => {
          media.push({ type: "image", url: att.url, timestamp: msg.createdAt });
        });
      }
      if (payload.kind === "file" && payload.attachments?.length) {
        payload.attachments.forEach((att: { url: string; name: string }) => {
          if (isImageFile(att.name)) {
            media.push({
              type: "image",
              url: att.url,
              timestamp: msg.createdAt,
            });
          }
        });
      }
    });

    return media.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [messages]);

  const fileList = useMemo(() => {
    const files: Array<{
      url: string;
      name: string;
      timestamp: string;
    }> = [];

    messages.forEach((msg) => {
      const payload = decodeChatPayload(msg.content);
      if (!payload) return;

      if (payload.kind === "file" && payload.attachment) {
        if (!isImageFile(payload.attachment.name)) {
          files.push({
            url: payload.attachment.url,
            name: payload.attachment.name,
            timestamp: msg.createdAt,
          });
        }
      }

      // Xử lý file gửi nhiều bức 1 lượt
      if (payload.kind === "file" && payload.attachments?.length) {
        payload.attachments.forEach((att: { url: string; name: string }) => {
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
    const linkList: Array<{
      url: string;
      preview: string;
      timestamp: string;
    }> = [];

    messages.forEach((msg) => {
      const payload = decodeChatPayload(msg.content);
      if (!payload) return;

      if (payload.kind === "text" && payload.text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = payload.text.match(urlRegex);
        if (matches) {
          matches.forEach((url) => {
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
            <Text style={styles.headerTitle}>Thông tin</Text>
            <View style={{ width: 34 }} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          >
            {/* Profile Section */}
            <View style={styles.profileSection}>
              <View style={styles.bigAvatarContainer}>
                {otherUser?.avatarUrl ? (
                  <Image
                    source={{ uri: otherUser.avatarUrl }}
                    style={styles.bigAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.bigAvatar,
                      styles.avatarPlaceholder,
                      {
                        backgroundColor: getAvatarColor(
                          otherUser?.displayName || "U",
                        ),
                      },
                    ]}
                  >
                    <Text style={styles.avatarTxtLarge}>
                      {otherUser?.displayName?.[0]?.toUpperCase() || "U"}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.profileName}>
                {otherUser?.displayName || "Người dùng"}
              </Text>

              {/* Action Buttons - Ẩn khi là stranger */}
              {!isStranger && (
                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      isPinned && styles.actionBtnActive,
                    ]}
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

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setShowCreateGroupModal(true)}
                  >
                    <MessageSquare size={16} color="#94a3b8" />
                    <Text style={styles.actionBtnText}>Tạo nhóm</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

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
                  {mediaDisplay.map((media, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() =>
                        media.type === "image" && setSelectedImage(media.url)
                      }
                      activeOpacity={media.type === "image" ? 0.8 : 1}
                      style={styles.mediaThumb}
                    >
                      {media.type === "image" && (
                        <Image
                          source={{ uri: media.url }}
                          style={styles.mediaImage}
                          resizeMode="cover"
                        />
                      )}
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
              <TouchableOpacity
                style={styles.dangerBtn}
                onPress={onDeleteConversation}
                disabled={isDeleting}
              >
                <Trash2 size={18} color="#ef4444" />
                <Text style={styles.dangerBtnText}>Xóa lịch sử trò chuyện</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Image Preview Modal (Thừa kế từ Group) */}
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
      </Modal>

      {/* Archive Modal */}
      <ArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        mediaFiles={mediaFiles}
        fileList={fileList}
        links={links}
      />

      {/* Create Group Modal */}
      {otherUser && (
        <CreateGroupModal
          isOpen={showCreateGroupModal}
          onClose={() => setShowCreateGroupModal(false)}
          initialMembers={[otherUser]}
          onGroupCreated={onCreateGroup}
        />
      )}
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

  // Action Buttons
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

  // Image Preview
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: { width: "90%", height: "70%" },
});
