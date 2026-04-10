import ConversationList from "@/components/ConversationList";
import { useChatStore } from "@/stores/useChatStore";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";

export default function ConversationScreen() {
  const { conversations, fetchConversations } = useChatStore();
  const router = useRouter();

  useEffect(() => {
    fetchConversations();
  }, []);

  const handleSelect = (id: string) => {
    // Chuyển sang folder chat và truyền conversationId vào URL
    router.push(`/chat/${id}` as any);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <ConversationList
          conversations={conversations}
          onSelectConversation={handleSelect}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080e1c" },
});
