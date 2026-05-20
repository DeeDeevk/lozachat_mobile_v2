import type { SignInData, SignUpData } from "@/services/authService";
import { authService } from "@/services/authService"; // Đảm bảo service này cũng dùng Axios cho mobile
import AsyncStorage from "@react-native-async-storage/async-storage"; // Thay cho localStorage
import { AxiosError } from "axios";
import { decode as atob } from "base-64";
import Toast from "react-native-toast-message"; // Thay cho sonner
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useSocketStore } from "./useSocketStore";

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
  clearState: () => void;
  setAccessToken: (accessToken: string) => void;
  setUserProfile: (user: UserProfile) => void;
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

      signIn: async (data) => {
        set({ loading: true, error: null });

        // localStorage.clear(); -> Thay bằng:
        get().clearState();

        try {
          const response = await authService.signIn(data);
          const token = response.accessToken;

          // Giải mã JWT trên mobile (atob có thể cần polyfill hoặc dùng thư viện jwt-decode)
          // Cách nhanh nhất là dùng decode thủ công hoặc cài 'base-64'
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
          // useChatStore.getState().fetchConversations(); // Mở lại khi đã có ChatStore
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

      fetchMe: async () => {
        try {
          set({ loading: true });
          const user = await authService.fetchMe();
          set({ user });
        } catch (error) {
          console.error(error);
          set({ user: null, accessToken: null });
          Toast.show({
            type: "error",
            text1: "Lỗi",
            text2: "Lỗi xảy ra khi lấy dữ liệu người dùng. Hãy thử lại!",
          });
        } finally {
          set({ loading: false });
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
          await authService.signOut();
        } catch (error) {
          console.error("Lỗi đăng xuất:", error);
        } finally {
          useSocketStore.getState().disconnectSocket();
          set({
            accessToken: null,
            user: null,
            userProfile: null,
            error: null,
          });

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
          console.error("Refresh token lỗi:", error);

          try {
            // 🔥 gọi API xoá session phía server
            await authService.signOut();
          } catch (e) {
            console.warn("Không gọi được API logout:", e);
          }

          // 🔥 clear toàn bộ state phía client
          get().clearState();

          // toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
        } finally {
          set({ loading: false });
        }
      },

      clearError: () => set({ error: null }),

      clearState: () => {
        set({
          accessToken: null,
          user: null,
          loading: false,
          userProfile: null,
          forceLogoutMessage: null,
        });
        AsyncStorage.removeItem("auth-storage");
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage), // QUAN TRỌNG: Cấu hình dùng AsyncStorage
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        userProfile: state.userProfile,
        forceLogoutMessage: state.forceLogoutMessage,
      }),
    },
  ),
);
