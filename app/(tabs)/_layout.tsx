import { Tabs } from "expo-router";
import { Globe, MessageSquare, UserCircle, Users } from "lucide-react-native";
import React from "react";
import { Platform } from "react-native";

import ForceLogoutDialog from "@/components/ForceLogoutDialog";
import { HapticTab } from "@/components/haptic-tab";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <>
      <Tabs
        screenOptions={{
          // Sử dụng màu sắc từ hệ thống theme của Khoa hoặc màu xanh đặc trưng của Loza
          tabBarActiveTintColor: "#3b82f6",
          tabBarInactiveTintColor: "#64748b",
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: "#0a1628", // Nền tối đồng bộ
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.05)",
            height: Platform.OS === "ios" ? 88 : 65,
            paddingBottom: Platform.OS === "ios" ? 30 : 12,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
          },
        }}
      >
        {/* 1. Nhắn tin */}
        <Tabs.Screen
          name="index"
          options={{
            title: "Nhắn tin",
            tabBarIcon: ({ color }) => (
              <MessageSquare size={24} color={color} />
            ),
          }}
        />

        {/* 2. Bạn bè */}
        <Tabs.Screen
          name="friends"
          options={{
            title: "Bạn bè",
            tabBarIcon: ({ color }) => <Users size={24} color={color} />,
          }}
        />

        {/* 3. Khám phá */}
        <Tabs.Screen
          name="explore"
          options={{
            title: "Bảng tin",
            tabBarIcon: ({ color }) => <Globe size={24} color={color} />,
          }}
        />

        {/* 4. Cá nhân */}
        <Tabs.Screen
          name="profile"
          options={{
            title: "Cá nhân",
            tabBarIcon: ({ color }) => <UserCircle size={24} color={color} />,
          }}
        />
      </Tabs>

      {/* Dialog xác nhận khi phiên đăng nhập bị thay thế */}
      <ForceLogoutDialog />
    </>
  );
}
