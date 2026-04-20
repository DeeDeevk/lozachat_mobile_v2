import type { SocketState } from "@/types/store";
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
  // clear ALL listeners tránh duplicate
  socket.removeAllListeners();

  socket.on("connect", () => {
    console.log("✅ Socket connected:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected");
  });

  // ================= REALTIME CORE =================
  socket.on("online-users", (userIds) => {
    set({ onlineUsers: userIds });
  });

  socket.on("message-read", ({ userId, conversationId, messageId }) => {
    useChatStore.getState().updateLastRead(userId, conversationId, messageId);
  });

  socket.on("user-typing", (payload) => {
    useChatStore
      .getState()
      .addTypingUser(payload.userId, payload.conversationId);
  });

  socket.on("user-stop-typing", ({ userId, conversationId }) => {
    useChatStore.getState().removeTypingUser(userId, conversationId);
  });

  // ================= MESSAGE =================
  socket.on("new-message", ({ message, conversation, unreadCounts }) => {
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

    useChatStore.getState().updateConversation({
      ...conversation,
      lastMessage,
      unreadCounts,
    });
  });

  socket.on("message-recalled", ({ messageId, conversationId }) => {
    useChatStore.getState().applyRecallMessage(messageId, conversationId);
  });

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

  // ================= CONVERSATION =================
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

  socket.on("new-conversation", (conversation) => {
    const existing = useChatStore
      .getState()
      .conversations.find((c) => c._id === conversation.id);

    if (existing) {
      useChatStore.getState().updateConversation(conversation);
    } else {
      useChatStore.getState().addConversation(conversation);
    }

    socket.emit("join-conversation", { conversationId: conversation.id });
  });

  // ================= STRANGER =================
  socket.on("stranger-request", ({ conversation }) => {
    useChatStore.getState().addConversation(conversation);
    socket.emit("join-conversation", { conversationId: conversation._id });
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

  socket.on("stranger-removed", ({ conversationId }) => {
    useChatStore.setState((state) => ({
      conversations: state.conversations.map((c) =>
        c._id === conversationId ? { ...c, isStranger: false } : c,
      ),
    }));
  });

  // ================= GROUP =================
  socket.on("new-group-created", (conversation) => {
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
      unreadCounts: conversation.unreadCounts || {},
    };

    useChatStore.getState().addConversation(formatted);
    socket.emit("join-conversation", { conversationId: conversation._id });
  });

  socket.on("member-role-updated", ({ conversationId, targetUserId, role }) => {
    useChatStore
      .getState()
      .updateMemberRole(conversationId, targetUserId, role);
  });

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

  // ================= FRIEND =================
  socket.on("friend_update", (update) => {
    useFriendStore.getState().handleRealTimeUpdate(update);
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
