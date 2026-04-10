import { useRouter } from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
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
import Toast from "react-native-toast-message";
import { useOtpStore } from "../../stores/useOtpStore";

const { width } = Dimensions.get("window");

type ForgotStep = "email" | "otp" | "newpassword" | "done";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { sendOTP, verifyOTP, resetPassword, loading } = useOtpStore();

  // --- States ---
  const [step, setStep] = useState<ForgotStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const otpInputs = useRef<Array<TextInput | null>>([]);

  // --- Timer logic ---
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // --- Handlers ---
  const handleSendEmail = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Toast.show({ type: "error", text1: "Lỗi", text2: "Email không hợp lệ" });
      return;
    }
    await sendOTP(email);
    const { error } = useOtpStore.getState();
    if (!error) {
      setStep("otp");
      setResendTimer(60);
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) return;
    await verifyOTP(email, code);
    const { isOtpVerified } = useOtpStore.getState();
    if (isOtpVerified) setStep("newpassword");
  };

  const handleReset = async () => {
    if (newPassword.length < 6) {
      Toast.show({
        type: "error",
        text1: "Lỗi",
        text2: "Mật khẩu tối thiểu 6 ký tự",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: "error", text1: "Lỗi", text2: "Mật khẩu không khớp" });
      return;
    }
    await resetPassword(email, newPassword);
    const { error } = useOtpStore.getState();
    if (!error) setStep("done");
  };

  const handleOtpChange = (val: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = val.slice(-1);
    setOtp(newOtp);
    if (val && index < 5) otpInputs.current[index + 1]?.focus();
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Nút quay lại */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <ArrowLeft color="#64748b" size={24} />
          </TouchableOpacity>

          <Animated.View entering={FadeInDown.delay(200)} style={styles.header}>
            <View style={styles.iconCircle}>
              {step === "email" && <Mail color="#3b82f6" size={32} />}
              {step === "otp" && <KeyRound color="#3b82f6" size={32} />}
              {step === "newpassword" && <Lock color="#3b82f6" size={32} />}
              {step === "done" && <CheckCircle2 color="#10b981" size={32} />}
            </View>
            <Text style={styles.title}>
              {step === "email" && "Quên mật khẩu?"}
              {step === "otp" && "Xác thực OTP"}
              {step === "newpassword" && "Mật khẩu mới"}
              {step === "done" && "Thành công!"}
            </Text>
            <Text style={styles.subtitle}>
              {step === "email" && "Nhập email của bạn để nhận mã xác thực"}
              {step === "otp" && `Mã đã được gửi đến ${email}`}
              {step === "newpassword" &&
                "Vui lòng nhập mật khẩu mới cực kỳ bảo mật"}
              {step === "done" &&
                "Mật khẩu của bạn đã được cập nhật thành công"}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(400)} style={styles.card}>
            {step === "email" && (
              <View>
                <TextInput
                  style={styles.input}
                  placeholder="example@gmail.com"
                  placeholderTextColor="#475569"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleSendEmail}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.btnText}>Gửi mã OTP</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {step === "otp" && (
              <View>
                <View style={styles.otpRow}>
                  {otp.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(el) => (otpInputs.current[i] = el)}
                      style={styles.otpBox}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onChangeText={(v) => handleOtpChange(v, i)}
                    />
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.btnText}>Xác nhận mã</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={resendTimer > 0}
                  onPress={handleSendEmail}
                >
                  <Text
                    style={[
                      styles.resendText,
                      { color: resendTimer > 0 ? "#475569" : "#3b82f6" },
                    ]}
                  >
                    {resendTimer > 0
                      ? `Gửi lại sau ${resendTimer}s`
                      : "Gửi lại mã"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {step === "newpassword" && (
              <View>
                <TextInput
                  style={[styles.input, { marginBottom: 12 }]}
                  placeholder="Mật khẩu mới"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPass}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Xác nhận mật khẩu"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPass}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleReset}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.btnText}>Đổi mật khẩu</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {step === "done" && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.replace("/(auth)/signin")}
              >
                <Text style={styles.btnText}>Quay lại Đăng nhập</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#060d1f" },
  scrollContent: { flexGrow: 1, padding: 24, paddingTop: 60 },
  backBtn: { marginBottom: 20 },
  header: { alignItems: "center", marginBottom: 40 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(59,130,246,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { color: "white", fontSize: 24, fontWeight: "800", marginBottom: 8 },
  subtitle: {
    color: "#94a3b8",
    textAlign: "center",
    fontSize: 14,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: "rgba(10, 16, 32, 0.8)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  input: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
    color: "white",
    fontSize: 15,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  btnText: { color: "white", fontWeight: "700", fontSize: 16 },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  otpBox: {
    width: 42,
    height: 52,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    textAlign: "center",
    color: "white",
    fontSize: 20,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#334155",
  },
  resendText: { textAlign: "center", marginTop: 20, fontWeight: "600" },
});
