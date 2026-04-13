import type { Socket } from "socket.io-client";
import type { Conversation, Message } from "./chat";

export interface ChatState {
  conversations: Conversation[];
  messages: Record<
    string,
    {
      items: Message[];
      hashMore: boolean; // infinite-scroll
      nextCursor?: string | null;
    }
  >;
  activeConversationId: string | null;
  convoLoading: boolean;
  messageLoading: boolean;
  reset: () => void;
  setActiveConversation: (id: string | null) => void;
  fetchConversations: () => Promise<void>;
  addTypingUser: (userId: string, conversationId: string) => void;
  removeTypingUser: (userId: string, conversationId: string) => void;
  fetchMessages: (conversationId?: string) => Promise<void>;
  updateLastRead: (
    userId: string,
    conversationId: string,
    lastReadMessageId: string,
  ) => void;
  sendDirectMessage: (
    recipientId: string,
    content: string,
    imgUrl?: string,
  ) => Promise<void>;
  sendGroupMessage: (
    conversationId: string,
    content: string,
    imgUrl?: string,
  ) => Promise<void>;
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
}

export interface SocketState {
  socket: Socket | null;
  onlineUsers: String[];
  connectSocket: () => void;
  disconnectSocket: () => void;
}
