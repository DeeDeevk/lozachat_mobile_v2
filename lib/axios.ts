import { useAuthStore } from "@/stores/useAuthStore";
import axios from "axios";

// Tạo một instance riêng để refresh nhằm tránh interceptor lặp vô tận
const refreshInstance = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

// 1. Request Interceptor: Luôn đính kèm Token mới nhất từ Zustand
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

// 2. Response Interceptor: Xử lý Refresh Token tự động
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    const ignoredRefreshRoutes = [
      "/auth/signin",
      "/auth/signup",
      "/auth/refresh",
      "/otp/send",
      "/otp/verify",
      "/users/unlock-requests",
    ];

    if (
      ignoredRefreshRoutes.some((route) =>
        originalRequest?.url?.includes(route),
      )
    ) {
      return Promise.reject(error);
    }

    // Nếu lỗi là 401 (Unauthorized) và chưa từng thử lại (retry)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // Đánh dấu đã thử lại lần 1

      try {
        console.log("🔄 Access Token hết hạn, đang gọi Refresh Token...");

        // Gọi API refresh (Dùng refreshInstance để không bị dính cái interceptor này lần nữa)
        const res = await refreshInstance.post(
          "/auth/refresh",
          {},
          {
            // Nếu bạn dùng Cookie, đảm bảo backend hỗ trợ credentials trên mobile
            withCredentials: true,
          },
        );

        const newAccessToken = res.data.accessToken;

        // Lưu token mới vào Zustand Store
        useAuthStore.getState().setAccessToken(newAccessToken);

        // Cập nhật lại header cho request cũ và thực thi lại nó
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        console.log("✅ Refresh thành công, đang thực thi lại request cũ.");
        return api(originalRequest);
      } catch (refreshError) {
        console.error(
          "❌ Refresh Token cũng đã hết hạn hoặc lỗi. Đăng xuất...",
        );

        // Clear toàn bộ data (Token, User) và đá user về màn login
        useAuthStore.getState().clearState();

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
