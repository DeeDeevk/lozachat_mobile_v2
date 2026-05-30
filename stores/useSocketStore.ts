import type { SocketState } from "@/types/store";
import { getDeviceId } from "@/utils/device";
import { navigationHelper } from "@/utils/navigationHelper";
import { emitSocialEvent } from "@/utils/socialRealtime";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import { useFriendStore } from "./useFriendStore";

const baseURL = process.env.EXPO_PUBLIC_SOCKET_URL;

const registerSocketEvents = (
  socket: Socket,
  set: (partial: Partial<SocketState>) => void,
) => {
  socket.off("connect");
  socket.off("online-users");
  socket.off("new-message");
  socket.off("message-recalled");
  socket.off("message-read");
  socket.off("message-edited");
  socket.off("user-typing");
  socket.off("user-stop-typing");
  socket.off("stranger-declined");
  socket.off("stranger-accepted");
  socket.off("stranger-request");
  socket.off("stranger-removed");
  socket.off("new-group-created");
  socket.off("group-updated");
  socket.off("member-role-updated");
  socket.off("conversation-deleted-for-me");
  socket.off("group-dissolved");
  socket.off("left-group");
  socket.off("member-left");
  socket.off("removed-from-group");
  socket.off("group-join-request");
  socket.off("join-request-reviewed");
  socket.off("added-to-group");
  socket.off("group-settings-updated");
  socket.off("message-reacted");
  socket.off("conversation:pins-updated");
  socket.off("conversation:theme-updated");
  socket.off("force-logout");
  socket.off("join-request-resolved");
  socket.off("notification");
  socket.on("removed-from-group", ({ conversationId }) => {
    useChatStore.setState((state) => ({
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
  });
  socket.on("member-left", ({ conversationId, userId }) => {
    useChatStore.setState((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === conversationId
          ? {
              ...c,
              participants: c.participants.filter((p) => p._id !== userId),
            }
          : c,
      ),
    }));
  });
  socket.on("left-group", ({ conversationId }) => {
    useChatStore.setState((state) => ({
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
  });
  socket.on("group-dissolved", ({ conversationId }) => {
    useChatStore.setState((state) => ({
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
  });
  socket.on("conversation-deleted-for-me", ({ conversationId }) => {
    useChatStore.setState((state) => ({
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
  });
  socket.off("group-join-request");
  socket.off("join-request-reviewed");
  socket.off("added-to-group");
  socket.off("group-settings-updated");
  socket.off("message-reacted");
  socket.off("conversation:pins-updated");
  socket.off("conversation:theme-updated");
  socket.off("force-logout");
  socket.on("connect", () => {
    console.log("Đã kết nối với socket");
  });

  socket.on("force-logout", async ({ message, replacedBy }) => {
    // ✅ Kiểm tra xem device mình có bị replace hay không
    const currentDeviceId = await getDeviceId();

    // Nếu replacedBy === currentDeviceId, nghĩa là device mình là device mới → ignore
    if (replacedBy && replacedBy === currentDeviceId) {
      console.log("[force-logout] Device này là device mới, ignore");
      return;
    }

    // Device cũ nhận được → show force logout dialog
    console.log("[force-logout] Device cũ bị logout");
    useAuthStore.setState({
      forceLogoutMessage:
        message || "Phiên đăng nhập của bạn đã bị thay thế trên thiết bị khác.",
    });
  });

  socket.on("message-read", ({ userId, conversationId, messageId }) => {
    useChatStore.getState().updateLastRead(userId, conversationId, messageId);
  });

  socket.on("online-users", (userIds) => {
    set({ onlineUsers: userIds });
  });
  socket.on("user-typing", (payload) => {
    console.log("🔥 typing event:", payload);
    useChatStore
      .getState()
      .addTypingUser(payload.userId, payload.conversationId);
  });

  socket.on("user-stop-typing", ({ userId, conversationId }) => {
    useChatStore.getState().removeTypingUser(userId, conversationId);
  });
  socket.on(
    "message-edited",
    ({ messageId, conversationId, newContent, editedAt }) => {
      useChatStore
        .getState()
        .applyEditMessage(messageId, conversationId, newContent, editedAt);
    },
  );
  socket.on(
    "message-edited",
    ({ messageId, conversationId, newContent, editedAt }) => {
      useChatStore
        .getState()
        .applyEditMessage(messageId, conversationId, newContent, editedAt);
    },
  );
  socket.on("message-reacted", ({ messageId, conversationId, reactions }) => {
    useChatStore
      .getState()
      .applyMessageReactions(messageId, conversationId, reactions || []);
  });
  socket.on(
    "conversation:pins-updated",
    ({ conversationId, pinnedMessages }) => {
      useChatStore
        .getState()
        .applyPinnedMessages(conversationId, pinnedMessages || []);
    },
  );
  socket.on("conversation:theme-updated", ({ conversationId, themeId }) => {
    useChatStore.setState((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === conversationId ? { ...c, chatThemeId: themeId } : c,
      ),
    }));
  });

  socket.on("new-message", ({ message, conversation, unreadCounts }) => {
    const existingConv = useChatStore
      .getState()
      .conversations.find((c) => c._id === conversation._id);

    useChatStore.getState().addMessage(message);

    const lastMessage = {
      _id: conversation.lastMessage._id,
      content: conversation.lastMessage.content,
      createdAt: conversation.lastMessage.createdAt,
      sender: {
        _id: conversation.lastMessage.senderId,
        displayName: "",
        avatarUrl: null,
      },
    };

    if (!existingConv) {
      // ✅ Conversation bị xóa trước đó → fetch lại và thêm vào store
      useChatStore.getState().fetchConversations();
      return;
    }

    useChatStore.getState().updateConversation({
      ...conversation,
      lastMessage,
      unreadCounts,
    });
  });

  socket.on("message-recalled", ({ messageId, conversationId }) => {
    useChatStore.getState().applyRecallMessage(messageId, conversationId);
  });

  socket.on("stranger-request", ({ conversation }) => {
    useChatStore.getState().addConversation(conversation);
    socket.emit("join-conversation", { conversationId: conversation._id });
  });

  socket.on("notification", (notification) => {
    emitSocialEvent("notification", notification);
  });

  socket.on("stranger-accepted", ({ conversationId }) => {
    useChatStore.setState((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === conversationId
          ? { ...c, isStranger: true, strangerStatus: "accepted" }
          : c,
      ),
    }));
  });

  socket.on("stranger-declined", ({ conversationId }) => {
    useChatStore.setState((state) => ({
      conversations: state.conversations.filter(
        (c) => c._id !== conversationId,
      ),
      activeConversationId:
        state.activeConversationId === conversationId
          ? null
          : state.activeConversationId,
    }));
  });
  socket.off("friend_update");
  socket.on("friend_update", (update) => {
    useFriendStore.getState().handleRealTimeUpdate(update);
  });

  socket.off("new-conversation");
  socket.on("new-conversation", (conversation) => {
    const existing = useChatStore
      .getState()
      .conversations.find((c) => c._id === conversation.id);
    if (existing) {
      console.log("Updated conversation from socket:", conversation);
      useChatStore.getState().updateConversation(conversation);
    } else {
      console.log("New conversation from socket:", conversation);
      useChatStore.getState().addConversation(conversation);
    }

    socket.emit("join-conversation", { conversationId: conversation.id });
  });
  socket.on("stranger-removed", ({ conversationId }) => {
    useChatStore.setState((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === conversationId ? { ...c, isStranger: false } : c,
      ),
    }));
  });
  socket.on("new-group-created", (conversation) => {
    const formattedParticipants = (conversation.participants || []).map(
      (p: any) => ({
        // Thêm || p._id và || p.displayName để dự phòng
        _id: p.userId?._id || p._id,
        displayName: p.userId?.displayName || p.displayName,
        avatarUrl: p.userId?.avatarUrl || p.avatarUrl || null,
        joinedAt: p.joinedAt,
        lastReadMessageId: p.lastReadMessageId?.toString() ?? null,
        role: p.role,
      }),
    );

    const formattedConvo = {
      ...conversation,
      participants: formattedParticipants,
      unreadCounts: conversation.unreadCounts || {},
    };
    useChatStore.getState().addConversation(formattedConvo);
    socket.emit("join-conversation", { conversationId: conversation._id });
  });
  socket.on("group-updated", (updatedConversation) => {
    useChatStore.setState((state) => {
      const updated = state.conversations.map((c) =>
        c._id === updatedConversation._id
          ? {
              ...c,
              ...updatedConversation,
              // ✅ Gán lastMessage với createdAt = now để sort lên đầu
              lastMessage: {
                ...(updatedConversation.lastMessage || c.lastMessage),
                createdAt: new Date().toISOString(),
              },
            }
          : c,
      );

      return {
        conversations: updated.sort((a, b) => {
          const aTime = a.lastMessage?.createdAt
            ? new Date(a.lastMessage.createdAt).getTime()
            : 0;
          const bTime = b.lastMessage?.createdAt
            ? new Date(b.lastMessage.createdAt).getTime()
            : 0;
          return bTime - aTime;
        }),
      };
    });
  });
  socket.on("member-role-updated", ({ conversationId, targetUserId, role }) => {
    useChatStore
      .getState()
      .updateMemberRole(conversationId, targetUserId, role);
  });
  socket.on("group-join-request", ({ conversationId, request }) => {
    useChatStore.getState().addJoinRequest(request);
  });

  socket.on(
    "join-request-reviewed",
    ({ conversationId, requestId, status }) => {
      if (requestId) {
        useChatStore.getState().removeJoinRequest(requestId);
      }
      if (status === "rejected") {
        console.log(`Yêu cầu vào nhóm ${conversationId} bị từ chối`);
      }
    },
  );

  // Được thêm vào nhóm thành công
  socket.on("added-to-group", ({ conversation }) => {
    const formatted = {
      ...conversation,
      participants: (conversation.participants || []).map((p: any) => ({
        _id: p.userId?._id || p._id,
        displayName: p.userId?.displayName || p.displayName,
        avatarUrl: p.userId?.avatarUrl || p.avatarUrl || null,
        joinedAt: p.joinedAt,
        lastReadMessageId: p.lastReadMessageId?.toString() ?? null,
        role: p.role,
      })),
    };

    const existing = useChatStore
      .getState()
      .conversations.find((c) => c._id === formatted._id);

    if (existing) {
      useChatStore.getState().updateConversation(formatted);
    } else {
      useChatStore.getState().addConversation(formatted);
    }

    // Join socket room
    socket.emit("join-conversation", { conversationId: formatted._id });
  });
  socket.on("group-settings-updated", ({ conversationId, settings }) => {
    useChatStore.setState((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === conversationId && c.group
          ? { ...c, group: { ...c.group, settings } }
          : c,
      ),
    }));
  });

  // Trong handler
  socket.on("removed-from-group", ({ conversationId }) => {
    const { activeConversationId } = useChatStore.getState();

    useChatStore.setState((state) => ({
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

    // ✅ Tự navigate về nếu đang ở trong conversation đó
    if (activeConversationId === conversationId) {
      navigationHelper.goToTabs();
    }
  });
  socket.on("join-request-resolved", ({ requestId }) => {
    useChatStore.getState().removeJoinRequest(requestId);
  });
};

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],

  connectSocket: () => {
    const accessToken = useAuthStore.getState().accessToken;
    const existingSocket = get().socket;

    // reuse nếu còn sống
    if (existingSocket && existingSocket.connected) {
      registerSocketEvents(existingSocket, set);
      return;
    }

    const socket: Socket = io(baseURL, {
      auth: { token: accessToken },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    set({ socket });
    registerSocketEvents(socket, set);
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null, onlineUsers: [] });
    }
  },
}));
