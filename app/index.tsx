import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  MessageCircle,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react-native";
import React from "react";
import {
  Dimensions,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInRight, FadeInUp } from "react-native-reanimated";

const { width } = Dimensions.get("window");

const FEATURES = [
  { icon: MessageCircle, title: "Nhắn tin tức thì", color: "#3b82f6" },
  { icon: ShieldCheck, title: "Mã hóa đầu cuối", color: "#10b981" },
  { icon: Users, title: "Nhóm cộng đồng", color: "#8b5cf6" },
  { icon: Zap, title: "Siêu nhanh", color: "#ef4444" },
];

export default function LandingPageMobile() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* --- HERO SECTION --- */}
        <LinearGradient colors={["#060d1f", "#0a1628"]} style={styles.hero}>
          {/* Badge */}
          <Animated.View
            entering={FadeInUp.delay(100)}
            style={styles.logoContainer}
          >
            <Image
              source={require("../assets/images/icon.png")} // Khoa kiểm tra lại đường dẫn file icon.png nhé
              style={styles.mainLogo}
              resizeMode="contain"
            />
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(200)} style={styles.badge}>
            <View style={styles.dot} />
            <Text style={styles.badgeText}>10 triệu+ người dùng tin tưởng</Text>
          </Animated.View>

          {/* Title */}
          <Animated.Text entering={FadeInUp.delay(400)} style={styles.title}>
            Kết nối thế giới{"\n"}
            <Text style={styles.shimmerText}>không giới hạn</Text>
          </Animated.Text>

          <Animated.Text entering={FadeInUp.delay(600)} style={styles.subtitle}>
            Loza là nền tảng nhắn tin thế hệ mới — nhanh, bảo mật, và đẹp đến
            từng pixel.
          </Animated.Text>

          {/* CTAs */}
          <Animated.View
            entering={FadeInUp.delay(800)}
            style={styles.ctaContainer}
          >
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => router.push("/(auth)/signin")}
            >
              <Text style={styles.btnText}>Bắt đầu ngay</Text>
              <ArrowRight color="white" size={18} />
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>

        {/* --- MOCKUP CHAT (Đơn giản hóa từ bản Web) --- */}
        <Animated.View
          entering={FadeInUp.delay(1000)}
          style={styles.mockupContainer}
        >
          <View style={styles.chatWindow}>
            <View style={styles.chatHeader}>
              <View style={styles.headerDots} />
              <Text style={styles.headerTitle}>Loza Chat</Text>
              <View style={[styles.dot, { backgroundColor: "#10b981" }]} />
            </View>
            <View style={styles.chatBody}>
              <View style={styles.bubbleIn}>
                <Text style={styles.bubbleText}>Bạn đã thử Loza chưa? 🚀</Text>
              </View>
              <View style={styles.bubbleOut}>
                <Text style={styles.bubbleText}>
                  Giao diện mobile đẹp quá! 😍
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* --- FEATURES GRID --- */}
        <View style={styles.featureSection}>
          <Text style={styles.sectionTitle}>Tính năng nổi bật</Text>
          <View style={styles.grid}>
            {FEATURES.map((item, index) => (
              <Animated.View
                key={index}
                entering={FadeInRight.delay(index * 200)}
                style={styles.featureCard}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: item.color + "20" },
                  ]}
                >
                  <item.icon color={item.color} size={24} />
                </View>
                <Text style={styles.featureTitle}>{item.title}</Text>
              </Animated.View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    marginBottom: 20,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  mainLogo: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  container: { flex: 1, backgroundColor: "#060d1f" },
  hero: { padding: 24, paddingTop: 60, alignItems: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(37,99,235,0.15)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.3)",
    marginBottom: 24,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
    marginRight: 8,
  },
  badgeText: { color: "#93c5fd", fontSize: 12, fontWeight: "600" },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "white",
    textAlign: "center",
    lineHeight: 42,
  },
  shimmerText: { color: "#60a5fa" },
  subtitle: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 16,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  ctaContainer: { marginTop: 32, width: "100%" },
  btnPrimary: {
    backgroundColor: "#2563eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    gap: 10,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  btnText: { color: "white", fontWeight: "700", fontSize: 16 },

  // Mockup Chat
  mockupContainer: { padding: 20, alignItems: "center" },
  chatWindow: {
    width: width * 0.85,
    backgroundColor: "#0a1628",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.2)",
    overflow: "hidden",
  },
  chatHeader: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "rgba(15,23,42,0.9)",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerDots: {
    width: 30,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTitle: { color: "white", fontSize: 12, fontWeight: "600" },
  chatBody: { padding: 15, gap: 12 },
  bubbleIn: {
    backgroundColor: "#1c264a",
    padding: 10,
    borderRadius: 12,
    borderBottomLeftRadius: 2,
    alignSelf: "flex-start",
  },
  bubbleOut: {
    backgroundColor: "#2563eb",
    padding: 10,
    borderRadius: 12,
    borderBottomRightRadius: 2,
    alignSelf: "flex-end",
  },
  bubbleText: { color: "white", fontSize: 13 },

  // Features
  featureSection: { padding: 24 },
  sectionTitle: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  featureCard: {
    width: "48%",
    backgroundColor: "rgba(15,23,42,0.8)",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  featureTitle: { color: "#e2e8f0", fontWeight: "700", fontSize: 14 },
});
