import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowRight, Eye, EyeOff, Lock, User } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useAuthStore } from "../../stores/useAuthStore"; // Import store của bạn

const { width } = Dimensions.get("window");

export default function SignInScreen() {
  const router = useRouter();

  // ── Logic State từ bản Web ──
  const { signIn, loading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState({ username: "", password: "" });

  // ── Handlers từ bản Web ──
  const validate = () => {
    const e = { username: "", password: "" };
    if (!formData.username.trim()) e.username = "Vui lòng nhập tên đăng nhập";
    else if (formData.username.length < 3)
      e.username = "Tên đăng nhập tối thiểu 3 ký tự";

    if (!formData.password.trim()) e.password = "Vui lòng nhập mật khẩu";
    else if (formData.password.length < 6)
      e.password = "Mật khẩu tối thiểu 6 ký tự";

    setErrors(e);
    return !e.username && !e.password;
  };

  const handleSignIn = async () => {
    if (!validate()) return;

    const success = await signIn(formData);
    if (success) {
      router.replace("/(tabs)");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.bgGlowContainer}>
        <View
          style={[
            styles.glow,
            {
              top: "10%",
              left: "-20%",
              backgroundColor: "rgba(37,99,235,0.15)",
            },
          ]}
        />
        <View
          style={[
            styles.glow,
            {
              bottom: "10%",
              right: "-20%",
              backgroundColor: "rgba(99,102,241,0.1)",
            },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.header}>
            <View style={styles.logoOuterGlow}>
              <View style={styles.logoWrapper}>
                {/* ── ĐÃ XÓA LINEARGRADIENT Ở ĐÂY ── */}
                <Image
                  source={require("../../assets/images/icon.png")}
                  // Cập nhật style cho ảnh để nó căn giữa
                  style={styles.mainLogoTransparent}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={styles.appTitle}>Loza</Text>
            <Text style={styles.appSubtitle}>Connect with the future</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.delay(400)} style={styles.formCard}>
            <Text style={styles.welcomeText}>Chào mừng quay lại</Text>
            <Text style={styles.instructionText}>
              Đăng nhập vào tài khoản Loza của bạn
            </Text>

            {/* Input Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tên đăng nhập hoặc email</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === "user" && styles.inputFocused,
                  errors.username ? styles.inputError : null,
                ]}
              >
                <User
                  size={18}
                  color={focusedField === "user" ? "#3b82f6" : "#64748b"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Nhập tên đăng nhập hoặc email"
                  placeholderTextColor="rgba(148,163,184,0.5)"
                  value={formData.username}
                  onChangeText={(txt) =>
                    setFormData({ ...formData, username: txt })
                  }
                  onFocus={() => setFocusedField("user")}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="none"
                />
              </View>
              {errors.username ? (
                <Text style={styles.errorText}>{errors.username}</Text>
              ) : null}
            </View>

            {/* Input Password */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Mật khẩu</Text>
                <TouchableOpacity
                  onPress={() => {
                    router.push("/(auth)/forgot");
                  }}
                >
                  <Text style={styles.forgotText}>Quên mật khẩu?</Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === "pass" && styles.inputFocused,
                  errors.password ? styles.inputError : null,
                ]}
              >
                <Lock
                  size={18}
                  color={focusedField === "pass" ? "#3b82f6" : "#64748b"}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(148,163,184,0.5)"
                  secureTextEntry={!showPassword}
                  value={formData.password}
                  onChangeText={(txt) =>
                    setFormData({ ...formData, password: txt })
                  }
                  onFocus={() => setFocusedField("pass")}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="#94a3b8" />
                  ) : (
                    <Eye size={18} color="#94a3b8" />
                  )}
                </TouchableOpacity>
              </View>
              {errors.password ? (
                <Text style={styles.errorText}>{errors.password}</Text>
              ) : null}
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={styles.loginBtn}
              activeOpacity={0.8}
              onPress={handleSignIn}
              disabled={loading}
            >
              <LinearGradient
                colors={["#2563eb", "#3b82f6"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.btnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text style={styles.loginBtnText}>Đăng nhập</Text>
                    <ArrowRight color="white" size={18} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/signup")}>
                <Text style={styles.signUpText}>Đăng ký</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
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
  header: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 20,
  },
  logoOuterGlow: {
    padding: 8,
    borderRadius: 28,
    // Đổ bóng màu xanh tạo hiệu ứng phát sáng (Glow) quanh khung
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8, // Tăng nhẹ độ đậm của glow
    shadowRadius: 20,
    elevation: 25,
  },
  logoWrapper: {
    width: 80, // Tăng nhẹ kích thước khung
    height: 80,
    borderRadius: 20,
    // XÓA overflow: "hidden" ở đây
    justifyContent: "center", // Căn giữa ảnh
    alignItems: "center",
    borderWidth: 1.5, // Tăng nhẹ độ dày viền
    borderColor: "rgba(59, 130, 246, 0.3)", // Dùng màu viền xanh mờ
    backgroundColor: "transparent", // Đảm bảo nền trong suốt
  },
  mainLogoTransparent: {
    width: "85%",
    height: "85%",
  },
  container: { flex: 1, backgroundColor: "#060d1f" },
  bgGlowContainer: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  glow: {
    position: "absolute",
    width: width,
    height: width,
    borderRadius: width / 2,
    opacity: 0.5,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  mainLogo: {
    width: "70%", // Để logo nằm gọn bên trong gradient cho đẹp
    height: "70%",
  },
  appTitle: {
    color: "white",
    fontSize: 28,
    fontWeight: "900", // Tăng độ dày chữ cho chuyên nghiệp
    marginTop: 16,
    letterSpacing: 2, // Tạo độ thoáng cho text
  },
  appSubtitle: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "500",
    opacity: 0.8,
  },
  formCard: {
    backgroundColor: "rgba(10, 16, 32, 0.8)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.15)",
  },
  welcomeText: {
    color: "white",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  instructionText: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  inputGroup: { marginBottom: 20 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: { color: "#cbd5e1", fontSize: 12, fontWeight: "600", marginBottom: 8 },
  forgotText: { color: "#3b82f6", fontSize: 12, fontWeight: "600" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.5)",
    paddingHorizontal: 12,
    height: 52,
  },
  inputFocused: {
    borderColor: "#3b82f6",
    backgroundColor: "rgba(30, 41, 80, 0.9)",
  },
  inputError: { borderColor: "#ef4444" },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: "white", fontSize: 14 },
  errorText: { color: "#ef4444", fontSize: 11, marginTop: 4, marginLeft: 4 },
  loginBtn: { marginTop: 10, borderRadius: 12, overflow: "hidden" },
  btnGradient: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loginBtnText: { color: "white", fontSize: 16, fontWeight: "700" },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(71, 85, 105, 0.3)",
  },
  dividerText: { color: "#475569", marginHorizontal: 10, fontSize: 12 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 10 },
  footerText: { color: "#94a3b8", fontSize: 13 },
  signUpText: { color: "#3b82f6", fontSize: 13, fontWeight: "700" },
});
