import { chatService } from "@/services/chatService";
import type { Participant } from "@/types/chat";
import type { ChatState } from "@/types/store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useAuthStore } from "./useAuthStore";

const dedupeMessages = (items: any[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key =
      item._id ||
      `${item.conversationId}-${item.senderId}-${item.createdAt}-${item.content}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messages: {},
      activeConversationId: null,
      typingUsersByConv: {},
      convoLoading: false,
      messageLoading: false,
      joinRequests: {},

      setActiveConversation: (id) => set({ activeConversationId: id }),

      reset: () => {
        set({
          conversations: [],
          messages: {},
          activeConversationId: null,
          typingUsersByConv: {},
          convoLoading: false,
          messageLoading: false,
          joinRequests: {},
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

          const processed = fetched.map((m: any) => ({
            ...m,
            isOwn: m.senderId === user?.userId,
          }));

          set((state) => {
            const prev = state.messages[convoId]?.items ?? [];
            const merged = dedupeMessages(
              prev.length > 0 ? [...processed, ...prev] : processed,
            );

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

      sendDirectMessage: async (recipientId, payload, conversationId) => {
        try {
          const targetConvId = conversationId ?? get().activeConversationId;

          await chatService.sendDirecrMessages(
            recipientId,
            payload?.content || "",
            payload?.imgUrl || "",
            targetConvId || undefined,
          );

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
          const { fetchMessages } = get();
          message.isOwn = message.senderId === user?.userId;

          const convoId = message.conversationId;

          let prevItems = get().messages[convoId]?.items ?? [];
          if (prevItems.length === 0) {
            await fetchMessages(message.conversationId);
            prevItems = get().messages[convoId]?.items ?? [];
          }

          set((state) => {
            const existingItems = state.messages[convoId]?.items ?? prevItems;
            if (existingItems.some((m) => m._id === message._id)) {
              return state;
            }

            const currentConvoState = state.messages[convoId] ?? {
              items: [],
              hasMore: false,
              nextCursor: undefined,
            };

            return {
              messages: {
                ...state.messages,
                [convoId]: {
                  items: dedupeMessages([...existingItems, message]),
                  hasMore: currentConvoState.hasMore,
                  nextCursor: currentConvoState.nextCursor ?? undefined,
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
          conversations: state.conversations.map((c) => {
            if (c._id !== conversation._id) return c;

            const mergedParticipants = conversation.participants
              ? (conversation.participants.map((incoming: any) => {
                  const existing = c.participants?.find(
                    (p: any) => p._id === incoming._id,
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

      updateLastRead: (
        userId: string,
        conversationId: string,
        messageId: string,
      ) => {
        set((state) => ({
          conversations: state.conversations.map((conversation) => {
            if (conversation._id !== conversationId) return conversation;

            return {
              ...conversation,
              participants: conversation.participants.map((participant: any) =>
                participant._id === userId
                  ? { ...participant, lastReadMessageId: messageId }
                  : participant,
              ),
            };
          }),
        }));
      },

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

      clearTypingUsers: (conversationId: string) =>
        set((state) => ({
          typingUsersByConv: {
            ...state.typingUsersByConv,
            [conversationId]: [],
          },
        })),

      editMessage: async (
        messageId: string,
        conversationId: string,
        content: string,
      ) => {
        try {
          await chatService.editMessage(messageId, content);
          get().applyEditMessage(
            messageId,
            conversationId,
            content,
            new Date().toISOString(),
          );
        } catch (error) {
          console.error("Lỗi khi sửa tin nhắn:", error);
          throw error;
        }
      },

      applyEditMessage: (
        messageId: string,
        conversationId: string,
        newContent: string,
        editedAt: string,
      ) => {
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
                    ? { ...m, content: newContent, isEdited: true, editedAt }
                    : m,
                ),
              },
            },

            conversations: state.conversations.map((c) =>
              c._id === conversationId && c.lastMessage?._id === messageId
                ? {
                    ...c,
                    lastMessage: { ...c.lastMessage, content: newContent },
                  }
                : c,
            ),
          };
        });
      },

      reactMessage: async (messageId, conversationId, emoji) => {
        try {
          const { reactions } = await chatService.reactMessage(
            messageId,
            emoji,
          );
          get().applyMessageReactions(messageId, conversationId, reactions);
        } catch (error) {
          console.error("Lỗi khi react tin nhắn:", error);
          throw error;
        }
      },

      applyMessageReactions: (messageId, conversationId, reactions) => {
        set((state) => {
          const convo = state.messages[conversationId];
          if (!convo) return state;

          return {
            messages: {
              ...state.messages,
              [conversationId]: {
                ...convo,
                items: convo.items.map((m) =>
                  m._id === messageId ? { ...m, reactions } : m,
                ),
              },
            },
          };
        });
      },

      togglePinMessage: async (messageId, conversationId) => {
        try {
          const { pinnedMessages } = await chatService.pinMessage(messageId);
          get().applyPinnedMessages(conversationId, pinnedMessages);
        } catch (error) {
          console.error("Lỗi khi ghim/bỏ ghim:", error);
          throw error;
        }
      },

      fetchPinnedMessages: async (conversationId) => {
        const { pinnedMessages } =
          await chatService.fetchPinnedMessages(conversationId);
        get().applyPinnedMessages(conversationId, pinnedMessages);
        return pinnedMessages;
      },

      applyPinnedMessages: (conversationId, pinnedMessages) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c._id === conversationId
              ? { ...c, pinnedMessages: pinnedMessages.slice(0, 5) }
              : c,
          ),
        }));
      },

      updateConversationTheme: async (conversationId, themeId) => {
        try {
          const result = await chatService.updateConversationTheme(
            conversationId,
            themeId,
          );
          set((state) => ({
            conversations: state.conversations.map((c) =>
              c._id === conversationId
                ? { ...c, chatThemeId: result.themeId }
                : c,
            ),
          }));
        } catch (error) {
          console.error("Lỗi cập nhật theme hội thoại:", error);
          throw error;
        }
      },

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
                (p: any) => p._id !== myId,
              );
              if (otherParticipant) {
                await sendDirectMessage(otherParticipant._id, payload, convId);
              }
            }
          } catch (err) {
            console.error(`Lỗi khi gửi tới hội thoại ${convId}:`, err);
          }
        }
      },

      // ==================== CÁC HÀM GROUP & JOIN REQUEST ====================
      createConversation: async (payload) => {
        try {
          set({ convoLoading: true });

          const newConvoRaw = await chatService.createConversation(payload);

          type RawParticipant = {
            userId?: {
              _id?: string;
              displayName?: string;
              avatarUrl?: string | null;
            };
            joinedAt?: string;
            lastReadMessageId?: string | null;
          };

          const formattedParticipants = (newConvoRaw.participants || []).map(
            (p: RawParticipant) => ({
              _id: p.userId?._id,
              displayName: p.userId?.displayName,
              avatarUrl: p.userId?.avatarUrl ?? null,
              joinedAt: p.joinedAt,
              lastReadMessageId: p.lastReadMessageId?.toString() ?? null,
            }),
          );

          const formattedConvo = {
            ...newConvoRaw,
            participants: formattedParticipants,
            unreadCounts: newConvoRaw.unreadCounts || {},
          };

          set((state) => {
            const exists = state.conversations.some(
              (c) => c._id === formattedConvo._id,
            );
            if (exists) return state;

            return {
              conversations: [formattedConvo, ...state.conversations],
              activeConversationId: formattedConvo._id,
            };
          });
        } catch (error) {
          console.error("Lỗi khi tạo conversation:", error);
          throw error;
        } finally {
          set({ convoLoading: false });
        }
      },

      updateMemberRole: (conversationId, targetUserId, role) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c._id === conversationId
              ? {
                  ...c,
                  participants: c.participants.map((p: any) =>
                    p._id === targetUserId ? { ...p, role } : p,
                  ),
                }
              : c,
          ),
        }));
      },

      deleteConversationForMe: async (conversationId: string) => {
        try {
          await chatService.deleteConversationForMe(conversationId);
          const { user } = useAuthStore.getState();
          const userId = user?.userId ?? "";

          set((state) => ({
            messages: Object.fromEntries(
              Object.entries(state.messages).filter(
                ([key]) => key !== conversationId,
              ),
            ),
            conversations: state.conversations.map((c) =>
              c._id === conversationId
                ? {
                    ...c,
                    lastMessage: null as any,
                    // ✅ Reset đúng key userId về 0 thay vì xóa cả object
                    unreadCounts: {
                      ...(c as any).unreadCounts,
                      [userId]: 0,
                    } as any,
                  }
                : c,
            ),
          }));
        } catch (error) {
          console.error("Lỗi khi xóa tin nhắn:", error);
          throw error;
        }
      },
      dissolveGroup: async (conversationId: string) => {
        try {
          await chatService.dissolveGroup(conversationId);
          set((state) => ({
            conversations: state.conversations.filter(
              (c) => c._id !== conversationId,
            ),
            activeConversationId:
              state.activeConversationId === conversationId
                ? null
                : state.activeConversationId,
            messages: Object.fromEntries(
              Object.entries(state.messages).filter(
                ([key]) => key !== conversationId,
              ),
            ),
          }));
        } catch (error) {
          console.error("Lỗi khi giải tán nhóm:", error);
          throw error;
        }
      },
      leaveGroup: async (conversationId: string, newOwnerId?: string) => {
        try {
          await chatService.leaveGroup(conversationId, newOwnerId);
          set((state) => ({
            conversations: state.conversations.filter(
              (c) => c._id !== conversationId,
            ),
            activeConversationId:
              state.activeConversationId === conversationId
                ? null
                : state.activeConversationId,
            messages: Object.fromEntries(
              Object.entries(state.messages).filter(
                ([key]) => key !== conversationId,
              ),
            ),
          }));
        } catch (error) {
          console.error("Lỗi khi rời nhóm:", error);
          throw error;
        }
      },

      addMemberToGroup: async (conversationId, targetUserId) => {
        const res = await chatService.addMemberToGroup(
          conversationId,
          targetUserId,
        );
        return {
          needsApproval: res.message?.includes("chờ") ?? false,
        };
      },

      reviewJoinRequest: async (conversationId, requestId, action) => {
        await chatService.reviewJoinRequest(conversationId, requestId, action);
        set((state) => ({
          joinRequests: {
            ...state.joinRequests,
            [conversationId]: (state.joinRequests[conversationId] ?? []).filter(
              (r) => r._id !== requestId,
            ),
          },
        }));
      },

      fetchJoinRequests: async (conversationId) => {
        const requests =
          await chatService.getPendingJoinRequests(conversationId);
        set((state) => ({
          joinRequests: {
            ...state.joinRequests,
            [conversationId]: requests,
          },
        }));
      },

      addJoinRequest: (request) => {
        set((state) => ({
          joinRequests: {
            ...state.joinRequests,
            [request.conversationId]: [
              ...(state.joinRequests[request.conversationId] ?? []),
              request,
            ],
          },
        }));
      },

      addMemberToConversation: (conversationId, member) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c._id === conversationId
              ? { ...c, participants: [...c.participants, member] }
              : c,
          ),
        }));
      },
    }),

    {
      name: "chat-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
      }),
    },
  ),
);
