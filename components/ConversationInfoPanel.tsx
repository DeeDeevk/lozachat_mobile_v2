import type { Conversation, Message } from "@/types/chat";
import { decodeChatPayload } from "@/utils/chatMessageCodec";
import {
  ChevronDown,
  File,
  Link as LinkIcon,
  X,
  Trash2,
  Pin,
  Bell,
  MessageSquare,
} from "lucide-react-native";
import React, { useMemo, useState, useEffect } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import ArchiveModal from "./ArchiveModal";
import CreateGroupModal from "./CreateGroupModal";
import { useFriendStore } from "@/stores/useFriendStore";

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

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];

function isImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.includes(ext);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  panel: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    backgroundColor: "#0f172a",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(148,163,184,0.15)",
  },
  panelContent: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.15)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: "600",
  },
  closeBtn: {
    padding: 8,
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.15)",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "white",
    fontSize: 32,
    fontWeight: "700",
  },
  profileName: {
    color: "#f1f5f9",
    fontSize: 16,
    fontWeight: "700",
  },
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    paddingHorizontal: 16,
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.15)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionHeaderText: {
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: "600",
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 12,
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mediaItem: {
    width: "31%",
    aspectRatio: 1,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    overflow: "hidden",
  },
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
  fileText: {
    color: "#2563eb",
    fontSize: 12,
    flex: 1,
  },
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
  linkText: {
    color: "#2563eb",
    fontSize: 12,
    flex: 1,
  },
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
  dangerZone: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.15)",
    marginTop: 12,
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderRadius: 8,
    marginBottom: 10,
    gap: 10,
  },
  dangerBtnText: {
    color: "#ef4444",
    fontSize: 14,
    fontWeight: "600",
  },
});

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

      // ✅ Xử lý gửi nhiều ảnh 1 lượt (attachments array)
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

      // ✅ Xử lý file gửi nhiều bức 1 lượt (attachments array)
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

  return (
    <>
      <Modal visible={visible} transparent animationType="fade">
        <Pressable style={styles.container} onPress={onClose}>
          <Pressable style={styles.panel} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Thông tin</Text>
              <Pressable style={styles.closeBtn} onPress={onClose}>
                <X size={20} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.panelContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Profile Section */}
              <View style={styles.profileSection}>
                <View style={styles.avatar}>
                  {otherUser?.avatarUrl ? (
                    <Image
                      source={{ uri: otherUser.avatarUrl }}
                      style={{ width: 80, height: 80, borderRadius: 40 }}
                    />
                  ) : (
                    <Text style={styles.avatarText}>
                      {otherUser?.displayName?.[0]?.toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.profileName}>
                  {otherUser?.displayName || "Người dùng"}
                </Text>

                {/* Action Buttons - chỉ hiển thị khi không phải stranger */}
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
              <View>
                <Pressable
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("media")}
                >
                  <Text style={styles.sectionHeaderText}>Ảnh/Video</Text>
                  <View
                    style={{
                      transform: expandedSections.media
                        ? [{ rotate: "180deg" }]
                        : [],
                    }}
                  >
                    <ChevronDown size={18} color="#94a3b8" />
                  </View>
                </Pressable>
                {expandedSections.media && (
                  <View style={styles.sectionContent}>
                    {mediaFiles.length === 0 ? (
                      <Text style={styles.emptyText}>
                        Chưa có Ảnh/Video được chia sẻ
                      </Text>
                    ) : (
                      <>
                        <View style={styles.mediaGrid}>
                          {mediaDisplay.map((media, idx) => (
                            <View key={idx} style={styles.mediaItem}>
                              {media.type === "image" && (
                                <Image
                                  source={{ uri: media.url }}
                                  style={{ width: "100%", height: "100%" }}
                                  resizeMode="cover"
                                />
                              )}
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                )}
              </View>

              {/* Files Section */}
              <View>
                <Pressable
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("files")}
                >
                  <Text style={styles.sectionHeaderText}>File</Text>
                  {/* FIX: was expandedSections.media, should be expandedSections.files */}
                  <View
                    style={{
                      transform: expandedSections.files
                        ? [{ rotate: "180deg" }]
                        : [],
                    }}
                  >
                    <ChevronDown size={18} color="#94a3b8" />
                  </View>
                </Pressable>
                {expandedSections.files && (
                  <View style={styles.sectionContent}>
                    {fileList.length === 0 ? (
                      <Text style={styles.emptyText}>
                        Chưa có File được chia sẻ
                      </Text>
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
                  </View>
                )}
              </View>

              {/* Links Section */}
              <View>
                <Pressable
                  style={styles.sectionHeader}
                  onPress={() => toggleSection("links")}
                >
                  <Text style={styles.sectionHeaderText}>Link</Text>
                  <View
                    style={{
                      transform: expandedSections.links
                        ? [{ rotate: "180deg" }]
                        : [],
                    }}
                  >
                    <ChevronDown size={18} color="#94a3b8" />
                  </View>
                </Pressable>
                {expandedSections.links && (
                  <View style={styles.sectionContent}>
                    {links.length === 0 ? (
                      <Text style={styles.emptyText}>
                        Chưa có Link được chia sẻ
                      </Text>
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
                  </View>
                )}
              </View>

              {/* View All Button */}
              {(mediaFiles.length > 0 ||
                fileList.length > 0 ||
                links.length > 0) && (
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
                  <Text style={styles.dangerBtnText}>
                    Xóa lịch sử trò chuyện
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
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
