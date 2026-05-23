import type { SignInData, SignUpData } from "@/services/authService";
import { authService } from "@/services/authService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import { decode as atob } from "base-64";
import Toast from "react-native-toast-message";
import { create } from "zustand";
import { createJSONStorage, persist, StateStorage } from "zustand/middleware";
import { useSocketStore } from "./useSocketStore";

// ✅ Custom async-safe storage
const asyncStorage: StateStorage = {
  getItem: async (name) => {
    const value = await AsyncStorage.getItem(name);
    return value ?? null;
  },
  setItem: async (name, value) => {
    await AsyncStorage.setItem(name, value);
  },
  removeItem: async (name) => {
    await AsyncStorage.removeItem(name);
  },
};

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

interface User {
  userId: string;
  username: string;
  role: string;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  forceLogoutMessage: string | null;
  clearForceLogout: () => void;
  signIn: (data: SignInData) => Promise<boolean>;
  signUp: (data: SignUpData) => Promise<boolean>;
  signOut: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  clearError: () => void;
  refresh: () => Promise<void>;
  clearState: () => Promise<void>;
  setAccessToken: (accessToken: string) => void;
  setUserProfile: (user: UserProfile) => void;
  setForceLogoutMessage: (message: string) => void;
  _hasHydrated: boolean;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      userProfile: null,
      loading: false,
      error: null,
      forceLogoutMessage: null,

      setAccessToken: (accessToken) => set({ accessToken }),
      setUserProfile: (user) => set({ userProfile: user }),
      clearForceLogout: () => set({ forceLogoutMessage: null }),

      // ✅ Xóa toàn bộ storage liên quan
      clearState: async () => {
        await Promise.all([
          AsyncStorage.removeItem("auth-storage"),
          AsyncStorage.removeItem("refreshToken"), // ✅ Xóa luôn refreshToken riêng
        ]);

        set({
          accessToken: null,
          user: null,
          loading: false,
          userProfile: null,
          error: null,
        });
      },

      signIn: async (data) => {
        set({ loading: true, error: null });

        await get().clearState();

        try {
          const response = await authService.signIn(data);
          const token = response.accessToken;

          const payload = JSON.parse(atob(token.split(".")[1]));

          set({
            accessToken: token,
            user: {
              userId: payload.userId,
              username: payload.username,
              role: payload.role,
            },
            loading: false,
          });

          await get().fetchCurrentUser();
          useSocketStore.getState().connectSocket();

          Toast.show({
            type: "success",
            text1: "Thành công",
            text2: response.message,
          });
          return true;
        } catch (error) {
          const axiosError = error as AxiosError<{ message: string }>;
          const errorMessage =
            axiosError.response?.data?.message || "Đăng nhập thất bại";
          set({ loading: false, error: errorMessage });
          Toast.show({ type: "error", text1: "Lỗi", text2: errorMessage });
          return false;
        }
      },

      signUp: async (data: SignUpData) => {
        set({ loading: true, error: null });
        try {
          const response = await authService.signUp(data);
          Toast.show({
            type: "success",
            text1: "Đăng ký thành công",
            text2: response.message,
          });
          set({ loading: false });
          return true;
        } catch (error) {
          const axiosError = error as AxiosError<{ message: string }>;
          const errorMessage =
            axiosError.response?.data?.message || "Đăng ký tài khoản thất bại";
          set({ loading: false, error: errorMessage });
          Toast.show({
            type: "error",
            text1: "Lỗi đăng ký",
            text2: errorMessage,
          });
          return false;
        }
      },

      signOut: async () => {
        try {
          // ✅ BƯỚC 1: Gọi API trước — lúc này refreshToken vẫn còn trong AsyncStorage
          // authService.signOut() sẽ đọc refreshToken và gửi lên server để xóa session
          await authService.signOut();
        } catch (error) {
          const axiosError = error as AxiosError;
          const status = axiosError.response?.status;

          // 400/401 bình thường — token hết hạn hoặc session không tồn tại
          if (status !== 400 && status !== 401) {
            console.error("Lỗi đăng xuất không mong muốn:", error);
          }
        } finally {
          // ✅ BƯỚC 2: Sau khi API xong mới disconnect socket và clear state
          useSocketStore.getState().disconnectSocket();
          await get().clearState(); // xóa auth-storage + refreshToken

          Toast.show({
            type: "success",
            text1: "Thông báo",
            text2: "Đăng xuất thành công",
          });
        }
      },

      fetchCurrentUser: async () => {
        set({ loading: true, error: null });
        try {
          const response = await authService.getCurrentUser();
          set({
            userProfile: response,
            loading: false,
          });
        } catch (error) {
          const axiosError = error as AxiosError<{ message: string }>;
          const errorMessage =
            axiosError.response?.data?.message || "Lấy thông tin user thất bại";
          set({ loading: false, error: errorMessage });
          Toast.show({
            type: "error",
            text1: "Lỗi lấy user",
            text2: errorMessage,
          });
        }
      },

      // useAuthStore.ts (mobile) — sửa hàm refresh()
      refresh: async () => {
        try {
          set({ loading: true });
          const { user, fetchCurrentUser, setAccessToken } = get();
          const accessToken = await authService.refresh();
          setAccessToken(accessToken);
          if (!user) {
            await fetchCurrentUser();
          }
        } catch (error) {
          const axiosError = error as AxiosError<{ message: string }>;
          const status = axiosError.response?.status;
          const message = axiosError.response?.data?.message ?? "";

          console.log("=== STORE REFRESH CATCH ===");
          console.log("status:", status);
          console.log("message:", message);

          if (status === 403) {
            await get().clearState();
            set({
              forceLogoutMessage:
                "Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác.",
            });
            return;
          }

          // ✅ Phân biệt qua message vì backend dùng 401 cho cả 2 TH
          if (
            status === 401 &&
            message === "Refresh token không tồn tại" // ← Đúng message backend trả về
          ) {
            await get().clearState();
            set({
              forceLogoutMessage:
                "Tài khoản của bạn vừa được đăng nhập trên một thiết bị khác.",
            });
            return;
          }

          // Lỗi khác → không làm gì
        } finally {
          set({ loading: false });
        }
      },
      
      clearError: () => set({ error: null }),
      setForceLogoutMessage: (message) => set({ forceLogoutMessage: message }),
      _hasHydrated: false,
      setHydrated: () => set({ _hasHydrated: true }),
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        userProfile: state.userProfile,
      }),
      // ✅ Gọi sau khi AsyncStorage load xong
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
