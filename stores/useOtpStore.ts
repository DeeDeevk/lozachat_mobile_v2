import { changePasswordService, otpService } from "../services/otpService";
import { create } from "zustand";

interface OtpState {
  loading: boolean;
  message: string | null;
  error: string | null;
  isOtpVerified: boolean;

  sendOTP: (email: string) => Promise<void>;
  sendOTP2: (email: string) => Promise<void>;
  verifyOTP: (email: string, otp: string) => Promise<void>;
  verifyOTP2: (email: string, otp: string) => Promise<void>;
  resetPassword: (email: string, newPassword: string) => Promise<void>;
}

interface ChangePasswordState {
  loading: boolean;
  message: string | null;
  error: string | null;

  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  clearState: () => void;
}

export const useOtpStore = create<OtpState>((set) => ({
  loading: false,
  message: null,
  error: null,
  isOtpVerified: false,

  // 📩 Gửi OTP
  sendOTP: async (email) => {
    try {
      set({ loading: true, error: null, message: null });

      const msg = await otpService.sendOTP(email);

      set({ message: msg, error: null, isOtpVerified: false });
    } catch (error: any) {
      const msg =
        error?.response?.data?.message || error?.message || "Không thể gửi OTP";

      console.error("Lỗi khi gửi OTP", error);
      set({ error: msg, message: null });
    } finally {
      set({ loading: false });
    }
  },

  sendOTP2: async (email) => {
    try {
      set({ loading: true, error: null, message: null });

      const msg = await otpService.sendOTP2(email);

      set({ message: msg, error: null, isOtpVerified: false });
    } catch (error: any) {
      const msg =
        error?.response?.data?.message || error?.message || "Không thể gửi OTP";

      console.error("Lỗi khi gửi OTP", error);
      set({ error: msg, message: null });
    } finally {
      set({ loading: false });
    }
  },

  // ✅ Verify OTP
  verifyOTP: async (email, otp) => {
    try {
      set({ loading: true, error: null, message: null });

      const msg = await otpService.verifyOTP(email, otp);

      set({ message: msg, error: null, isOtpVerified: true });
    } catch (error: any) {
      const msg =
        error?.response?.data?.message || error?.message || "OTP không hợp lệ";

      console.error("Lỗi khi verify OTP", error);
      set({ error: msg, message: null, isOtpVerified: false });
    } finally {
      set({ loading: false });
    }
  },

  verifyOTP2: async (email, otp) => {
    try {
      set({ loading: true, error: null, message: null });

      const msg = await otpService.verifyOTP2(email, otp);

      set({ message: msg, error: null, isOtpVerified: true });
    } catch (error: any) {
      const msg =
        error?.response?.data?.message || error?.message || "OTP không hợp lệ";

      console.error("Lỗi khi verify OTP", error);
      set({ error: msg, message: null, isOtpVerified: false });
    } finally {
      set({ loading: false });
    }
  },

  // 🔐 Reset password (sau khi verify)
  resetPassword: async (email, newPassword) => {
    try {
      set({ loading: true, error: null, message: null });

      const msg = await otpService.resetPassword(email, newPassword);

      set({
        message: msg,
        error: null,
        isOtpVerified: false, // reset lại state
      });
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Không thể đổi mật khẩu";

      console.error("Lỗi khi reset password", error);
      set({ error: msg, message: null });
    } finally {
      set({ loading: false });
    }
  },
}));

export const useChangePasswordStore = create<ChangePasswordState>((set) => ({
  loading: false,
  message: null,
  error: null,

  // 🔐 Change Password
  changePassword: async (oldPassword, newPassword) => {
    try {
      set({ loading: true, error: null, message: null });

      const msg = await changePasswordService.changePassword(
        oldPassword,
        newPassword,
      );

      set({ message: msg, error: null });
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Đổi mật khẩu thất bại";

      console.error("Lỗi change password", error);

      set({ error: msg, message: null });
    } finally {
      set({ loading: false });
    }
  },

  clearState: () =>
    set({
      message: null,
      error: null,
    }),
}));
