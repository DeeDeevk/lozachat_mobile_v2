import { useEffect, useMemo, useState } from "react";
import { Image, KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Pencil, Share2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { userService } from "@/services/userService";
import { postService } from "@/services/postService";
import { normalizePosts } from "@/utils/normalizePost";
import { useAuthStore } from "@/stores/useAuthStore";
import SocialPostCard from "@/components/social/SocialPostCard";
import type { Post } from "@/types/post";

interface UserProfile {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export default function PublicProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const userId = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const { user, userProfile: myProfile } = useAuthStore();
  const setUserProfile = useAuthStore((state) => state.setUserProfile);
  const currentUserId = myProfile?._id || user?.userId || "";
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showBioEditor, setShowBioEditor] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [savingBio, setSavingBio] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError("");

    void Promise.allSettled([userService.getPublicProfileById(userId), postService.getUserPosts(userId, 1)])
      .then(([profileResult, postResult]) => {
        if (profileResult.status === "fulfilled" && profileResult.value.user) {
          setProfile(profileResult.value.user as UserProfile);
          setBioDraft((profileResult.value.user as UserProfile).bio ?? "");
        }

        if (postResult.status === "fulfilled") {
          setPosts(normalizePosts(postResult.value.posts || []));
        }

        if (profileResult.status === "rejected" && postResult.status === "rejected") {
          setError("Không tải được trang cá nhân.");
        }
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const reloadProfile = async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const [profileResult, postResult] = await Promise.allSettled([
        userService.getPublicProfileById(userId),
        postService.getUserPosts(userId, 1),
      ]);

      if (profileResult.status === "fulfilled" && profileResult.value.user) {
        setProfile(profileResult.value.user as UserProfile);
        setBioDraft((profileResult.value.user as UserProfile).bio ?? "");
      }

      if (postResult.status === "fulfilled") {
        setPosts(normalizePosts(postResult.value.posts || []));
      }
    } finally {
      setRefreshing(false);
    }
  };

  const isOwner = String(currentUserId) === String(userId);

  const saveBio = async () => {
    if (!profile) return;
    setSavingBio(true);
    try {
      await userService.updateMe({ displayName: profile.displayName, bio: bioDraft.trim(), phone: profile.phone });
      setProfile((current) => (current ? { ...current, bio: bioDraft.trim() } : current));
      if (isOwner) {
        setUserProfile({ ...profile, bio: bioDraft.trim() });
      }
      setShowBioEditor(false);
    } finally {
      setSavingBio(false);
    }
  };

  const initials = useMemo(() => {
    const name = profile?.displayName || "Người dùng";
    return (
      name
        .split(" ")
        .filter(Boolean)
        .slice(-2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "U"
    );
  }, [profile?.displayName]);

  const stats = useMemo(
    () => ({
      posts: posts.length,
      public: posts.filter((post) => post.visibility === "public").length,
      friends: posts.filter((post) => post.visibility === "friends").length,
      private: posts.filter((post) => post.visibility === "private").length,
    }),
    [posts],
  );

  return (
    <View style={styles.root}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reloadProfile()} tintColor="#60a5fa" colors={["#60a5fa"]} />}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28 }]}
      >
        <View style={styles.hero}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <ArrowLeft size={18} color="#e2e8f0" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroGlow} />
          <View style={styles.heroInner}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}><Text style={styles.avatarFallbackText}>{initials}</Text></View>
            )}

            <View style={styles.heroMeta}>
              <Text style={styles.name}>{profile?.displayName || "Trang cá nhân"}</Text>
              <Text style={styles.username}>@{profile?.username || "unknown"}</Text>
              <View style={styles.bioRow}>
                <Text style={styles.bio} numberOfLines={isOwner ? 4 : 0}>
                  {profile?.bio || "Chưa có tiểu sử"}
                </Text>
                {isOwner ? (
                  <TouchableOpacity style={styles.bioEditBtn} onPress={() => setShowBioEditor(true)}>
                    <Pencil size={13} color="#bfdbfe" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.shareBtn} onPress={() => {
              void Clipboard.setStringAsync(`${process.env.EXPO_PUBLIC_WEB_URL || ""}/profile/${userId}`);
            }}>
              <Share2 size={14} color="#e2e8f0" />
              <Text style={styles.shareBtnText}>Chia sẻ</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <StatBox label="Bài viết" value={String(stats.posts)} />
            <StatBox label="Công khai" value={String(stats.public)} />
            <StatBox label="Bạn bè" value={String(stats.friends)} />
            <StatBox label="Riêng tư" value={String(stats.private)} />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Bài viết</Text>
          <View style={styles.sectionDivider} />
        </View>

        {loading ? <Text style={styles.loadingText}>Đang tải...</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {!loading && !error && posts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyTitle}>Chưa có bài viết hiển thị</Text>
          </View>
        ) : null}

        <View style={styles.feedList}>
          {posts.map((post) => (
            <SocialPostCard
              key={post._id}
              post={post}
              currentUserId={currentUserId}
              onProfilePress={(target) => router.push(`/profile/${target}` as never)}
            />
          ))}
        </View>
      </ScrollView>

      <Modal visible={showBioEditor} transparent animationType="slide" onRequestClose={() => setShowBioEditor(false)}>
        <KeyboardAvoidingView style={styles.editorBackdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.editorBackdrop} onPress={() => !savingBio && setShowBioEditor(false)}>
            <Pressable style={styles.editorSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.editorHeader}>
                <Text style={styles.editorTitle}>Chỉnh sửa tiểu sử</Text>
                <TouchableOpacity onPress={() => setShowBioEditor(false)}>
                  <Text style={styles.editorCloseText}>Đóng</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={bioDraft}
                onChangeText={setBioDraft}
                placeholder="Viết tiểu sử của bạn..."
                placeholderTextColor="#64748b"
                multiline
                style={styles.editorInput}
              />
              <TouchableOpacity style={styles.editorSaveBtn} onPress={() => void saveBio()} disabled={savingBio}>
                <Text style={styles.editorSaveText}>{savingBio ? "Đang lưu..." : "Lưu tiểu sử"}</Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#060d1f" },
  content: { paddingHorizontal: 16, gap: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  backBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, height: 36, borderRadius: 999, backgroundColor: "rgba(59,130,246,0.14)" },
  editBtnText: { color: "#bfdbfe", fontSize: 12, fontWeight: "800" },
  hero: { borderRadius: 32, padding: 16, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", overflow: "hidden" },
  heroGlow: { position: "absolute", top: -90, right: -90, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(37,99,235,0.18)" },
  heroInner: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  avatar: { width: 92, height: 92, borderRadius: 26, backgroundColor: "#0f172a" },
  avatarFallback: { width: 92, height: 92, borderRadius: 26, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: "#fff", fontSize: 28, fontWeight: "900" },
  heroMeta: { flex: 1, paddingTop: 2 },
  name: { color: "#e2e8f0", fontSize: 24, fontWeight: "900" },
  username: { color: "#60a5fa", fontSize: 13, marginTop: 4, fontWeight: "700" },
  bioRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 10 },
  bio: { flex: 1, color: "#cbd5e1", fontSize: 13, lineHeight: 19 },
  bioEditBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(59,130,246,0.14)", marginTop: -2 },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14, flexWrap: "wrap" },
  shareBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, height: 42, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)" },
  shareBtnText: { color: "#e2e8f0", fontSize: 13, fontWeight: "800" },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  statBox: { flexGrow: 1, minWidth: 72, paddingVertical: 10, borderRadius: 18, alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)" },
  statValue: { color: "#fff", fontSize: 15, fontWeight: "900" },
  statLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "800", marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionTitle: { color: "#e2e8f0", fontSize: 14, fontWeight: "800" },
  sectionDivider: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" },
  loadingText: { color: "#94a3b8", textAlign: "center" },
  errorText: { color: "#fca5a5", textAlign: "center" },
  emptyCard: { alignItems: "center", justifyContent: "center", paddingVertical: 30, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  emptyEmoji: { fontSize: 28 },
  emptyTitle: { color: "#e2e8f0", fontSize: 15, fontWeight: "800", marginTop: 10 },
  feedList: { gap: 14 },
  editorBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)", justifyContent: "flex-end" },
  editorSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16, backgroundColor: "#07111f", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  editorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  editorTitle: { color: "#e2e8f0", fontSize: 16, fontWeight: "900" },
  editorCloseText: { color: "#94a3b8", fontSize: 12, fontWeight: "800" },
  editorInput: { minHeight: 120, color: "#e2e8f0", fontSize: 14, lineHeight: 20, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.04)", marginBottom: 12, textAlignVertical: "top" },
  editorSaveBtn: { minHeight: 46, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#2563eb" },
  editorSaveText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});