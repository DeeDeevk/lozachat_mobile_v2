import api from "@/lib/axios";
import type { ConversationResponse, Message } from "@/types/chat";

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
    action: "accepted" | "decline",
  ): Promise<void> {
    await api.patch(`/conversations/${conversationId}/stranger-status`, {
      action,
    });
  },

    async pinMessage(conversationId: string, messageId: string): Promise<Message[]> {
    const res = await api.post(`/conversations/${conversationId}/pin/${messageId}`);
    return res.data.pinnedMessages;
  },

  async unpinMessage(conversationId: string, messageId: string): Promise<void> {
    await api.delete(`/conversations/${conversationId}/pin/${messageId}`);
  },

  async fetchPinnedMessages(conversationId: string): Promise<Message[]> {
    const res = await api.get(`/conversations/${conversationId}/pins`);
    return res.data.pinnedMessages;
  },
};
