import { useAuthStore } from "@/stores/useAuthStore";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ForceLogoutDialog() {
  const forceLogoutMessage = useAuthStore((s) => s.forceLogoutMessage);
  const clearForceLogout = useAuthStore((s) => s.clearForceLogout);
  const signOut = useAuthStore((s) => s.signOut);
  const [isLoading, setIsLoading] = useState(false);

  if (!forceLogoutMessage) return null;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      clearForceLogout();
      await signOut();
      router.replace("/(auth)/signin");
    } catch (error) {
      console.error("Lỗi khi đăng xuất:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal transparent visible={!!forceLogoutMessage} animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            backgroundColor: "#0f172a",
            borderRadius: 16,
            paddingHorizontal: 28,
            paddingVertical: 32,
            maxWidth: 420,
            width: "100%",
            alignItems: "center",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.1)",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 25 },
            shadowOpacity: 0.5,
            shadowRadius: 60,
            elevation: 5,
          }}
        >
          {/* Warning Icon */}
          <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>

          {/* Title */}
          <Text
            style={{
              color: "white",
              fontSize: 18,
              fontWeight: "700",
              marginBottom: 10,
              textAlign: "center",
            }}
          >
            Phiên đăng nhập bị thay thế
          </Text>

          {/* Message */}
          <Text
            style={{
              color: "#94a3b8",
              fontSize: 14,
              lineHeight: 24,
              textAlign: "center",
              marginBottom: 28,
            }}
          >
            {forceLogoutMessage}
            {"\n"}
            Nhấn xác nhận để đăng xuất.
          </Text>

          {/* Confirm Button */}
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? "#dc2626" : "#ef4444",
              paddingVertical: 11,
              paddingHorizontal: 36,
              borderRadius: 10,
              minWidth: 120,
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text
                style={{
                  color: "white",
                  fontSize: 14,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                Xác nhận
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
