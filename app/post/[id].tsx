import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Video, ResizeMode } from "expo-av";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Share2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { postService } from "@/services/postService";
import { useAuthStore } from "@/stores/useAuthStore";
import { usePostStore } from "@/stores/usePostStore";
import { normalizePost } from "@/utils/normalizePost";
import { formatRelativeTime } from "@/utils/formatRelativeTime";
import { REACTION_EMOJI, REACTION_LABEL } from "@/types/post";
import SocialPostCard from "@/components/social/SocialPostCard";
import CommentModal from "@/components/social/CommentModal";
import { subscribeSocialEvent } from "@/utils/socialRealtime";
import type { Post, PostImage, ReactionType } from "@/types/post";

export default function PostDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; comments?: string }>();
  const postId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const openComments = params.comments === "1";

  const { user, userProfile } = useAuthStore();
  const currentUserId = userProfile?._id || user?.userId || "";
  const ensurePostInFeed = usePostStore((state) => state.ensurePostInFeed);
  const [postImages, setPostImages] = useState<PostImage[]>([]);
  const [activeMedia, setActiveMedia] = useState<PostImage | null>(null);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [mediaCommentsOpen, setMediaCommentsOpen] = useState(false);
  const [mediaReactionDetail, setMediaReactionDetail] = useState<{ displayName: string; avatarUrl?: string; type: ReactionType }[]>([]);
  const [mediaReactionLoading, setMediaReactionLoading] = useState(false);

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reloadPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError("");

    try {
      const fromFeed = await ensurePostInFeed(postId);
      if (fromFeed) {
        setPost(fromFeed);
        return;
      }

      const fetched = normalizePost(await postService.getById(postId));
      setPost(fetched);
    } catch {
      setError("Không tìm thấy bài viết.");
    } finally {
      setLoading(false);
    }
  }, [ensurePostInFeed, postId]);

  const loadMedia = useCallback(async () => {
    if (!postId) return;
    try {
      const media = await postService.getPostImages(postId);
      setPostImages(media || []);
    } catch {
      setPostImages([]);
    }
  }, [postId]);

  useEffect(() => {
    void reloadPost();
  }, [reloadPost]);

  useEffect(() => {
    if (!postId) return;
    void loadMedia();

    const unsubscribe = subscribeSocialEvent("notification", (notification) => {
      const notificationPostId = typeof notification.postId === "object" && notification.postId !== null ? notification.postId._id : notification.postId;
      if (String(notificationPostId || "") !== String(postId)) return;
      void reloadPost();
      void loadMedia();
    });

    return unsubscribe;
  }, [loadMedia, postId, reloadPost]);

  const initials = useMemo(() => {
    const name = post?.author?.displayName || "Người dùng";
    return (
      name
        .split(" ")
        .filter(Boolean)
        .slice(-2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "U"
    );
  }, [post?.author?.displayName]);

  const shareLink = async () => {
    await Clipboard.setStringAsync(`${process.env.EXPO_PUBLIC_WEB_URL || ""}/post/${postId}`);
  };

  const reactionTarget = activeMedia || null;

  const reactToMedia = async (type: ReactionType) => {
    if (!reactionTarget) return;
    await postService.reactToImage(postId, reactionTarget._id, type);
    await loadMedia();
    void loadMediaReactionDetail();
    setReactionPickerOpen(false);
  };

  const isMediaVideo = (url: string) => /\.(mp4|webm|ogg|mov|m4v|mkv)(\?.*)?$/i.test(url);

  const loadMediaReactionDetail = useCallback(async () => {
    if (!postId || !activeMedia) return;
    setMediaReactionLoading(true);
    try {
      const detail = await postService.getReactionsDetail(postId);
      const imageSection = (detail?.images || []).find((item: { imageId: string }) => String(item.imageId) === String(activeMedia._id));
      setMediaReactionDetail(imageSection?.reactions || []);
    } catch {
      setMediaReactionDetail([]);
    } finally {
      setMediaReactionLoading(false);
    }
  }, [activeMedia, postId]);

  useEffect(() => {
    if (!activeMedia) {
      setMediaReactionDetail([]);
      return;
    }

    void loadMediaReactionDetail();
  }, [activeMedia, loadMediaReactionDetail]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reloadPost()} tintColor="#60a5fa" colors={["#60a5fa"]} />}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={18} color="#e2e8f0" />
          </TouchableOpacity>
          <View style={styles.topBarText}>
            <Text style={styles.headerTitle}>Chi tiết bài viết</Text>
            <Text style={styles.headerSub}>Mở từ deeplink, thông báo, hoặc tìm kiếm</Text>
          </View>
          <TouchableOpacity style={styles.backBtn} onPress={() => void shareLink()}>
            <Share2 size={18} color="#e2e8f0" />
          </TouchableOpacity>
        </View>

        {loading ? <Text style={styles.statusText}>Đang tải bài viết...</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {post ? (
          <View style={styles.detailCard}>
            <View style={styles.metaRow}>
              {post.author?.avatarUrl ? (
                <Image source={{ uri: post.author.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}><Text style={styles.avatarFallbackText}>{initials}</Text></View>
              )}
              <View style={styles.metaBody}>
                <Text style={styles.authorName}>{post.author?.displayName || "Người dùng"}</Text>
                <Text style={styles.timeText}>{formatRelativeTime(post.createdAt)}</Text>
              </View>
              <View style={styles.reactionSummary}>
                <Text style={styles.reactionCount}>{post.reactions?.length || 0}</Text>
                <Text style={styles.reactionIcon}>{post.reactions?.[0]?.type ? REACTION_EMOJI[post.reactions[0].type] : "👍"}</Text>
              </View>
            </View>

            <SocialPostCard
              post={post}
              currentUserId={currentUserId}
              autoOpenComments={openComments}
              onProfilePress={(target) => router.push(`/profile/${target}` as never)}
            />

            {postImages.length > 0 ? (
              <View style={styles.mediaSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Media</Text>
                  <Text style={styles.sectionHint}>Bình luận và react từng ảnh</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRow}>
                  {postImages.map((image) => (
                    <TouchableOpacity key={image._id} style={styles.mediaCard} onPress={() => setActiveMedia(image)}>
                      {isMediaVideo(image.url) ? (
                        <View style={styles.mediaThumbVideoWrap}>
                          <Video source={{ uri: image.url }} style={styles.mediaThumbVideo} resizeMode={ResizeMode.COVER} isLooping={false} shouldPlay={false} useNativeControls={false} />
                          <View style={styles.mediaThumbVideoBadge}>
                            <Text style={styles.mediaThumbVideoBadgeText}>Video</Text>
                          </View>
                        </View>
                      ) : (
                        <Image source={{ uri: image.url }} style={styles.mediaThumb} />
                      )}
                      <View style={styles.mediaStats}>
                        <Text style={styles.mediaStatText}>{image.commentsCount || 0} bình luận</Text>
                        <Text style={styles.mediaStatText}>{image.reactionsCount || 0} react</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        ) : null}

        {!loading && !error && !post ? <Text style={styles.statusText}>Bài viết không tồn tại hoặc đã bị xoá.</Text> : null}
      </ScrollView>

      <Modal visible={!!activeMedia} transparent animationType="slide" onRequestClose={() => setActiveMedia(null)}>
        <Pressable style={styles.mediaBackdrop} onPress={() => setActiveMedia(null)} />
        {activeMedia ? (
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.mediaSheetRoot}>
            <View style={styles.mediaSheet}>
              <View style={styles.mediaHeader}>
                <Text style={styles.mediaTitle}>Tương tác media</Text>
                <TouchableOpacity onPress={() => setActiveMedia(null)}>
                  <Text style={styles.mediaClose}>Đóng</Text>
                </TouchableOpacity>
              </View>

              {isMediaVideo(activeMedia.url) ? (
                <View style={styles.mediaPreviewVideoWrap}>
                  <Video source={{ uri: activeMedia.url }} style={styles.mediaPreviewVideo} resizeMode={ResizeMode.CONTAIN} isLooping={false} shouldPlay={false} useNativeControls />
                </View>
              ) : (
                <Image source={{ uri: activeMedia.url }} style={styles.mediaPreview} resizeMode="contain" />
              )}

              <View style={styles.mediaActionRow}>
                <TouchableOpacity style={styles.mediaActionBtn} onPress={() => setReactionPickerOpen(true)}>
                  <Text style={styles.mediaActionText}>React ảnh</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mediaActionBtn} onPress={() => setMediaCommentsOpen(true)}>
                  <Text style={styles.mediaActionText}>Bình luận ảnh</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.mediaReactionPanel}>
                <View style={styles.mediaReactionPanelHeader}>
                  <Text style={styles.mediaReactionPanelTitle}>Người đã react</Text>
                  <Text style={styles.mediaReactionPanelSub}>{activeMedia.reactionsCount || mediaReactionDetail.length} lượt</Text>
                </View>
                {mediaReactionLoading ? <Text style={styles.mediaReactionLoading}>Đang tải danh sách react...</Text> : null}
                {!mediaReactionLoading && mediaReactionDetail.length === 0 ? (
                  <Text style={styles.mediaReactionEmpty}>Chưa có ai react ảnh này.</Text>
                ) : null}
                {mediaReactionDetail.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaReactionPeopleRow}>
                    {mediaReactionDetail.map((reaction, index) => (
                      <View key={`${reaction.displayName}-${index}`} style={styles.mediaReactionPersonChip}>
                        {reaction.avatarUrl ? (
                          <Image source={{ uri: reaction.avatarUrl }} style={styles.mediaReactionPersonAvatar} />
                        ) : (
                          <View style={styles.mediaReactionPersonFallback}>
                            <Text style={styles.mediaReactionPersonFallbackText}>{reaction.displayName.slice(0, 1).toUpperCase()}</Text>
                          </View>
                        )}
                        <Text style={styles.mediaReactionPersonName} numberOfLines={1}>{reaction.displayName}</Text>
                        <Text style={styles.mediaReactionPersonType}>{REACTION_LABEL[reaction.type]}</Text>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
              </View>

              <CommentModal
                visible={mediaCommentsOpen}
                post={post}
                currentUserId={currentUserId}
                onClose={() => setMediaCommentsOpen(false)}
                imageId={activeMedia._id}
              />

              <Modal visible={reactionPickerOpen} transparent animationType="fade" onRequestClose={() => setReactionPickerOpen(false)}>
                <Pressable style={styles.mediaBackdrop} onPress={() => setReactionPickerOpen(false)} />
                <View style={styles.mediaReactionSheet}>
                  <Text style={styles.mediaReactionTitle}>Chọn cảm xúc cho ảnh</Text>
                  <View style={styles.mediaReactionGrid}>
                    {(["like", "love", "haha", "wow", "sad", "angry"] as ReactionType[]).map((reaction) => (
                      <TouchableOpacity key={reaction} style={styles.mediaReactionItem} onPress={() => void reactToMedia(reaction)}>
                        <Text style={styles.mediaReactionEmoji}>{REACTION_EMOJI[reaction]}</Text>
                        <Text style={styles.mediaReactionLabel}>{REACTION_LABEL[reaction]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </Modal>
            </View>
          </KeyboardAvoidingView>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#060d1f" },
  content: { paddingHorizontal: 16, gap: 16 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" },
  topBarText: { flex: 1 },
  headerTitle: { color: "#e2e8f0", fontSize: 20, fontWeight: "900" },
  headerSub: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  statusText: { color: "#94a3b8", textAlign: "center", paddingVertical: 10 },
  errorText: { color: "#fca5a5", textAlign: "center", paddingVertical: 10 },
  detailCard: { gap: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#0f172a" },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#1d4ed8" },
  avatarFallbackText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  metaBody: { flex: 1 },
  authorName: { color: "#e2e8f0", fontSize: 15, fontWeight: "800" },
  timeText: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  reactionSummary: { alignItems: "center", gap: 4, minWidth: 44 },
  reactionCount: { color: "#e2e8f0", fontSize: 14, fontWeight: "900" },
  reactionIcon: { fontSize: 18 },
  mediaSection: { gap: 10 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: "#e2e8f0", fontSize: 15, fontWeight: "900" },
  sectionHint: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  mediaRow: { gap: 10 },
  mediaCard: { width: 170, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.04)", overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  mediaThumb: { width: "100%", height: 170, backgroundColor: "#0f172a" },
  mediaThumbVideoWrap: { width: "100%", height: 170, backgroundColor: "#0f172a", overflow: "hidden" },
  mediaThumbVideo: { width: "100%", height: "100%" },
  mediaThumbVideoBadge: { position: "absolute", left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(15,23,42,0.75)" },
  mediaThumbVideoBadgeText: { color: "#bfdbfe", fontSize: 10, fontWeight: "800" },
  mediaStats: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 8 },
  mediaStatText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  mediaBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  mediaSheetRoot: { flex: 1, justifyContent: "flex-end" },
  mediaSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#07111f", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 16, gap: 12 },
  mediaHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mediaTitle: { color: "#e2e8f0", fontSize: 16, fontWeight: "900" },
  mediaClose: { color: "#bfdbfe", fontSize: 12, fontWeight: "800" },
  mediaPreview: { width: "100%", height: 260, backgroundColor: "#050b16", borderRadius: 18 },
  mediaPreviewVideoWrap: { width: "100%", height: 260, backgroundColor: "#050b16", borderRadius: 18, overflow: "hidden" },
  mediaPreviewVideo: { width: "100%", height: "100%" },
  mediaActionRow: { flexDirection: "row", gap: 10 },
  mediaActionBtn: { flex: 1, minHeight: 44, borderRadius: 16, backgroundColor: "rgba(59,130,246,0.14)", alignItems: "center", justifyContent: "center" },
  mediaActionText: { color: "#bfdbfe", fontSize: 13, fontWeight: "800" },
  mediaReactionPanel: { gap: 10, borderRadius: 20, padding: 12, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  mediaReactionPanelHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mediaReactionPanelTitle: { color: "#e2e8f0", fontSize: 13, fontWeight: "900" },
  mediaReactionPanelSub: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  mediaReactionLoading: { color: "#bfdbfe", fontSize: 11, fontWeight: "700" },
  mediaReactionEmpty: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  mediaReactionPeopleRow: { gap: 8, paddingVertical: 2 },
  mediaReactionPersonChip: { width: 86, alignItems: "center", gap: 6 },
  mediaReactionPersonAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#0f172a" },
  mediaReactionPersonFallback: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#1d4ed8" },
  mediaReactionPersonFallbackText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  mediaReactionPersonName: { color: "#e2e8f0", fontSize: 11, fontWeight: "700", textAlign: "center" },
  mediaReactionPersonType: { color: "#94a3b8", fontSize: 10, fontWeight: "700", textAlign: "center" },
  mediaReactionSheet: { position: "absolute", left: 14, right: 14, bottom: 24, borderRadius: 22, backgroundColor: "#07111f", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 14 },
  mediaReactionTitle: { color: "#e2e8f0", fontSize: 14, fontWeight: "900", marginBottom: 12 },
  mediaReactionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mediaReactionItem: { width: "31%", minHeight: 68, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center", padding: 8 },
  mediaReactionEmoji: { fontSize: 20 },
  mediaReactionLabel: { color: "#cbd5e1", fontSize: 10, fontWeight: "700", marginTop: 4 },
});