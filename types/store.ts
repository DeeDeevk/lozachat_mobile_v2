import type { UploadAttachmentResponse } from "@/services/chatService";
import type { Socket } from "socket.io-client";
import type { Conversation, Message } from "./chat";

export interface ChatState {
  conversations: Conversation[];
  messages: Record<
    string,
    {
      items: Message[];
      hasMore: boolean; // infinite-scroll
      nextCursor?: string | null;
    }
  >;
  activeConversationId: string | null;
  convoLoading: boolean;
  messageLoading: boolean;
  reset: () => void;
  setActiveConversation: (id: string | null) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (conversationId?: string) => Promise<void>;
  updateLastRead: (
    userId: string,
    conversationId: string,
    lastReadMessageId: string,
  ) => void;
  sendDirectMessage: (
    recipientId: string,
    payload: {
      content?: string;
      imgUrl?: string;
    },
  ) => Promise<void>;
  sendGroupMessage: (
    conversationId: string,
    payload: {
      content?: string;
      imgUrl?: string;
    },
  ) => Promise<void>;
  uploadAttachment: (file: File) => Promise<UploadAttachmentResponse>;
  // add message
  addMessage: (message: Message) => Promise<void>;
  // update convo
  updateConversation: (conversation: Conversation) => void;
  //xoa
  recallMessage: (messageId: string, conversationId: string) => Promise<void>;
  applyRecallMessage: (messageId: string, conversationId: string) => void;
  deleteMessageForMe: (
    messageId: string,
    conversationId: string,
  ) => Promise<void>;
  addConversation: (conversation: Conversation) => void;
  typingUsersByConv: Record<string, string[]>;
  addTypingUser: (userId: string, conversationId: string) => void;
  removeTypingUser: (userId: string, conversationId: string) => void;
  clearTypingUsers: (conversationId: string) => void;
  updateStrangerStatus: (
    conversationId: string,
    action: "accepted" | "declined",
  ) => Promise<void>;
}

export interface FriendUpdateEvent {
  action: string;
  targetUserId?: string;
  senderId?: string;
  receiverId?: string;
  fromUserId?: string;
  requestId?: string;
  newFriend?: { _id: string; displayName: string; avatarUrl: string };
  deleteMessageForMe: (
    messageId: string,
    conversationId: string,
  ) => Promise<void>;
  addConversation: (conversation: Conversation) => void;
  typingUsersByConv: Record<string, string[]>;
  addTypingUser: (userId: string, conversationId: string) => void;
  removeTypingUser: (userId: string, conversationId: string) => void;
  clearTypingUsers: (conversationId: string) => void;
}

export interface SocketState {
  socket: Socket | null;
  onlineUsers: string[];
  connectSocket: () => void;
  disconnectSocket: () => void;
}
