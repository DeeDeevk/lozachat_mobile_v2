import api from "@/lib/axios";
import type {
  ConversationResponse,
  Message,
  MessageReaction,
  PinnedMessage,
} from "@/types/chat";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

// 🔥 helper gắn accessToken vào header
const getAuthHeader = async () => {
  const token = await AsyncStorage.getItem("accessToken");
  return {
    Authorization: `Bearer ${token}`,
  };
};

export const chatService = {
  async fetchConversations(): Promise<ConversationResponse> {
    const headers = await getAuthHeader();
    const res = await api.get("/conversations", { headers });
    return res.data;
  },

  async fetchMessages(id: string, cursor?: string): Promise<FetchMessageProps> {
    const headers = await getAuthHeader();

    const res = await api.get(`/conversations/${id}/messages`, {
      params: {
        limit: pageLimit,
        cursor,
      },
      headers,
    });

    return { messages: res.data.messages, cursor: res.data.nextCursor };
  },

  async sendDirectMessages(
    recipientId: string,
    content: string = "",
    imgUrl: string = "",
    conversationId?: string,
  ) {
    const headers = await getAuthHeader();

    const res = await api.post(
      "/messages/direct",
      {
        recipientId,
        content,
        imgUrl,
        conversationId,
      },
      { headers },
    );

    return res.data.message;
  },

  async sendGroupMessages(
    conversationId: string,
    content: string = "",
    imgUrl?: string,
  ) {
    const headers = await getAuthHeader();

    const res = await api.post(
      "/messages/group",
      {
        conversationId,
        content,
        imgUrl,
      },
      { headers },
    );

    return res.data.message;
  },

  async uploadAttachment(file: any): Promise<UploadAttachmentResponse> {
    const headers = await getAuthHeader();

    const formData = new FormData();
    formData.append("file", {
      uri: file.uri,
      name: file.fileName || "upload.jpg",
      type: file.type || "image/jpeg",
    } as any);

    const res = await api.post("/messages/upload", formData, {
      headers: {
        ...headers,
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data;
  },

  async getOrCreateDirectConversation(targetUserId: string) {
    const headers = await getAuthHeader();
    const res = await api.get(`/conversations/direct/${targetUserId}`, {
      headers,
    });
    return res.data.conversation;
  },

  async recallMessage(messageId: string): Promise<void> {
    const headers = await getAuthHeader();
    await api.patch(`/messages/${messageId}/recall`, {}, { headers });
  },

  async deleteMessageForMe(messageId: string): Promise<void> {
    const headers = await getAuthHeader();
    await api.delete(`/messages/${messageId}`, { headers });
  },

  async editMessage(messageId: string, content: string): Promise<Message> {
    const headers = await getAuthHeader();

    const res = await api.patch(
      `/messages/${messageId}/edit`,
      { content },
      { headers },
    );

    return res.data.message;
  },

  async reactMessage(
    messageId: string,
    emoji: string,
  ): Promise<{ reactions: MessageReaction[] }> {
    const headers = await getAuthHeader();

    const res = await api.patch(
      `/messages/${messageId}/react`,
      { emoji },
      { headers },
    );

    return { reactions: res.data.reactions || [] };
  },

  async pinMessage(
    messageId: string,
  ): Promise<{ conversationId: string; pinnedMessages: PinnedMessage[] }> {
    const headers = await getAuthHeader();

    const res = await api.patch(`/messages/${messageId}/pin`, {}, { headers });

    return {
      conversationId: res.data.conversationId,
      pinnedMessages: res.data.pinnedMessages || [],
    };
  },

  async fetchPinnedMessages(
    conversationId: string,
  ): Promise<{ pinnedMessages: PinnedMessage[] }> {
    const headers = await getAuthHeader();

    const res = await api.get(
      `/conversations/${conversationId}/pinned-messages`,
      { headers },
    );

    return { pinnedMessages: res.data.pinnedMessages || [] };
  },

  async updateConversationTheme(conversationId: string, themeId: string) {
    const headers = await getAuthHeader();

    const res = await api.patch(
      `/conversations/${conversationId}/theme`,
      { themeId },
      { headers },
    );

    return res.data;
  },
};
