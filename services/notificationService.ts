import api from "@/lib/axios";
import type { NotificationItem } from "@/types/post";

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
}

export const notificationService = {
  getNotifications: async (page = 1): Promise<NotificationsResponse> => {
    const res = await api.get("/notifications", { params: { page } });
    return res.data;
  },
  markRead: async (id: string) => {
    const res = await api.put(`/notifications/${id}/read`);
    return res.data;
  },
  markAllRead: async () => {
    const res = await api.put("/notifications/read-all");
    return res.data;
  },
  getUnreadCount: async (): Promise<{ count: number }> => {
    const res = await api.get("/notifications/unread-count");
    return res.data;
  },
};