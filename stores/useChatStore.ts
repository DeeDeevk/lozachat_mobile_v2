import { chatService } from "@/services/chatService";
import type { ChatState } from "@/types/store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      activeConversationId: null,
      convoLoading: false,
      messageLoading: false,
      setActiveConversation: (id) => set({ activeConversationId: id }),
      reset: () => {
        set({
          conversations: [],
          messages: {},
          activeConversationId: null,
          convoLoading: false,
          messageLoading: false,
        });
      },
      fetchConversations: async () => {
        try {
          set({ convoLoading: true });
          const { conversations } = await chatService.fetchConversations();
          set({ conversations, convoLoading: false });
        } catch (error) {
          console.error("Lỗi xảy ra khi fetchConversations: ", error);
          set({ convoLoading: false });
        }
      },
      fetchMessages: async (conversationId) => {
        const { activeConversationId, messages } = get();
        const { user } = useAuthStore.getState();

        const convoId = conversationId ?? activeConversationId;

        if (!convoId) return;

        const current = messages?.[convoId];
        const nextCursor =
          current?.nextCursor === undefined ? "" : current?.nextCursor;

        if (nextCursor === null) return;

        set({ messageLoading: true });

        try {
          const { messages: fetched, cursor } = await chatService.fetchMessages(
            convoId,
            nextCursor,
          );

          const processed = fetched.map((m) => ({
            ...m,
            isOwn: m.senderId === user?.userId,
          }));

          set((state) => {
            const prev = state.messages[convoId]?.items ?? [];
            const existingIds = new Set(prev.map((m) => m._id));
            const uniqueFetched = processed.filter(
              (m) => !existingIds.has(m._id),
            );
            const merged = [...uniqueFetched, ...prev];

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: merged,
                  hasMore: !!cursor,
                  nextCursor: cursor ?? null,
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi xảy ra khi fetchMessages:", error);
        } finally {
          set({ messageLoading: false });
        }
      },
      sendDirectMessage: async (recipientId, content, imgUrl) => {
        try {
          const { activeConversationId } = get();
          await chatService.sendDirecrMessages(
            recipientId,
            content,
            imgUrl,
            activeConversationId || undefined,
          );

          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === activeConversationId ? { ...c, seenBy: [] } : c,
            ),
          }));
        } catch (error) {
          console.error("Lỗi xảy ra khi gửi direct message", error);
        }
      },
      sendGroupMessage: async (conversationId, content, imgUrl) => {
        try {
          await chatService.sendGroupMessages(conversationId, content, imgUrl);
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === get().activeConversationId ? { ...c, seenBy: [] } : c,
            ),
          }));
        } catch (error) {
          console.error("Lỗi xảy ra khi gửi group message", error);
        }
      },
      addMessage: async (message) => {
        try {
          const { user } = useAuthStore.getState();
          const convoId = message.conversationId;
          message.isOwn = message.senderId === user?.userId;

          // Kiểm tra nếu chưa có tin nhắn nào của hội thoại này thì fetch trước
          if (
            !get().messages[convoId] ||
            get().messages[convoId].items.length === 0
          ) {
            await get().fetchMessages(convoId);
          }

          // Lấy state mới nhất ngay tại thời điểm cập nhật
          set((state) => {
            const currentConvo = state.messages[convoId] || {
              items: [],
              hasMore: false,
            };

            // Kiểm tra trong danh sách key có bị trùng không
            const isExisted = currentConvo.items.some(
              (m) => m._id === message._id,
            );

            if (isExisted) {
              return state; // Nếu tin nhắn đã tồn tại bỏ qua.
            }

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...currentConvo,
                  items: [...currentConvo.items, message], // Thêm tin nhắn mới vào cuối
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi xảy ra khi add message: ", error);
        }
      },
      updateConversation: (conversation) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c._id === conversation._id ? { ...c, ...conversation } : c,
          ),
        }));
      },
      addConversation: (conversation) => {
        set((state) => {
          const exists = state.conversations.some(
            (c) => c._id === conversation._id,
          );

          if (exists) return state;

          return {
            conversations: [conversation, ...state.conversations],
          };
        });
      },
      recallMessage: async (messageId: string, conversationId: string) => {
        try {
          await chatService.recallMessage(messageId);

          // ✅ gọi hàm mới (đã tách riêng)
          get().applyRecallMessage(messageId, conversationId);
        } catch (error) {
          console.error("Lỗi khi thu hồi tin nhắn:", error);
          throw error;
        }
      },

      deleteMessageForMe: async (messageId: string, conversationId: string) => {
        try {
          await chatService.deleteMessageForMe(messageId);

          set((state) => {
            const convo = state.messages[conversationId];
            if (!convo) return state;

            return {
              messages: {
                ...state.messages,
                [conversationId]: {
                  ...convo,
                  items: convo.items.filter((m) => m._id !== messageId),
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi khi xoá tin nhắn:", error);
          throw error;
        }
      },
      applyRecallMessage: (messageId: string, conversationId: string) => {
        set((state) => {
          const convo = state.messages[conversationId];
          if (!convo) return state;

          return {
            messages: {
              ...state.messages,
              [conversationId]: {
                ...convo,
                items: convo.items.map((m) =>
                  m._id === messageId
                    ? {
                        ...m,
                        isRecalled: true,
                        content: "Tin nhắn đã bị thu hồi",
                      }
                    : m,
                ),
              },
            },

            conversations: state.conversations.map((c) =>
              c._id === conversationId && c.lastMessage?._id === messageId
                ? {
                    ...c,
                    lastMessage: {
                      ...c.lastMessage,
                      content: "Tin nhắn đã bị thu hồi",
                    },
                  }
                : c,
            ),
          };
        });
      },
    }),
    {
      name: "chat-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ conversations: state.conversations }),
    },
  ),
);
