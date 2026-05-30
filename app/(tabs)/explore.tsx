import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Bell, ImagePlus, Search, Send, UserCircle2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePostStore } from "@/stores/usePostStore";
import { notificationService } from "@/services/notificationService";
import NotificationModal from "@/components/social/NotificationModal";
import SocialPostCard from "@/components/social/SocialPostCard";
import type { Visibility } from "@/types/post";
import { subscribeSocialEvent } from "@/utils/socialRealtime";

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ post?: string; comments?: string }>();
  const { user, userProfile } = useAuthStore();
  const { posts, loading, hasMore, fetchPosts, loadMore, createPost, ensurePostInFeed } = usePostStore();
  const scrollRef = useRef<ScrollView>(null);
  const postYRef = useRef<Record<string, number>>({});

  const [content, setContent] = useState("");
  const [images, setImages] = useState<any[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [creating, setCreating] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [targetPostId, setTargetPostId] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [refreshingFeed, setRefreshingFeed] = useState(false);

  const currentUserId = userProfile?._id || user?.userId || "";
  const currentUser = useMemo(
    () => ({
      _id: currentUserId,
      displayName: userProfile?.displayName || user?.username || "Người dùng",
      avatarUrl: userProfile?.avatarUrl,
    }),
    [currentUserId, userProfile?.avatarUrl, userProfile?.displayName, user?.username],
  );

  useEffect(() => {
    void fetchPosts(true);
    void notificationService.getUnreadCount().then((res) => setUnreadCount(res.count)).catch(() => {});
  }, [fetchPosts]);

  useEffect(() => {
    const unsubscribe = subscribeSocialEvent("notification", () => {
      void fetchPosts(true);
    });

    return unsubscribe;
  }, [fetchPosts]);

  const refreshFeed = async () => {
    setRefreshingFeed(true);
    try {
      await Promise.all([
        fetchPosts(true),
        notificationService.getUnreadCount().then((res) => setUnreadCount(res.count)).catch(() => {}),
      ]);
    } finally {
      setRefreshingFeed(false);
    }
  };

  useEffect(() => {
    const postId = typeof params.post === "string" ? params.post : Array.isArray(params.post) ? params.post[0] : null;
    const wantsComments = params.comments === "1";
    if (!postId) return;
    setTargetPostId(postId);
    setOpenComments(wantsComments);

    void (async () => {
      await ensurePostInFeed(postId);
      requestAnimationFrame(() => {
        const y = postYRef.current[postId];
        if (typeof y === "number") {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
        }
      });
    })();
  }, [params.comments, params.post, ensurePostInFeed]);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 10,
    });

    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets]);
    }
  };

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  const submitPost = async () => {
    if (creating || (!content.trim() && images.length === 0)) return;
    setCreating(true);
    try {
      await createPost(content.trim(), images, visibility);
      setContent("");
      setImages([]);
      setVisibility("public");
      setPrivacyOpen(false);
      setComposerOpen(false);
      await fetchPosts(true);
    } finally {
      setCreating(false);
    }
  };

  const openTargetPost = (postId: string, comments = false) => {
    router.push(`/post/${postId}${comments ? "?comments=1" : ""}` as never);
  };

  const initials = currentUser.displayName
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.root}>
        <ScrollView ref={scrollRef} style={styles.scroll} refreshControl={<RefreshControl refreshing={refreshingFeed || (loading && posts.length > 0)} onRefresh={() => void refreshFeed()} tintColor="#60a5fa" colors={["#60a5fa"]} />} contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28 }]} onScroll={(event) => {
          const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
          if (!loading && hasMore && layoutMeasurement.height + contentOffset.y >= contentSize.height - 140) {
            void loadMore();
          }
        }} scrollEventThrottle={16}>
          <View style={styles.headerCard}>
            <View>
              <Text style={styles.kicker}>Social</Text>
              <Text style={styles.title}>Bảng tin</Text>
              <Text style={styles.subtitle}>Đăng bài, bình luận, chia sẻ và theo dõi thông báo trong cùng một nơi.</Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/search" as never)}>
                <Search size={18} color="#e2e8f0" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setNotificationOpen(true)}>
                <Bell size={18} color="#e2e8f0" />
                {unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View> : null}
              </TouchableOpacity>
              <TouchableOpacity style={styles.profileChip} onPress={() => router.push("/(tabs)/profile" as never)}>
                {currentUser.avatarUrl ? (
                  <Image source={{ uri: currentUser.avatarUrl }} style={styles.profileAvatar} />
                ) : (
                  <View style={styles.profileFallback}><Text style={styles.profileFallbackText}>{initials}</Text></View>
                )}
                <View>
                  <Text style={styles.profileName} numberOfLines={1}>{currentUser.displayName}</Text>
                  <Text style={styles.profileHint}>Trang cá nhân</Text>
                </View>
                <UserCircle2 size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.composerLauncher} activeOpacity={0.9} onPress={() => setComposerOpen(true)}>
            {currentUser.avatarUrl ? (
              <Image source={{ uri: currentUser.avatarUrl }} style={styles.composerAvatar} />
            ) : (
              <View style={styles.composerAvatarFallback}><Text style={styles.composerAvatarText}>{initials}</Text></View>
            )}
            <View style={styles.composerLauncherBody}>
              <Text style={styles.composerLauncherPrompt}>Bạn đang nghĩ gì ?</Text>
              <Text style={styles.composerLauncherHint}>Nhấn để đăng bài, thêm media, chọn quyền riêng tư</Text>
            </View>
            <View style={styles.composerLauncherAction}>
              <ImagePlus size={18} color="#bfdbfe" />
            </View>
          </TouchableOpacity>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mới nhất</Text>
            <View style={styles.sectionDivider} />
          </View>

          {loading && posts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>✨</Text>
              <Text style={styles.emptyTitle}>Đang tải bảng tin...</Text>
            </View>
          ) : null}

          {posts.length === 0 && !loading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🪄</Text>
              <Text style={styles.emptyTitle}>Bảng tin đang trống</Text>
              <Text style={styles.emptySub}>Hãy đăng bài đầu tiên hoặc theo dõi thêm bạn bè.</Text>
            </View>
          ) : null}

          <View style={styles.feedList}>
            {posts.map((post) => (
              <View key={post._id} onLayout={(event) => { postYRef.current[post._id] = event.nativeEvent.layout.y; }}>
                <SocialPostCard
                  post={post}
                  currentUserId={currentUserId}
                  highlighted={targetPostId === post._id}
                  autoOpenComments={openComments && targetPostId === post._id}
                  onProfilePress={(userId) => router.push(`/profile/${userId}` as never)}
                  onOpenDetail={() => router.push(`/post/${post._id}` as never)}
                />
              </View>
            ))}
          </View>

          {loading && posts.length > 0 ? <Text style={styles.loadingMore}>Đang tải thêm...</Text> : null}
          {!hasMore && posts.length > 0 ? <Text style={styles.endText}>Bạn đã xem hết bài viết.</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <NotificationModal
        visible={notificationOpen}
        unreadCount={unreadCount}
        onClose={() => setNotificationOpen(false)}
        onOpenPost={(postId, comments) => openTargetPost(postId, comments)}
        onUnreadCountChange={setUnreadCount}
      />

      <Modal visible={composerOpen} transparent animationType="slide" onRequestClose={() => setComposerOpen(false)}>
        <Pressable style={styles.composerBackdrop} onPress={() => {
          Keyboard.dismiss();
          if (creating) return;
          setPrivacyOpen(false);
          setComposerOpen(false);
        }} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.composerModalRoot}>
          <View style={[styles.composerModal, { paddingBottom: insets.bottom + 14, paddingTop: insets.top + 10 }]}>
            <View style={styles.composerModalHeader}>
              <View style={styles.composerHeaderActions}>
                <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.composerModalClose}>
                  <Text style={styles.composerModalCloseText}>Ẩn bàn phím</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setPrivacyOpen(false); setComposerOpen(false); }} style={styles.composerModalClose}>
                  <Text style={styles.composerModalCloseText}>Đóng</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.composerPrivacyWrap}>
                <TouchableOpacity style={styles.composerPrivacyBtn} onPress={() => setPrivacyOpen((current) => !current)}>
                  <Text style={styles.composerPrivacyLabel}>Quyền riêng tư</Text>
                  <Text style={styles.composerPrivacyValue}>{visibility === "public" ? "Công khai" : visibility === "friends" ? "Bạn bè" : "Riêng tư"}</Text>
                </TouchableOpacity>
                {privacyOpen ? (
                  <View style={styles.composerPrivacyMenu}>
                    {(["public", "friends", "private"] as Visibility[]).map((item) => (
                      <TouchableOpacity
                        key={item}
                        style={[styles.composerPrivacyItem, visibility === item && styles.composerPrivacyItemActive]}
                        onPress={() => {
                          setVisibility(item);
                          setPrivacyOpen(false);
                        }}
                      >
                        <Text style={[styles.composerPrivacyItemText, visibility === item && styles.composerPrivacyItemTextActive]}>
                          {item === "public" ? "Công khai" : item === "friends" ? "Bạn bè" : "Riêng tư"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.composerModalTop}>
              {currentUser.avatarUrl ? (
                <Image source={{ uri: currentUser.avatarUrl }} style={styles.composerModalAvatar} />
              ) : (
                <View style={styles.composerModalAvatarFallback}><Text style={styles.composerAvatarText}>{initials}</Text></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.composerModalName}>{currentUser.displayName}</Text>
                <Text style={styles.composerModalSub}>Tạo bài viết mới</Text>
              </View>
            </View>

            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Bạn đang nghĩ gì?"
              placeholderTextColor="#64748b"
              multiline
              style={styles.composerModalInput}
            />

            {images.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewStrip}>
                {images.map((asset, index) => (
                  <View key={`${asset.uri}-${index}`} style={styles.previewWrap}>
                    <Image source={{ uri: asset.uri }} style={styles.previewImage} />
                    <TouchableOpacity style={styles.previewRemove} onPress={() => removeImage(index)}>
                      <Text style={styles.previewRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.composerModalActions}>
              <TouchableOpacity style={styles.attachBtn} onPress={pickImages}>
                <ImagePlus size={16} color="#bfdbfe" />
                <Text style={styles.attachText}>Media</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.postBtn} onPress={() => void submitPost()} disabled={creating || (!content.trim() && images.length === 0)}>
                <Send size={16} color="#fff" />
                <Text style={styles.postBtnText}>{creating ? "Đang đăng..." : "Đăng"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#060d1f" },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  headerCard: { padding: 18, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  kicker: { color: "#60a5fa", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.2 },
  title: { color: "#e2e8f0", fontSize: 30, fontWeight: "900", marginTop: 6 },
  subtitle: { color: "#94a3b8", fontSize: 13, marginTop: 8, lineHeight: 19 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", position: "relative" },
  badge: { position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  profileChip: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 180, borderRadius: 20, padding: 10, backgroundColor: "rgba(255,255,255,0.04)" },
  profileAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#0f172a" },
  profileFallback: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  profileFallbackText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  profileName: { color: "#e2e8f0", fontSize: 13, fontWeight: "800", maxWidth: 160 },
  profileHint: { color: "#64748b", fontSize: 11, marginTop: 1 },
  composerLauncher: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 26, padding: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  composerLauncherBody: { flex: 1 },
  composerLauncherPrompt: { color: "#e2e8f0", fontSize: 15, fontWeight: "800" },
  composerLauncherHint: { color: "#64748b", fontSize: 12, marginTop: 2, lineHeight: 17 },
  composerLauncherAction: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(59,130,246,0.16)" },
  composerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#0f172a" },
  composerAvatarFallback: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#1d4ed8" },
  composerAvatarText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  composerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)" },
  composerModalRoot: { flex: 1, justifyContent: "flex-end" },
  composerModal: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 16, backgroundColor: "#07111f", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  composerModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  composerHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  composerModalClose: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)" },
  composerModalCloseText: { color: "#e2e8f0", fontSize: 12, fontWeight: "800" },
  composerPrivacyWrap: { position: "relative", alignItems: "flex-end" },
  composerPrivacyBtn: { minWidth: 112, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  composerPrivacyLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "700" },
  composerPrivacyValue: { color: "#e2e8f0", fontSize: 12, fontWeight: "800", marginTop: 2 },
  composerPrivacyMenu: { position: "absolute", top: 44, right: 0, width: 146, borderRadius: 16, backgroundColor: "#0b1728", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden", zIndex: 20 },
  composerPrivacyItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  composerPrivacyItemActive: { backgroundColor: "rgba(59,130,246,0.14)" },
  composerPrivacyItemText: { color: "#cbd5e1", fontSize: 12, fontWeight: "700" },
  composerPrivacyItemTextActive: { color: "#bfdbfe" },
  composerModalTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  composerModalAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#0f172a" },
  composerModalAvatarFallback: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#1d4ed8" },
  composerModalName: { color: "#e2e8f0", fontSize: 15, fontWeight: "800" },
  composerModalSub: { color: "#64748b", fontSize: 12, marginTop: 2 },
  composerModalInput: { minHeight: 128, maxHeight: 200, color: "#e2e8f0", fontSize: 15, textAlignVertical: "top", lineHeight: 21, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.04)" },
  previewStrip: { marginTop: 10, marginBottom: 4 },
  previewWrap: { position: "relative", marginRight: 10 },
  previewImage: { width: 78, height: 78, borderRadius: 18, backgroundColor: "#111827" },
  previewRemove: { position: "absolute", top: -5, right: -5, width: 20, height: 20, borderRadius: 10, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" },
  previewRemoveText: { color: "#fff", fontSize: 15, fontWeight: "900", marginTop: -1 },
  composerModalActions: { marginTop: 12, gap: 10, paddingBottom: 2 },
  attachBtn: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: "rgba(59,130,246,0.14)" },
  attachText: { color: "#bfdbfe", fontSize: 12, fontWeight: "800" },
  postBtn: { marginTop: 2, minHeight: 46, borderRadius: 18, backgroundColor: "#2563eb", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  postBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionTitle: { color: "#e2e8f0", fontSize: 14, fontWeight: "800" },
  sectionDivider: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  emptyCard: { borderRadius: 28, padding: 22, alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  emptyEmoji: { fontSize: 28 },
  emptyTitle: { color: "#e2e8f0", fontSize: 16, fontWeight: "800", marginTop: 10 },
  emptySub: { color: "#94a3b8", fontSize: 12, marginTop: 4, textAlign: "center" },
  feedList: { gap: 14 },
  loadingMore: { color: "#94a3b8", textAlign: "center", paddingVertical: 8 },
  endText: { color: "#64748b", textAlign: "center", paddingVertical: 6, fontSize: 12 },
});