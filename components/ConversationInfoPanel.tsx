import type { Conversation, Message } from "@/types/chat";
import { decodeChatPayload } from "@/utils/chatMessageCodec";
import { ChevronDown, File, Link as LinkIcon, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface ConversationInfoPanelProps {
  visible: boolean;
  onClose: () => void;
  conversation: Conversation;
  messages: Message[];
  currentUserId?: string;
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
});

export default function ConversationInfoPanel({
  visible,
  onClose,
  conversation,
  messages,
  currentUserId,
}: ConversationInfoPanelProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    media: true,
    files: true,
    links: true,
  });

  const otherUser = useMemo(
    () => conversation.participants.find((p) => p._id !== currentUserId),
    [conversation.participants, currentUserId],
  );

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

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const mediaDisplay = mediaFiles.slice(0, 6);
  const fileDisplay = fileList.slice(0, 3);
  const linkDisplay = links.slice(0, 3);

  return (
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
                      {mediaFiles.length > 6 && (
                        <TouchableOpacity
                          style={styles.viewAllBtn}
                          onPress={() => {}}
                        >
                          <Text style={styles.viewAllBtnText}>Xem tất cả</Text>
                        </TouchableOpacity>
                      )}
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
                      {fileList.length > 3 && (
                        <TouchableOpacity
                          style={styles.viewAllBtn}
                          onPress={() => {}}
                        >
                          <Text style={styles.viewAllBtnText}>Xem tất cả</Text>
                        </TouchableOpacity>
                      )}
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
                    transform: expandedSections.media
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
                      {links.length > 3 && (
                        <TouchableOpacity
                          style={styles.viewAllBtn}
                          onPress={() => {}}
                        >
                          <Text style={styles.viewAllBtnText}>Xem tất cả</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
