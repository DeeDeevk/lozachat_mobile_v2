import api from "@/lib/axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface LozaBotContextMessage {
  sender: "me" | "other";
  senderName: string;
  at: string;
  content: string;
}

const getAuthHeader = async () => {
  const token = await AsyncStorage.getItem("accessToken");
  return {
    Authorization: `Bearer ${token}`,
  };
};

export const lozaBotService = {
  async ask(payload: {
    conversationId: string;
    request: string;
    fromLastOwnMessage?: boolean;
    messages: LozaBotContextMessage[];
  }): Promise<string> {
    const headers = await getAuthHeader();

    const res = await api.post("/agents/lozabot", payload, { headers });

    return res.data?.answer || "";
  },
};
