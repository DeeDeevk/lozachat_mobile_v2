// components/AppInit.tsx
import { useAuthStore } from "@/stores/useAuthStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef } from "react";

export default function AppInit() {
  const refresh = useAuthStore((s) => s.refresh);
  const accessToken = useAuthStore((s) => s.accessToken);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const hasCalled = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (hasCalled.current) return;
    hasCalled.current = true;

    const init = async () => {
      const refreshToken = await AsyncStorage.getItem("refreshToken");

      console.log("=== APP INIT ===");
      console.log("accessToken:", accessToken);
      console.log("refreshToken:", refreshToken);

      // ✅ Chỉ gọi refresh khi CÓ ĐỦ cả 2
      if (accessToken && refreshToken) {
        void refresh();
      } else {
        // ✅ Thiếu token → clear state sạch, không hiện dialog
        await useAuthStore.getState().clearState();
      }
    };

    void init();
  }, [hasHydrated]);

  return null;
}