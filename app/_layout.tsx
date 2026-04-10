import { Tabs } from "expo-router";
import { MessageSquare } from "lucide-react-native"; // Dùng Lucide cho xịn
import React from "react";
import { Platform } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#3b82f6", // Màu xanh đặc trưng của Loza
        tabBarInactiveTintColor: "#64748b",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0a1628",
          borderTopWidth: 1,
          borderTopColor: "rgba(255,255,255,0.05)",
          height: Platform.OS === "ios" ? 88 : 64,
          paddingBottom: Platform.OS === "ios" ? 30 : 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Chat",
          tabBarIcon: ({ color }) => <MessageSquare size={24} color={color} />,
          tabBarStyle: { display: "none" },
        }}
      />
      {/* Nếu bạn có thêm file setting.tsx thì thêm Screen ở đây */}
    </Tabs>
  );
}
