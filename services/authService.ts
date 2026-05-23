import { getDeviceId } from "@/utils/device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../lib/axios";
import axios from "axios";

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

// ✅ Instance riêng, không có interceptor → tránh vòng lặp
const refreshInstance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

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
      console.log("=== LƯU REFRESH TOKEN ===", res.data.refreshToken); // ← Thêm log này
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
      // ✅ Gửi refreshToken trong body và bật withCredentials để gửi cookies
      const res = await api.post(
        "/auth/signout",
        { deviceId, refreshToken },
        { withCredentials: true },
      );
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

  // authService.ts ✅ — thêm deviceId
  refresh: async () => {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    const deviceId = await getDeviceId();

    console.log("=== REFRESH REQUEST ===");
    console.log("status refreshToken:", refreshToken ? "có" : "null");
    console.log("deviceId:", deviceId);

    try {
      const res = await refreshInstance.post("/auth/refresh", {
        refreshToken,
        deviceId,
      });
      console.log("=== REFRESH SUCCESS ===");
      console.log("response:", res.data);
      return res.data.accessToken;
    } catch (error: any) {
      console.log("=== REFRESH FAILED ===");
      console.log("status:", error?.response?.status); // ← Số này quan trọng nhất
      console.log("data:", error?.response?.data);
      throw error;
    }
  },
  fetchMe: async () => {
    const res = await api.get("/users/me", { withCredentials: true });
    return res.data.user;
  },
};
