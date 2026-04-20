import type { UploadAttachmentResponse } from "@/services/chatService";
import type { Socket } from "socket.io-client";
import type {
  Conversation,
  Message,
  MessageReaction,
  PinnedMessage,
} from "./chat";

export interface GroupJoinRequest {
  _id: string;
  conversationId: string;
  invitedUserId: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
  invitedBy: {
    _id: string;
    displayName: string;
    avatarUrl?: string;
  };
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

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
  sendDirectMessage: (
    recipientId: string,
    payload: {
      content?: string;
      imgUrl?: string;
    },
    conversationId?: string,
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
  //update
  editMessage: (
    messageId: string,
    conversationId: string,
    content: string,
  ) => Promise<void>;
  applyEditMessage: (
    messageId: string,
    conversationId: string,
    newContent: string,
    editedAt: string,
  ) => void;
  reactMessage: (
    messageId: string,
    conversationId: string,
    emoji: string,
  ) => Promise<void>;
  applyMessageReactions: (
    messageId: string,
    conversationId: string,
    reactions: MessageReaction[],
  ) => void;
  togglePinMessage: (
    messageId: string,
    conversationId: string,
  ) => Promise<void>;
  fetchPinnedMessages: (conversationId: string) => Promise<PinnedMessage[]>;
  applyPinnedMessages: (
    conversationId: string,
    pinnedMessages: PinnedMessage[],
  ) => void;
  updateConversationTheme: (
    conversationId: string,
    themeId: string,
  ) => Promise<void>;
  updateLastRead: (
    userId: string,
    conversationId: string,
    messageId: string,
  ) => void;
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
  forwardMessage: (
    message: Message,
    targetConversationIds: string[],
  ) => Promise<void>;
  createConversation: (patload: {
    type: "group" | "direct";
    name?: string;
    memberIds: string[];
  }) => Promise<void>;
  updateMemberRole: (
    conversationId: string,
    targetUserId: string,
    role: "admin" | "member",
  ) => void;
  joinRequests: Record<string, GroupJoinRequest[]>;
  addMemberToGroup: (
    conversationId: string,
    targetUserId: string,
  ) => Promise<{ needsApproval: boolean }>;

  reviewJoinRequest: (
    conversationId: string,
    requestId: string,
    action: "approved" | "rejected",
  ) => Promise<void>;

  fetchJoinRequests: (conversationId: string) => Promise<void>;

  addJoinRequest: (request: GroupJoinRequest) => void;

  addMemberToConversation: (
    conversationId: string,
    member: Conversation["participants"][0],
  ) => void;
}

export interface FriendUpdateEvent {
  action: string;
  targetUserId?: string;
  senderId?: string;
  receiverId?: string;
  fromUserId?: string;
  requestId?: string;
  newFriend?: { _id: string; displayName: string; avatarUrl: string };
}

export interface SocketState {
  socket: Socket | null;
  onlineUsers: string[];
  connectSocket: () => void;
  disconnectSocket: () => void;
}
