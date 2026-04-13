import api from "@/lib/axios";

interface UserProfile {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  role: string;
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

export const userService = {
  updateMe: async (payload: UpdateProfilePayload): Promise<UpdateProfileResponse> => {
    console.log('Calling updateMe with:', payload);
    console.log('Base URL:', api.defaults.baseURL);
    console.log('Headers:', api.defaults.headers);
    const res = await api.put("/users/me", payload);
    console.log('Response:', res.status, res.data);
    return res.data;
    },

  uploadAvatar: async (file: File): Promise<{ message: string; user: UserProfile }> => {
    const formData = new FormData();
    formData.append("avatar", file);

    const res = await api.post("/users/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  deleteMe: async (): Promise<{ message: string }> => {
    const res = await api.delete("/users/me");
    return res.data;
  },
};