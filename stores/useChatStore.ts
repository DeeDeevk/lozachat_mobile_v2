import { chatService } from "@/services/chatService";
import type { Participant } from "@/types/chat";
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
      typingUsersByConv: {},
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
          typingUsersByConv: {},
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

            // lọc trùng theo _id
            const existingIds = new Set(prev.map((m) => m._id));
            const filtered = processed.filter((m) => !existingIds.has(m._id));

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: [...filtered, ...prev],
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

      sendDirectMessage: async (recipientId, payload, conversationId) => {
        try {
          // ƯU TIÊN conversationId truyền vào (dùng cho forward),
          // nếu không có mới lấy cái đang mở (active)
          const targetConvId = conversationId ?? get().activeConversationId;

          await chatService.sendDirecrMessages(
            recipientId,
            payload?.content || "",
            payload?.imgUrl || "",
            targetConvId || undefined,
          );

          // Cập nhật UI cho đúng hội thoại đó
          if (targetConvId) {
            set((state) => ({
              conversations: state.conversations.map((c) =>
                c._id === targetConvId ? { ...c, seenBy: [] } : c,
              ),
            }));
          }
        } catch (error) {
          console.error("Lỗi gửi tin nhắn:", error);
        }
      },

      sendGroupMessage: async (conversationId, payload) => {
        try {
          await chatService.sendGroupMessages(
            conversationId,
            payload?.content || "",
            payload?.imgUrl,
          );
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === get().activeConversationId ? { ...c, seenBy: [] } : c,
            ),
          }));
        } catch (error) {
          console.error("Lỗi xảy ra khi gửi group message", error);
        }
      },

      // ✅ Thêm từ web
      uploadAttachment: async (file) => {
        try {
          return await chatService.uploadAttachment(file);
        } catch (error) {
          console.error("Lỗi upload file chat", error);
          throw error;
        }
      },

      addMessage: async (message) => {
        try {
          const { user } = useAuthStore.getState();
          message.isOwn = message.senderId === user?.userId;

          const convoId = message.conversationId;

          set((state) => {
            const prev = state.messages[convoId]?.items ?? [];

            // nếu đã có thì skip luôn
            if (prev.some((m) => m._id === message._id)) {
              return state;
            }

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  ...state.messages[convoId],
                  items: [...prev, message],
                },
              },
            };
          });
        } catch (error) {
          console.error("Lỗi xảy ra khi add message: ", error);
        }
      },

      // ✅ Fix từ web — merge participants đúng cách, giữ lastReadMessageId
      updateConversation: (conversation) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c._id !== conversation._id) return c;

            const mergedParticipants = conversation.participants
              ? (conversation.participants.map((incoming) => {
                  const existing = c.participants?.find(
                    (p) => p._id === incoming._id,
                  );
                  return {
                    ...existing,
                    ...incoming,
                    lastReadMessageId:
                      incoming.lastReadMessageId ??
                      existing?.lastReadMessageId ??
                      null,
                  };
                }) as Participant[])
              : c.participants;

            return {
              ...c,
              ...conversation,
              participants: mergedParticipants,
            };
          }),
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
          get().applyRecallMessage(messageId, conversationId);
        } catch (error) {
          console.error("Lỗi khi thu hồi tin nhắn:", error);
          throw error;
        }
      },

      // ✅ Thêm từ web
      updateLastRead: (
        userId: string,
        conversationId: string,
        lastReadMessageId: string,
      ) => {
        set((state) => {
          const newConversations = state.conversations.map((conv) => {
            if (conv._id !== conversationId) return conv;

            return {
              ...conv,
              participants: conv.participants.map((p) => {
                if (p._id === userId) {
                  return { ...p, lastReadMessageId };
                }
                return { ...p };
              }),
            };
          });

          return { conversations: newConversations };
        });
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

      // ✅ Thêm từ web
      addTypingUser: (userId: string, conversationId: string) =>
        set((state) => {
          const current = state.typingUsersByConv[conversationId] || [];

          if (current.includes(userId)) return state;

          return {
            typingUsersByConv: {
              ...state.typingUsersByConv,
              [conversationId]: [...current, userId],
            },
          };
        }),

      // ✅ Thêm từ web
      removeTypingUser: (userId: string, conversationId: string) =>
        set((state) => {
          const current = state.typingUsersByConv[conversationId] || [];

          return {
            typingUsersByConv: {
              ...state.typingUsersByConv,
              [conversationId]: current.filter((id) => id !== userId),
            },
          };
        }),

      // ✅ Thêm từ web
      clearTypingUsers: (conversationId: string) =>
        set((state) => ({
          typingUsersByConv: {
            ...state.typingUsersByConv,
            [conversationId]: [],
          },
        })),

      // ✅ Thêm từ web
      updateStrangerStatus: async (conversationId, action) => {
        try {
          await chatService.updateStrangerStatus(conversationId, action);
          if (action === "declined") {
            set((state) => ({
              conversations: state.conversations.filter(
                (c) => c._id !== conversationId,
              ),
              activeConversationId:
                get().activeConversationId === conversationId
                  ? null
                  : get().activeConversationId,
            }));
          } else {
            set((state) => ({
              conversations: state.conversations.map((c) =>
                c._id === conversationId
                  ? { ...c, isStranger: true, strangerStatus: "accepted" }
                  : c,
              ),
            }));
          }
        } catch (error) {
          console.error("Lỗi khi update trạng thái người lạ: ", error);
          throw error;
        }
      },
      forwardMessage: async (message, targetConversationIds) => {
        const { sendDirectMessage, sendGroupMessage, conversations } = get();
        const { user } = useAuthStore.getState();
        const myId = user?.userId;

        // Sử dụng for...of để đảm bảo thứ tự gửi tin nhắn chính xác
        for (const convId of targetConversationIds) {
          const targetConv = conversations.find((c) => c._id === convId);
          if (!targetConv) continue;

          const payload = {
            content: message.content,
            imgUrl: message.imgUrl || undefined,
          };

          try {
            if (targetConv.type === "group") {
              await sendGroupMessage(convId, payload);
            } else {
              const otherParticipant = targetConv.participants.find(
                (p) => p._id !== myId,
              );
              if (otherParticipant) {
                // QUAN TRỌNG: Truyền convId vào tham số thứ 3
                await sendDirectMessage(otherParticipant._id, payload, convId);
              }
            }
          } catch (err) {
            console.error(`Lỗi khi gửi tới hội thoại ${convId}:`, err);
          }
        }
      },
    }),

    {
      name: "chat-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId, // ✅ Thêm từ web
      }),
    },
  ),
);
