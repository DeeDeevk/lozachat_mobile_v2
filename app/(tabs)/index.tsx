import ConversationList from "@/components/ConversationList";
import SearchUserModal from "@/components/SearchUserModal";
import { useChatStore } from "@/stores/useChatStore";
import { useFriendStore } from "@/stores/useFriendStore";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";

export default function ConversationScreen() {
  const { conversations, fetchConversations } = useChatStore();
  const { getAllFriendRequest } = useFriendStore();
  const router = useRouter();
  const [showSearchModal, setShowSearchModal] = useState(false);

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
          onOpenSearch={() => setShowSearchModal(true)}
        />
        <SearchUserModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          onRequestSent={() => getAllFriendRequest()}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#080e1c" },
});
