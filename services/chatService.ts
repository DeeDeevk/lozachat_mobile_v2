import api from "@/lib/axios";
import type {
  ConversationResponse,
  Message,
  MessageReaction,
  PinnedMessage,
} from "@/types/chat";

interface FetchMessageProps {
  messages: Message[];
  cursor?: string;
}

const pageLimit = 50;

export interface UploadAttachmentResponse {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export const chatService = {
  async fetchConversations(): Promise<ConversationResponse> {
    const res = await api.get("/conversations");
    return res.data;
  },

  async fetchMessages(id: string, cursor?: string): Promise<FetchMessageProps> {
    const res = await api.get(
      `/conversations/${id}/messages?limit=${pageLimit}&cursor=${cursor}`,
    );

    return { messages: res.data.messages, cursor: res.data.nextCursor };
  },

  async sendDirecrMessages(
    recipientId: string,
    content: string = "",
    imgUrl: string = "",
    conversationId?: string,
  ) {
    const res = await api.post("/messages/direct", {
      recipientId,
      content,
      imgUrl,
      conversationId,
    });

    return res.data.message;
  },

  async sendGroupMessages(
    conversationId: string,
    content: string = "",
    imgUrl?: string,
  ) {
    const res = await api.post("/messages/group", {
      conversationId,
      content,
      imgUrl,
    });

    return res.data.message;
  },

  async uploadAttachment(file: File): Promise<UploadAttachmentResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await api.post("/messages/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data;
  },

  async getOrCreateDirectConversation(targetUserId: string) {
    const res = await api.get(`/conversations/direct/${targetUserId}`);

    return res.data.conversation;
  },
  async recallMessage(messageId: string): Promise<void> {
    await api.patch(`/messages/${messageId}/recall`);
  },

  async deleteMessageForMe(messageId: string): Promise<void> {
    await api.delete(`/messages/${messageId}`);
  },

  async updateStrangerStatus(
    conversationId: string,
    action: "accepted" | "declined",
  ): Promise<void> {
    await api.patch(`/conversations/${conversationId}/stranger-status`, {
      action,
    });
  },
  async createConversation(payload: {
    type: "group" | "direct";
    name?: string;
    memberIds: string[];
  }) {
    const res = await api.post("/conversations", payload);
    return res.data.conversation;
  },

  async updateGroupInfo(
    conversationId: string,
    formData: FormData,
  ): Promise<{ message: string; conversation: any }> {
    const res = await api.patch(`/conversations/${conversationId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  async editMessage(messageId: string, content: string): Promise<Message> {
    const res = await api.patch(`/messages/${messageId}/edit`, { content });
    return res.data.message;
  },
  async deleteConversationForMe(conversationId: string): Promise<void> {
    await api.delete(`/conversations/${conversationId}`);
  },
  async leaveGroup(conversationId: string, newOwnerId?: string): Promise<void> {
    await api.post(`/conversations/${conversationId}/leave`, { newOwnerId });
  },
  async removeMember(
    conversationId: string,
    targetUserId: string,
  ): Promise<void> {
    await api.delete(`/conversations/${conversationId}/members`, {
      data: { targetUserId },
    });
  },
  async reactMessage(
    messageId: string,
    emoji: string,
  ): Promise<{ reactions: MessageReaction[] }> {
    const res = await api.patch(`/messages/${messageId}/react`, { emoji });
    return { reactions: res.data.reactions || [] };
  },
  async pinMessage(
    messageId: string,
  ): Promise<{ conversationId: string; pinnedMessages: PinnedMessage[] }> {
    const res = await api.patch(`/messages/${messageId}/pin`);
    return {
      conversationId: res.data.conversationId,
      pinnedMessages: res.data.pinnedMessages || [],
    };
  },
  async fetchPinnedMessages(
    conversationId: string,
  ): Promise<{ pinnedMessages: PinnedMessage[] }> {
    const res = await api.get(
      `/conversations/${conversationId}/pinned-messages`,
    );
    return { pinnedMessages: res.data.pinnedMessages || [] };
  },
  async updateConversationTheme(
    conversationId: string,
    themeId: string,
  ): Promise<{ conversationId: string; themeId: string }> {
    const res = await api.patch(`/conversations/${conversationId}/theme`, {
      themeId,
    });
    return {
      conversationId: res.data.conversationId,
      themeId: res.data.themeId,
    };
  },
  updateMemberRole: async (
    conversationId: string,
    targetUserId: string,
    role: "admin" | "member",
  ) => {
    const response = await api.patch(
      `/conversations/${conversationId}/members/role`,
      {
        targetUserId,
        role,
      },
    );
    return response.data;
  },
  async dissolveGroup(conversationId: string): Promise<void> {
    await api.delete(`/conversations/${conversationId}/dissolve`);
  },
  async addMemberToGroup(conversationId: string, targetUserId: string) {
    const res = await api.post(`/conversations/${conversationId}/members`, {
      targetUserId,
    });
    return res.data;
  },

  async reviewJoinRequest(
    conversationId: string,
    requestId: string,
    action: "approved" | "rejected",
  ) {
    const res = await api.patch(
      `/conversations/${conversationId}/join-requests/${requestId}`,
      { action },
    );
    return res.data;
  },

  async getPendingJoinRequests(conversationId: string) {
    const res = await api.get(`/conversations/${conversationId}/join-requests`);
    return res.data.requests;
  },
  async updateGroupSettings(
    conversationId: string,
    settings: { requireApprovalToJoin?: boolean },
  ) {
    const res = await api.patch(
      `/conversations/${conversationId}/settings`,
      settings,
    );
    return res.data;
  },
};
