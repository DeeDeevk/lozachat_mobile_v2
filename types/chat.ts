export interface Participant {
  _id: string;
  displayName: string;
  avatarUrl?: string | null;
  joinedAt: string;
  lastReadMessageId?: string;
}

export interface SeenUser {
  _id: string;
  displayName?: string;
  avatarUrl?: string | null;
}

export interface Group {
  name: string;
  createdBy: string;
  avatar?: string; // thêm dòng này
}

export interface LastMessage {
  _id: string;
  content: string;
  createdAt: string;
  sender: {
    _id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

export interface Conversation {
  _id: string;
  type: "direct" | "group";
  group: Group;
  participants: Participant[];
  lastMessageAt: string;
  seenBy: SeenUser[];
  lastMessage: LastMessage | null;
  unreadCounts: Record<string, number>; // key = userId, value = unread count
  createdAt: string;
  updatedAt: string;
  isStranger: boolean;
  strangerStatus: "pending" | "accepted" | "declined";
  initiatorId?: string;
}

export interface ConversationResponse {
  conversations: Conversation[];
}

export interface Message {
  _id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  imgUrl?: string | null;
  updatedAt?: string | null;
  createdAt: string;
  isOwn?: boolean;
  isRecalled?: boolean;
  recalledAt?: string;
  deletedFor?: string[];
}

export type ChatMessageKind =
  | "text"
  | "emoji"
  | "reply"
  | "image"
  | "file"
  | "audio"
  | "sticker"
  | "poll"
  | "poll_vote";

export interface ChatAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
}

export interface PollOption {
  id: string;
  label: string;
}

export interface PollVote {
  pollId: string;
  userId: string;
  optionId: string;
  userName: string;
}

export interface ReplyMeta {
  messageId: string;
  senderName: string;
  preview: string;
}

export interface ChatStructuredPayload {
  version: 1;
  kind: ChatMessageKind;
  text?: string;
  emoji?: string;
  attachment?: ChatAttachment;
  stickerUrl?: string;
  reply?: ReplyMeta;
  poll?: {
    id: string;
    question: string;
    options: PollOption[];
    createdBy: string;
  };
  pollVote?: PollVote;
}
