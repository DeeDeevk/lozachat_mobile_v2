import { useState } from "react";
import { Image, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronLeft, Search, UserRoundSearch } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { searchService } from "@/services/searchService";
import { useAuthStore } from "@/stores/useAuthStore";
import { normalizePosts } from "@/utils/normalizePost";
import SocialPostCard from "@/components/social/SocialPostCard";
import type { SearchResponse } from "@/types/post";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, userProfile } = useAuthStore();
  const currentUserId = userProfile?._id || user?.userId || "";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const response = await searchService.searchAll(trimmed);
      setResults({ ...response, posts: normalizePosts(response.posts || []) });
    } finally {
      setLoading(false);
    }
  };

  const openProfile = (userId: string) => router.push(`/profile/${userId}` as never);
  const openPost = (postId: string) => router.push(`/post/${postId}?comments=1` as never);

  const refreshResults = async () => {
    if (!query.trim()) return;
    await handleSearch();
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={18} color="#e2e8f0" />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Tìm kiếm</Text>
          <Text style={styles.subtitle}>Tìm người dùng và bài viết trong social của LozaChat</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Search size={18} color="#94a3b8" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          placeholder="Tìm bài viết, tên người dùng, email..."
          placeholderTextColor="#64748b"
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
        <Text style={styles.searchBtnText}>{loading ? "Đang tìm..." : "Tìm ngay"}</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refreshResults()} tintColor="#60a5fa" colors={["#60a5fa"]} />}>
        {results?.users?.length ? <Text style={styles.sectionTitle}>Người dùng</Text> : null}
        {results?.users?.map((userItem) => (
          <TouchableOpacity key={userItem._id} style={styles.userCard} onPress={() => openProfile(userItem._id)}>
            {userItem.avatarUrl ? (
              <Image source={{ uri: userItem.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}><Text style={styles.avatarFallbackText}>{(userItem.displayName || userItem.username || "U").slice(0, 1).toUpperCase()}</Text></View>
            )}
            <View style={styles.userMeta}>
              <Text style={styles.userName}>{userItem.displayName}</Text>
              <Text style={styles.userSub}>@{userItem.username}</Text>
              {userItem.bio ? <Text style={styles.userBio} numberOfLines={2}>{userItem.bio}</Text> : null}
            </View>
            <UserRoundSearch size={16} color="#60a5fa" />
          </TouchableOpacity>
        ))}

        {results?.posts?.length ? <Text style={styles.sectionTitle}>Bài viết</Text> : null}
        {results?.posts?.map((post) => (
          <TouchableOpacity key={post._id} activeOpacity={0.9} onPress={() => openPost(post._id)}>
            <SocialPostCard
              post={post}
              currentUserId={currentUserId}
              onProfilePress={openProfile}
              onOpenDetail={() => openPost(post._id)}
            />
          </TouchableOpacity>
        ))}

        {!loading && results && results.posts.length === 0 && results.users.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>Không có kết quả phù hợp</Text>
            <Text style={styles.emptySub}>Hãy thử một từ khóa khác.</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#060d1f", paddingHorizontal: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" },
  headerCopy: { flex: 1 },
  title: { color: "#e2e8f0", fontSize: 28, fontWeight: "900" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginTop: 6, lineHeight: 19 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, height: 48, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  searchInput: { flex: 1, color: "#e2e8f0", fontSize: 14 },
  searchBtn: { marginTop: 10, height: 46, borderRadius: 16, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  searchBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  content: { paddingTop: 14, paddingBottom: 28, gap: 12 },
  sectionTitle: { color: "#e2e8f0", fontSize: 14, fontWeight: "800", marginTop: 4 },
  userCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#0f172a" },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#1d4ed8" },
  avatarFallbackText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  userMeta: { flex: 1 },
  userName: { color: "#e2e8f0", fontSize: 14, fontWeight: "800" },
  userSub: { color: "#60a5fa", fontSize: 12, marginTop: 2 },
  userBio: { color: "#94a3b8", fontSize: 12, marginTop: 4, lineHeight: 18 },
  emptyCard: { alignItems: "center", paddingVertical: 28, paddingHorizontal: 20, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  emptyEmoji: { fontSize: 26 },
  emptyTitle: { color: "#e2e8f0", fontSize: 16, fontWeight: "800", marginTop: 10 },
  emptySub: { color: "#94a3b8", fontSize: 12, marginTop: 4, textAlign: "center" },
});