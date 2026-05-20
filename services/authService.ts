import { getDeviceId } from "@/utils/device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../lib/axios";

export interface SignInData {
  username: string;
  password: string;
}

export interface SignUpData {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
}

export const authService = {
  signIn: async (data: SignInData, forceLogin = true) => {
    const deviceId = await getDeviceId(); // thêm dòng này

    const res = await api.post("/auth/signin", {
      ...data,
      deviceId,
      forceLogin, // ← Gửi forceLogin để backend biết force logout session cũ
    });
    console.log("signIn response:", res.data);

    if (res.data.refreshToken) {
      await AsyncStorage.setItem("refreshToken", res.data.refreshToken);
    }

    return res.data;
  },

  signUp: async (data: SignUpData) => {
    const res = await api.post("/auth/signup", data, {
      withCredentials: true,
    });
    return res.data;
  },

  signOut: async () => {
    const deviceId = await getDeviceId();
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    console.log("refreshToken từ storage:", refreshToken);

    try {
      const res = await api.post("/auth/signout", { deviceId, refreshToken });
      await AsyncStorage.removeItem("refreshToken");
      return res.data;
    } catch (error: any) {
      console.log("Status:", error?.response?.status);
      console.log("Message:", error?.response?.data);
      throw error;
    }
  },

  getCurrentUser: async () => {
    const res = await api.get("/users/me");
    console.log("res", res.data.user);
    return res.data.user;
  },

  refresh: async () => {
    const refreshToken = await AsyncStorage.getItem("refreshToken");

    const res = await api.post("/auth/refresh", { refreshToken });
    return res.data.accessToken;
  },
  fetchMe: async () => {
    const res = await api.get("/users/me", { withCredentials: true });
    return res.data.user;
  },
};
