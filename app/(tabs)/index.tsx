import { SafeAreaView, StyleSheet, Text, View } from "react-native";

export default function ChatPage() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Đoạn chat</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.text}>
          Chào mừng Khoa quay lại! Danh sách chat sẽ hiển thị ở đây.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#060d1f", // Màu nền tối đồng bộ
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  title: {
    color: "white",
    fontSize: 24,
    fontWeight: "800",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  text: {
    color: "#94a3b8",
    textAlign: "center",
    fontSize: 16,
  },
});
