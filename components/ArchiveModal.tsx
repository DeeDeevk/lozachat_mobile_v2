import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Pressable,
} from "react-native";
import { X, File, Link as LinkIcon } from "lucide-react-native";

interface ArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaFiles: Array<{
    type: "image" | "audio";
    url: string;
    timestamp: string;
  }>;
  fileList: Array<{ url: string; name: string; timestamp: string }>;
  links: Array<{ url: string; preview: string; timestamp: string }>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  modal: {
    flex: 0.9,
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.15)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f1f5f9",
  },
  closeBtn: {
    padding: 8,
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.15)",
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginRight: 20,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
  },
  tabTextActive: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563eb",
  },
  tabBorder: {
    position: "absolute",
    bottom: -1,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#2563eb",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },
  mediaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 0,
  },
  mediaItemWrapper: {
    width: "31%",
    marginBottom: 8,
  },
  mediaItem: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    overflow: "hidden",
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  dateGroupTitle: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 16,
  },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(148,163,184,0.08)",
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
  },
  fileText: {
    color: "#2563eb",
    fontSize: 12,
    flex: 1,
  },
  linkItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(148,163,184,0.08)",
    borderRadius: 8,
    marginBottom: 8,
    gap: 10,
  },
  linkText: {
    color: "#2563eb",
    fontSize: 12,
    flex: 1,
  },
  imagePreview: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
});

export default function ArchiveModal({
  isOpen,
  onClose,
  mediaFiles,
  fileList,
  links,
}: ArchiveModalProps) {
  const [activeTab, setActiveTab] = useState<"media" | "files" | "links">(
    "media",
  );
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} transparent animationType="slide">
      <Pressable style={styles.container} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Kho lưu trữ</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            {[
              { id: "media", label: "Ảnh/Video" },
              { id: "files", label: "Files" },
              { id: "links", label: "Links" },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tab, { position: "relative" }]}
                onPress={() => setActiveTab(tab.id as typeof activeTab)}
              >
                <Text
                  style={
                    activeTab === tab.id ? styles.tabTextActive : styles.tabText
                  }
                >
                  {tab.label}
                </Text>
                {activeTab === tab.id && <View style={styles.tabBorder} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Media Tab */}
            {activeTab === "media" && (
              <>
                {mediaFiles.length === 0 ? (
                  <Text style={styles.emptyText}>Chưa có ảnh/video</Text>
                ) : (
                  <>
                    {[...mediaFiles]
                      .reverse()
                      .reduce(
                        (acc, media) => {
                          const date = new Date(
                            media.timestamp,
                          ).toLocaleDateString("vi-VN");
                          const lastGroup = acc[acc.length - 1];
                          if (lastGroup && lastGroup.date === date) {
                            lastGroup.items.push(media);
                          } else {
                            acc.push({ date, items: [media] });
                          }
                          return acc;
                        },
                        [] as Array<{ date: string; items: typeof mediaFiles }>,
                      )
                      .map((group) => (
                        <View key={group.date}>
                          <Text style={styles.dateGroupTitle}>
                            {group.date}
                          </Text>
                          <View style={styles.mediaGrid}>
                            {group.items.map((media, idx) => (
                              <View key={idx} style={styles.mediaItemWrapper}>
                                <TouchableOpacity
                                  style={styles.mediaItem}
                                  onPress={() => setSelectedImage(media.url)}
                                >
                                  {media.type === "image" && (
                                    <Image
                                      source={{ uri: media.url }}
                                      style={styles.mediaImage}
                                    />
                                  )}
                                  {media.type === "audio" && (
                                    <View
                                      style={{
                                        flex: 1,
                                        justifyContent: "center",
                                        alignItems: "center",
                                        backgroundColor: "#f59e0b",
                                      }}
                                    >
                                      <Text
                                        style={{ color: "white", fontSize: 10 }}
                                      >
                                        🎵
                                      </Text>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                  </>
                )}
              </>
            )}

            {/* Files Tab */}
            {activeTab === "files" && (
              <>
                {fileList.length === 0 ? (
                  <Text style={styles.emptyText}>Chưa có file</Text>
                ) : (
                  <>
                    {[...fileList]
                      .reverse()
                      .reduce(
                        (acc, file) => {
                          const date = new Date(
                            file.timestamp,
                          ).toLocaleDateString("vi-VN");
                          const lastGroup = acc[acc.length - 1];
                          if (lastGroup && lastGroup.date === date) {
                            lastGroup.items.push(file);
                          } else {
                            acc.push({ date, items: [file] });
                          }
                          return acc;
                        },
                        [] as Array<{ date: string; items: typeof fileList }>,
                      )
                      .map((group) => (
                        <View key={group.date}>
                          <Text style={styles.dateGroupTitle}>
                            {group.date}
                          </Text>
                          {group.items.map((file, idx) => (
                            <View key={idx} style={styles.fileItem}>
                              <File size={16} color="#8b5cf6" />
                              <Text style={styles.fileText} numberOfLines={1}>
                                {file.name}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ))}
                  </>
                )}
              </>
            )}

            {/* Links Tab */}
            {activeTab === "links" && (
              <>
                {links.length === 0 ? (
                  <Text style={styles.emptyText}>Chưa có link</Text>
                ) : (
                  <>
                    {[...links]
                      .reverse()
                      .reduce(
                        (acc, link) => {
                          const date = new Date(
                            link.timestamp,
                          ).toLocaleDateString("vi-VN");
                          const lastGroup = acc[acc.length - 1];
                          if (lastGroup && lastGroup.date === date) {
                            lastGroup.items.push(link);
                          } else {
                            acc.push({ date, items: [link] });
                          }
                          return acc;
                        },
                        [] as Array<{ date: string; items: typeof links }>,
                      )
                      .map((group) => (
                        <View key={group.date}>
                          <Text style={styles.dateGroupTitle}>
                            {group.date}
                          </Text>
                          {group.items.map((link, idx) => (
                            <View key={idx} style={styles.linkItem}>
                              <LinkIcon size={16} color="#f59e0b" />
                              <Text style={styles.linkText} numberOfLines={1}>
                                {link.preview}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ))}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>

      {/* Image Preview Modal */}
      {selectedImage && (
        <Modal transparent animationType="fade">
          <Pressable
            style={styles.imagePreview}
            onPress={() => setSelectedImage(null)}
          >
            <Image
              source={{ uri: selectedImage }}
              style={styles.previewImage}
            />
          </Pressable>
        </Modal>
      )}
    </Modal>
  );
}
