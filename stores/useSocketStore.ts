import type { SocketState } from "@/types/store";
import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import { useFriendStore } from "./useFriendStore";

const baseURL = process.env.EXPO_PUBLIC_SOCKET_URL;

const registerSocketEvents = (socket: Socket, set: any) => {
  // Thay vì removeAllListeners (có thể xóa mất internal events),
  // ta off đúng các event ta đã đăng ký giống bản React
  socket.off("connect");
  socket.off("online-users"); // Khớp với BE io.emit("online-users")
  socket.off("new-message");
  socket.off("message-recalled");
  socket.off("friend_update"); // Friend real-time updates

  socket.on("connect", () => {
    console.log("✅ Đã kết nối với socket (Mobile)");
  });

  // Khớp với BE: io.emit("online-users", Array.from(onlineUsers.keys()));
  socket.on("online-users", (userIds) => {
    set({ onlineUsers: userIds });
  });

  // Khớp logic emitNewMessage từ BE
  socket.on("new-message", ({ message, conversation, unreadCounts }) => {
    console.log("📩 Nhận tin nhắn mới via Socket");

    // 1. Thêm tin nhắn vào danh sách tin nhắn đang mở
    useChatStore.getState().addMessage(message);

    // 2. Chuẩn hóa lastMessage để cập nhật danh sách hội thoại bên ngoài
    const lastMessage = {
      _id: message._id,
      content: message.content,
      createdAt: message.createdAt,
      sender: {
        _id: message.senderId,
        displayName: "", // Sẽ được map lại trong component nếu cần
        avatarUrl: null,
      },
    };

    // 3. Cập nhật preview cuộc trò chuyện (giống hệt bản React Web)
    useChatStore.getState().updateConversation({
      ...conversation,
      lastMessage,
      unreadCounts,
    });
  });

  // Khớp với BE: io.to(...).emit("message-recalled")
  socket.on("message-recalled", ({ messageId, conversationId }) => {
    console.log("🚫 Tin nhắn đã bị thu hồi:", messageId);
    useChatStore.getState().applyRecallMessage(messageId, conversationId);
  });

  // Handle real-time friend updates
  socket.on("friend_update", (update: any) => {
    console.log("🔥 Real-time friend update:", update.action);
    useFriendStore.getState().handleRealTimeUpdate(update);
  });
};

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],

  connectSocket: () => {
    const accessToken = useAuthStore.getState().accessToken;
    if (!accessToken) return;

    const existingSocket = get().socket;

    // Nếu socket cũ còn sống thì dùng lại, chỉ đăng ký lại event
    if (existingSocket?.connected) {
      registerSocketEvents(existingSocket, set);
      return;
    }

    console.log("🌐 Đang khởi tạo kết nối Socket...");
    const socket: Socket = io(baseURL as string, {
      auth: { token: accessToken }, // Gửi token qua handshake giống FE React
      transports: ["websocket"],
      forceNew: true,
    });

    set({ socket });
    registerSocketEvents(socket, set);
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      console.log("🔌 Ngắt kết nối socket");
      socket.disconnect();
      set({ socket: null, onlineUsers: [] });
    }
  },
}));
