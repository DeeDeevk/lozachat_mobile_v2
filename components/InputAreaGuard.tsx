import { type ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";

interface InputAreaGuardProps {
  activeConversation: {
    type?: string;
    group?: {
      settings?: {
        whoCanSendMessages?: string;
      };
    };
    participants?: {
      _id: string;
      role?: string;
    }[];
  } | null;
  user?: {
    userId?: string;
  } | null;
  children: ReactNode;
}

export default function InputAreaGuard({
  activeConversation,
  user,
  children,
}: InputAreaGuardProps) {
  const settings = activeConversation?.group?.settings;
  const isGroup = activeConversation?.type === "group";
  const currentParticipant = activeConversation?.participants?.find(
    (p) => p._id === user?.userId,
  );
  const canSend =
    !isGroup ||
    settings?.whoCanSendMessages === "all" ||
    currentParticipant?.role === "owner" ||
    currentParticipant?.role === "admin";

  if (!canSend) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>
          🔒 Chỉ trưởng nhóm và phó nhóm mới được gửi tin nhắn
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.5)",
    marginHorizontal: 12,
    marginVertical: 8,
  },
  text: {
    color: "#64748b",
    fontSize: 13,
    textAlign: "center",
  },
});