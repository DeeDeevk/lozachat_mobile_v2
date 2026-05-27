import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bell, ChevronRight, X } from "lucide-react-native";
import { notificationService } from "@/services/notificationService";
import { normalizeNotification } from "@/utils/normalizeNotification";
import { getNotifMessage, getNotifSubtext, NOTIF_TOAST_ICON } from "@/utils/notificationMessage";
import { formatRelativeTime } from "@/utils/formatRelativeTime";
import { subscribeSocialEvent } from "@/utils/socialRealtime";
import type { NotificationItem } from "@/types/post";

interface Props {
  visible: boolean;
  unreadCount: number;
  onClose: () => void;
  onOpenPost: (postId: string, openComments?: boolean) => void;
  onUnreadCountChange: React.Dispatch<React.SetStateAction<number>>;
}

export default function NotificationModal({
  visible,
  unreadCount,
  onClose,
  onOpenPost,
  onUnreadCountChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const loadNotifications = async (nextPage: number, reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await notificationService.getNotifications(nextPage);
      const normalized = (res.notifications || []).map(normalizeNotification);
      setItems((prev) => (reset ? normalized : [...prev, ...normalized]));
      setHasMore(res.pagination.hasMore);
      onUnreadCountChange(res.unreadCount);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!visible) return;
    setPage(1);
    void loadNotifications(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    const unsubscribe = subscribeSocialEvent("notification", (notification) => {
      const normalized = normalizeNotification(notification);
      setItems((prev) => {
        if (prev.some((item) => item._id === normalized._id)) return prev;
        return [normalized, ...prev];
      });
      onUnreadCountChange((count) => count + 1);
    });

    return unsubscribe;
  }, [onUnreadCountChange]);

  const handleScroll = async (event: any) => {
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const contentHeight = event.nativeEvent.contentSize.height;
    const offsetY = event.nativeEvent.contentOffset.y;

    if (loading || !hasMore) return;
    if (layoutHeight + offsetY >= contentHeight - 40) {
      const nextPage = page + 1;
      setPage(nextPage);
      await loadNotifications(nextPage);
    }
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllRead();
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    onUnreadCountChange(0);
  };

  const handlePress = async (item: NotificationItem) => {
    if (!item.read) {
      try {
        await notificationService.markRead(item._id);
        setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, read: true } : n)));
        onUnreadCountChange((count) => Math.max(0, count - 1));
      } catch {
        // ignore
      }
    }

    if (item.postId?._id) {
      onClose();
      onOpenPost(item.postId._id, item.type === "comment" || item.type === "reply" || item.type === "react_comment");
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.panel, { paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View style={styles.titleRow}>
            <Bell size={17} color="#93c5fd" />
            <Text style={styles.title}>Thông báo</Text>
            {unreadCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.headerActions}>
            {unreadCount > 0 ? (
              <TouchableOpacity onPress={handleMarkAllRead}>
                <Text style={styles.markReadText}>Đánh dấu đã đọc</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={16} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.list} onScroll={handleScroll} scrollEventThrottle={16}>
          {items.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <Bell size={24} color="#64748b" />
              <Text style={styles.emptyText}>Chưa có thông báo nào</Text>
            </View>
          ) : null}

          {items.map((item) => {
            const subtext = getNotifSubtext(item);
            return (
              <TouchableOpacity key={item._id} style={[styles.item, !item.read && styles.itemUnread]} onPress={() => void handlePress(item)}>
                <View style={styles.avatarWrap}>
                  {item.actorId?.avatarUrl ? (
                    <Image source={{ uri: item.actorId.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>{(item.actorId?.displayName || "A").slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.iconBadge}>
                    <Text style={styles.iconBadgeText}>{NOTIF_TOAST_ICON[item.type] || "🔔"}</Text>
                  </View>
                </View>

                <View style={styles.content}>
                  <Text style={[styles.message, !item.read && styles.messageUnread]}>{getNotifMessage(item)}</Text>
                  {subtext ? <Text style={styles.subtext} numberOfLines={1}>{subtext}</Text> : null}
                  <Text style={styles.time}>
                    {formatRelativeTime(item.createdAt)}
                  </Text>
                </View>

                <ChevronRight size={14} color="#475569" />
              </TouchableOpacity>
            );
          })}

          {loading ? <Text style={styles.loadingText}>Đang tải...</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  panel: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: "92%",
    backgroundColor: "#07111f",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.07)",
  },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: "#e2e8f0", fontSize: 18, fontWeight: "800" },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "#2563eb", paddingHorizontal: 6 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  headerActions: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  markReadText: { color: "#60a5fa", fontSize: 12, fontWeight: "800" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" },
  list: { flex: 1 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 8 },
  emptyText: { color: "#64748b", fontSize: 13 },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  itemUnread: { backgroundColor: "rgba(59,130,246,0.06)" },
  avatarWrap: { position: "relative" },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#0f172a" },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  iconBadge: { position: "absolute", right: -4, bottom: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: "#07111f", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  iconBadgeText: { fontSize: 10 },
  content: { flex: 1 },
  message: { color: "#cbd5e1", fontSize: 13, lineHeight: 18, fontWeight: "600" },
  messageUnread: { color: "#e2e8f0" },
  subtext: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  time: { color: "#64748b", fontSize: 11, marginTop: 6 },
  loadingText: { color: "#64748b", textAlign: "center", paddingVertical: 16 },
});