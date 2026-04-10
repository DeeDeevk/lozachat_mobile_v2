import { getDeviceId } from "@/utils/device";
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
  signIn: async (data: SignInData) => {
    const deviceId = await getDeviceId(); // thêm dòng này

    const res = await api.post(
      "/auth/signin",
      {
        ...data,
        deviceId, // gửi lên backend
      },
      {
        withCredentials: true,
      },
    );

    return res.data;
  },

  signUp: async (data: SignUpData) => {
    const res = await api.post("/auth/signup", data, {
      withCredentials: true,
    });
    return res.data;
  },

  signOut: async () => {
    const res = await api.post(
      "/auth/signout",
      {},
      {
        withCredentials: true,
      },
    );
    return res.data;
  },

  getCurrentUser: async () => {
    const res = await api.get("/users/me");
    console.log("res", res.data.user);
    return res.data.user;
  },

  refresh: async () => {
    const res = await api.post("/auth/refresh", { withCredentials: true });
    return res.data.accessToken;
  },
};
