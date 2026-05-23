// lib/axios.ts
import { useAuthStore } from "@/stores/useAuthStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { getDeviceId } from "@/utils/device";

const refreshInstance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

api.interceptors.request.use(
  (config) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        console.log("🔄 Access Token hết hạn, đang gọi Refresh Token...");

        // ✅ Lấy refreshToken và deviceId trước khi gọi
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        const deviceId = await getDeviceId();

        console.log("refreshToken:", refreshToken);
        console.log("deviceId:", deviceId);

        // ✅ Gửi đúng body lên server
        const res = await refreshInstance.post("/auth/refresh", {
          refreshToken,
          deviceId,
        });

        const newAccessToken = res.data.accessToken;
        useAuthStore.getState().setAccessToken(newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        console.log("✅ Refresh thành công");
        return api(originalRequest);
      } catch (refreshError: any) {
        const status = refreshError?.response?.status;
        const message = refreshError?.response?.data?.message ?? "";

        if (
          status === 403 ||
          (status === 401 && message === "Refresh token không tồn tại")
        ) {
          await useAuthStore.getState().clearState();
          useAuthStore
            .getState()
            .setForceLogoutMessage(
              "Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác.",
            );
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
