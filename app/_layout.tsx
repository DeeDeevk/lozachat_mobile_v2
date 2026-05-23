import AppInit from "@/components/AppInit";
import ForceLogoutDialog from "@/components/ForceLogoutDialog";
import { Stack } from "expo-router";
import { useEffect } from "react";
import Toast from "react-native-toast-message";

export default function RootLayout() {

  return (
    <>
    <AppInit />
      <ForceLogoutDialog />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Nhóm không cần login (SignIn, SignUp, Forgot) */}
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

        {/* Nhóm đã login (Thanh Tabbar nằm ở đây) */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Màn hình Landing Page mặc định */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>

      {/* Để Toast ở đây để nó hiện đè lên mọi màn hình */}
      <Toast />
    </>
  );
}
