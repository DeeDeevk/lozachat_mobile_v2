import api from "@/lib/axios";

export const friendService = {
  async searchByUserName(username: string) {
    const res = await api.get(`/users/search?username=${username}`);
    return res.data.user;
  },

  async sendFriendRequest(to: string, message?: string) {
    const res = await api.post("/friends/request", { to, message });
    return res.data.message;
  },

  async getAllFriendRequest() {
    try {
      const res = await api.get("/friends/request");
      const { sent, received } = res.data;
      return { sent, received };
    } catch (error) {
      console.error("Lỗi khi lấy yêu cầu kết bạn", error);
    }
  },

  async acceptRequest(requestId: string) {
    try {
      const res = await api.post(`/friends/request/${requestId}/accept`);
      return res.data.requestAcceptedBy;
    } catch (error) {
      console.error("Lỗi khi chấp nhận yêu cầu kết bạn", error);
    }
  },

  async declineRequest(requestId: string) {
    try {
      await api.post(`/friends/request/${requestId}/decline`);
    } catch (error) {
      console.error("Lỗi khi từ chối yêu cầu kết bạn", error);
    }
  },

  async getFriendStatus(targetId: string): Promise<string> {
    const res = await api.get(`/friends/status/${targetId}`);
    const { isFriends, hasSentRequest, hasReceivedRequest } = res.data;

    if (isFriends) return "friend";
    if (hasSentRequest) return "sent";
    if (hasReceivedRequest) return "received";
    return "none";
  },

  async getFriendList() {
    const res = await api.get("/friends");
    return res.data.friends;
  },

  async cancelRequest(requestId: string) {
    try {
      await api.post(`/friends/request/${requestId}/cancel`);
    } catch (error) {
      console.error("Lỗi khi huỷ yêu cầu kết bạn", error);
    }
  },

  async unfriend(targetId: string) {
    try {
      const res = await api.delete(`/friends/${targetId}`);
      return res.data.message;
    } catch (error) {
      console.error("Lỗi khi huỷ kết bạn", error);
    }
  },
};
