import api from "@/lib/axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface UserProfile {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  role: string;
  isLocked?: boolean;
  lockedAt?: string;
  lockedReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface UpdateProfilePayload {
  displayName?: string;
  bio?: string;
  phone?: string;
}

interface UpdateProfileResponse {
  message: string;
  user: UserProfile;
}

export type AccountLockRequestStatus = "pending" | "approved" | "rejected";

export interface AccountLockRequest {
  _id: string;
  userId: string | UserProfile;
  reason: string;
  status: AccountLockRequestStatus;
  reviewedBy?: string | Pick<UserProfile, "_id" | "username" | "displayName" | "avatarUrl">;
  reviewedAt?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountUnlockRequest extends AccountLockRequest {}

const getAuthHeader = async () => {
  const token = await AsyncStorage.getItem("accessToken");
  return {
    Authorization: `Bearer ${token}`,
  };
};

export const userService = {
  updateMe: async (
    payload: UpdateProfilePayload,
  ): Promise<UpdateProfileResponse> => {
    const headers = await getAuthHeader();

    const res = await api.put("/users/me", payload, { headers });
    return res.data;
  },

  uploadAvatar: async (
    file: any, // React Native file
  ): Promise<{ message: string; user: UserProfile }> => {
    const headers = await getAuthHeader();

    const formData = new FormData();

    formData.append("avatar", {
      uri: file.uri,
      name: file.fileName || "avatar.jpg",
      type: file.type || "image/jpeg",
    } as any);

    const res = await api.post("/users/avatar", formData, {
      headers: {
        ...headers,
        "Content-Type": "multipart/form-data",
      },
    });

    return res.data;
  },

  deleteMe: async (): Promise<{ message: string }> => {
    const headers = await getAuthHeader();

    const res = await api.delete("/users/me", { headers });
    return res.data;
  },

  requestAccountLock: async (
    reason?: string,
  ): Promise<{ message: string; request: AccountLockRequest }> => {
    const headers = await getAuthHeader();
    const res = await api.post("/users/lock-requests", { reason }, { headers });
    return res.data;
  },

  getMyAccountLockRequests: async (): Promise<{ requests: AccountLockRequest[] }> => {
    const headers = await getAuthHeader();
    const res = await api.get("/users/lock-requests/me", { headers });
    return res.data;
  },

  requestAccountUnlock: async (
    username: string,
    reason: string,
  ): Promise<{ message: string; request: AccountUnlockRequest }> => {
    const res = await api.post("/users/unlock-requests", { username, reason });
    return res.data;
  },
};
