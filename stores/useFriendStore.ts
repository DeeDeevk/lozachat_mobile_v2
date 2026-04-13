import type { User, FriendRequest, Friend, RequestStatus } from "../types/user";
import { friendService } from "@/services/friendService";
import { chatService } from "@/services/chatService";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import { create } from "zustand";

interface FriendState {
  handleRealTimeUpdate: (update: {
    action: string;
    targetUserId?: string;
    senderId?: string;
    receiverId?: string;
    fromUserId?: string;
    requestId?: string;
    newFriend?: Friend;
  }) => void;
  targetStatuses: Record<string, RequestStatus>;
  friends: Friend[];
  newFriendIds: string[];
  loading: boolean;
  receivedList: FriendRequest[];
  sentList: FriendRequest[];
  friendStatus: string | null;
  searchByUserName: (username: string) => Promise<User | null>;
  addFriend: (to: string, message?: string) => Promise<string>;
  getAllFriendRequest: () => Promise<void>;
  acceptRequest: (requestId: string) => Promise<void>;
  declineRequest: (requestId: string) => Promise<void>;
  getFriendStatus: (targetId: string) => Promise<string | null>;
  updateFriendStatus: (targetId: string) => Promise<void>;
  getFriends: () => Promise<void>;
  cancelRequest: (requestId: string) => Promise<void>;
  unfriend: (targetId: string) => Promise<void>;
  addNewFriendId: (friendId: string) => void;
  clearNewFriends: () => void;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  targetStatuses: {},
  friends: [],
  newFriendIds: [],
  loading: false,
  receivedList: [],
  sentList: [],
  friendStatus: null,
  searchByUserName: async (username) => {
    try {
      set({ loading: true });
      const user = await friendService.searchByUserName(username);
      return user;
    } catch (error) {
      console.error("Lỗi xảy ra khi tìm user bằng username", error);
      return null;
    } finally {
      set({ loading: false });
    }
  },
  addFriend: async (to, message) => {
    try {
      set({ loading: true });
      const resultMessage = await friendService.sendFriendRequest(to, message);
      return resultMessage;
    } catch (error) {
      console.error("Lỗi xảy ra khi addFriend", error);
      return "Lỗi xảy ra khi kết bạn. Hãy thử lại";
    } finally {
      set({ loading: false });
    }
  },
  getAllFriendRequest: async () => {
    try {
      set({ loading: true });
      const result = await friendService.getAllFriendRequest();
      if (!result) return;
      const { received, sent } = result;
      set({ receivedList: received, sentList: sent });
    } catch (error) {
      console.error("Lỗi xảy ra khi lấy danh sách yêu cầu kết bạn", error);
    } finally {
      set({ loading: false });
    }
  },
  acceptRequest: async (requestId) => {
    try {
      set({ loading: true });
      await friendService.acceptRequest(requestId);
      const request = get().receivedList.find((r) => r._id === requestId);
      if (request) {
        const fromId =
          typeof request.from === "string"
            ? request.from
            : (request.from as Partial<typeof request.from>)?._id || "";
        if (fromId) {
          get().addNewFriendId(fromId);
          // 🎯 Tạo hoặc lấy conversation khi chấp nhận kết bạn
          try {
            console.log("📱 Tạo conversation cho bạn:", fromId);
            const conversation =
              await chatService.getOrCreateDirectConversation(fromId);
            if (conversation) {
              console.log(
                "✅ Conversation tạo/lấy thành công:",
                conversation._id,
              );
              useChatStore.getState().addConversation(conversation);
            }
          } catch (convError) {
            console.error("⚠️ Lỗi tạo conversation:", convError);
            // Không dừng flow nếu tạo conversation thất bại
          }
        }
      }
      set((state) => ({
        receivedList: state.receivedList.filter((r) => r._id !== requestId),
      }));
    } catch (error) {
      console.error("Lỗi xảy ra khi chấp nhận yêu cầu kết bạn", error);
    } finally {
      set({ loading: false });
    }
  },
  declineRequest: async (requestId) => {
    try {
      set({ loading: true });
      await friendService.declineRequest(requestId);
      set((state) => ({
        receivedList: state.receivedList.filter((r) => r._id !== requestId),
      }));
    } catch (error) {
      console.error("Lỗi xảy ra khi từ chối yêu cầu kết bạn", error);
    } finally {
      set({ loading: false });
    }
  },
  getFriendStatus: async (targetId) => {
    try {
      set({ loading: true });
      const status = await friendService.getFriendStatus(targetId);
      set((state) => ({
        friendStatus: status,
        targetStatuses: {
          ...state.targetStatuses,
          [targetId]: status as RequestStatus,
        },
      }));
      return status || null;
    } catch (error) {
      console.error("Lỗi khi lấy trạng thái bạn bè", error);
      return null;
    } finally {
      set({ loading: false });
    }
  },
  updateFriendStatus: async (targetId: string) => {
    try {
      const status = await friendService.getFriendStatus(targetId);
      console.log(`✅ Friend status updated for ${targetId}:`, status);
      set((state) => ({
        targetStatuses: {
          ...state.targetStatuses,
          [targetId]: status as RequestStatus,
        },
      }));
    } catch (error) {
      console.error("Lỗi update friend status", error);
    }
  },
  getFriends: async () => {
    try {
      set({ loading: true });
      const friends = await friendService.getFriendList();
      set({ friends: friends });
    } catch (error) {
      console.error("Lỗi khi lấy danh sách bạn bè", error);
      set({ friends: [] });
    } finally {
      set({ loading: false });
    }
  },
  cancelRequest: async (requestId) => {
    try {
      set({ loading: true });
      await friendService.cancelRequest(requestId);
      set((state) => ({
        sentList: state.sentList.filter((r) => r._id !== requestId),
      }));
    } catch (error) {
      console.error("Lỗi khi huỷ yêu cầu", error);
    } finally {
      set({ loading: false });
    }
  },
  unfriend: async (targetId) => {
    try {
      set({ loading: true });
      await friendService.unfriend(targetId);
      set((state) => ({
        friends: state.friends.filter((f) => f._id !== targetId),
        newFriendIds: state.newFriendIds.filter((id) => id !== targetId),
        friendStatus: "none",
      }));
    } catch (error) {
      console.error("Lỗi khi huỷ kết bạn", error);
    } finally {
      set({ loading: false });
    }
  },
  handleRealTimeUpdate: async (update: {
    action: string;
    targetUserId?: string;
    senderId?: string;
    receiverId?: string;
    fromUserId?: string;
    requestId?: string;
    request?: FriendRequest;
    newFriend?: Friend;
  }) => {
    const authStore = useAuthStore.getState();
    const myId = authStore.user?.userId || (authStore as any).userProfile?._id;
    if (!myId) return;

    if (
      update.targetUserId === myId ||
      update.senderId === myId ||
      update.receiverId === myId ||
      update.fromUserId === myId
    ) {
      console.log("🔥 Real-time friend update:", update.action, update);

      set((state) => {
        switch (update.action) {
          case "request_received":
            if (
              update.request &&
              !state.receivedList.find((r) => r._id === update.request?._id)
            ) {
              return {
                receivedList: [
                  ...state.receivedList,
                  update.request as FriendRequest,
                ],
              };
            }
            break;
          case "request_sent":
            if (update.targetUserId) {
              return {
                targetStatuses: {
                  ...state.targetStatuses,
                  [update.targetUserId]: "sent" as RequestStatus,
                },
              };
            }
            break;
          case "request_cancelled":
          case "request_declined":
            if (update.requestId) {
              const newSent = state.sentList.filter(
                (r) => r._id !== update.requestId,
              );
              const newReceived = state.receivedList.filter(
                (r) => r._id !== update.requestId,
              );
              return { sentList: newSent, receivedList: newReceived };
            }
            break;
          case "request_accepted":
            if (update.newFriend) {
              const newFriends = state.friends.filter(
                (f) => f._id !== update.newFriend?._id,
              );
              newFriends.unshift(update.newFriend as Friend);
              return {
                friends: newFriends,
                newFriendIds: [...state.newFriendIds, update.newFriend._id],
                targetStatuses: {
                  ...state.targetStatuses,
                  [update.newFriend._id]: "friend" as RequestStatus,
                },
                receivedList: state.receivedList.filter(
                  (r) => r._id !== update.requestId,
                ),
                sentList: state.sentList.filter(
                  (r) => r._id !== update.requestId,
                ),
              };
            }
            break;
          case "unfriend":
            if (update.targetUserId) {
              return {
                friends: state.friends.filter(
                  (f) => f._id !== update.targetUserId,
                ),
                targetStatuses: {
                  ...state.targetStatuses,
                  [update.targetUserId]: "none" as RequestStatus,
                },
              };
            }
            break;
        }
        return state;
      });

      const targetIds = [
        update.targetUserId,
        update.senderId,
        update.receiverId,
        update.fromUserId,
        update.newFriend?._id, // Add newFriend ID for request_accepted
      ].filter(Boolean) as string[];

      console.log("📊 Fetching status for targetIds:", targetIds);
      for (const id of targetIds) {
        console.log(`📡 Updating friend status for: ${id}`);
        await get().updateFriendStatus(id);
      }

      // 🎯 Tạo conversation khi nhận được real-time request_accepted
      if (update.action === "request_accepted" && update.newFriend?._id) {
        try {
          console.log(
            "📱 Tạo conversation cho bạn từ real-time:",
            update.newFriend._id,
          );
          const conversation = await chatService.getOrCreateDirectConversation(
            update.newFriend._id,
          );
          if (conversation) {
            console.log(
              "✅ Conversation tạo thành công từ real-time:",
              conversation._id,
            );
            useChatStore.getState().addConversation(conversation);
          }
        } catch (e) {
          console.error("⚠️ Lỗi tạo conversation từ real-time update:", e);
        }
      }

      await Promise.all([get().getAllFriendRequest(), get().getFriends()]);
    }
  },
  addNewFriendId: (friendId: string) => {
    set((state) => {
      if (!state.newFriendIds.includes(friendId)) {
        return { newFriendIds: [...state.newFriendIds, friendId] };
      }
      return state;
    });
  },
  clearNewFriends: () => {
    set({ newFriendIds: [] });
  },
}));
