import api from "@/lib/axios";
import type { ConversationResponse, Message } from "@/types/chat";

interface FetchMessageProps {
  messages: Message[];
  cursor?: string;
}

const pageLimit = 50;

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
    imgUrl?: string = "",
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
    const res = await api.post("/message/group", {
      conversationId,
      content,
      imgUrl,
    });

    return res.data.message;
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
};
