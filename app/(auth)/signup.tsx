import { useAuthStore } from "../../stores/useAuthStore";
import { useOtpStore } from "../../stores/useOtpStore";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import Toast from "react-native-toast-message";

const { width } = Dimensions.get("window");

// --- Helper: Độ mạnh mật khẩu ---
function getPasswordStrength(password: string) {
  if (!password) return { level: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { level: 1, label: "Yếu", color: "#ef4444" };
  if (score <= 2) return { level: 2, label: "Trung bình", color: "#f59e0b" };
  return { level: 3, label: "Mạnh", color: "#10b981" };
}

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, loading } = useAuthStore();
  const {
    sendOTP2,
    verifyOTP2,
    loading: otpLoading,
    isOtpVerified,
  } = useOtpStore();

  // --- States ---
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errors, setErrors] = useState<any>({});

  // --- OTP Modal States ---
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(0);
  const [isVerifiedSuccess, setIsVerifiedSuccess] = useState(false);

  const strength = getPasswordStrength(formData.password);
  const otpInputs = useRef<Array<TextInput | null>>([]);
  

  // --- Logic Hẹn giờ gửi lại mã ---
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const validate = () => {
    let e: any = {};
    if (!formData.firstName.trim()) e.firstName = "Nhập họ";
    if (!formData.lastName.trim()) e.lastName = "Nhập tên";
    if (!formData.username.trim() || formData.username.length < 3)
      e.username = "User tối thiểu 3 ký tự";
    if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = "Email không hợp lệ";
    if (formData.password.length < 6) e.password = "Mật khẩu tối thiểu 6 ký tự";
    if (formData.confirmPassword !== formData.password)
      e.confirmPassword = "Mật khẩu không khớp";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegisterPress = async () => {
    if (!validate()) return;

    await sendOTP2(formData.email);
    const { error } = useOtpStore.getState();
    if (!error) {
      setResendTimer(60);
      setShowOtpModal(true);
    } else {
      console.log("❌ sendOTP2 returned false");
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length < 6) return;

    await verifyOTP2(formData.email, code);
    const { isOtpVerified: verified } = useOtpStore.getState();

    if (verified) {
      const { confirmPassword, ...payload } = formData;
      const regSuccess = await signUp(payload);
      if (regSuccess) {
        setIsVerifiedSuccess(true);
        setTimeout(() => {
          setShowOtpModal(false);
          router.replace("/(auth)/signin");
        }, 2000);
      }
    }
  };

  const handleOtpChange = (val: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = val.slice(-1);
    setOtp(newOtp);
    if(val && index < 5) {
      otpInputs.current[index + 1]?.focus()
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
  if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
    otpInputs.current[index - 1]?.focus();
  }
};

  return (
    <View style={styles.container}>
      <View style={styles.bgGlowContainer}>
        <View
          style={[
            styles.glow,
            {
              top: "5%",
              left: "-10%",
              backgroundColor: "rgba(37,99,235,0.12)",
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
          <Animated.View entering={FadeInDown.delay(200)} style={styles.header}>
            <View style={styles.logoWrapper}>
              <LinearGradient
                colors={["#2563eb", "#3b82f6"]}
                style={styles.logoGradient}
              >
                <ShieldCheck color="white" size={30} />
              </LinearGradient>
            </View>
            <Text style={styles.appTitle}>Tạo tài khoản</Text>
            <Text style={styles.appSubtitle}>Tham gia cộng đồng Loza ngay</Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(400)} style={styles.formCard}>
            <View style={styles.rowInputs}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Họ</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === "fn" && styles.focused,
                  ]}
                  placeholder="Nguyễn"
                  placeholderTextColor="#64748b"
                  onFocus={() => setFocusedField("fn")}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(t) =>
                    setFormData({ ...formData, firstName: t })
                  }
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Tên</Text>
                <TextInput
                  style={[
                    styles.input,
                    focusedField === "ln" && styles.focused,
                  ]}
                  placeholder="Văn A"
                  placeholderTextColor="#64748b"
                  onFocus={() => setFocusedField("ln")}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(t) =>
                    setFormData({ ...formData, lastName: t })
                  }
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Tên đăng nhập</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === "user" && styles.focused,
                ]}
                placeholder="username123"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                onFocus={() => setFocusedField("user")}
                onBlur={() => setFocusedField(null)}
                onChangeText={(t) => setFormData({ ...formData, username: t })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === "email" && styles.focused,
                ]}
                placeholder="example@gmail.com"
                placeholderTextColor="#64748b"
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                onChangeText={(t) => setFormData({ ...formData, email: t })}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mật khẩu</Text>
              <View style={styles.passWrapper}>
                <TextInput
                  style={[styles.input, { flex: 1 }, focusedField === "pass" && styles.focused]}
                  placeholder="••••••••"
                  placeholderTextColor="#64748b"
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedField("pass")}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(t) => setFormData({ ...formData, password: t })}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  {showPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
                </TouchableOpacity>
              </View>
              {/* Strength bar */}
              {formData.password.length > 0 && (
                <View style={styles.strengthRow}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={[styles.strengthBar, {
                      backgroundColor: strength.level >= i ? strength.color : "#1e293b"
                    }]} />
                  ))}
                  <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                </View>
              )}
              {errors.password && <Text style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>{errors.password}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Xác nhận mật khẩu</Text>
              <View style={styles.passWrapper}>
                <TextInput
                  style={[styles.input, { flex: 1 }, focusedField === "cpass" && styles.focused]}
                  placeholder="••••••••"
                  placeholderTextColor="#64748b"
                  secureTextEntry={!showConfirmPassword}
                  onFocus={() => setFocusedField("cpass")}
                  onBlur={() => setFocusedField(null)}
                  onChangeText={(t) => setFormData({ ...formData, confirmPassword: t })}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeBtn}>
                  {showConfirmPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <Text style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>{errors.confirmPassword}</Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.mainBtn}
              onPress={handleRegisterPress}
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
                    <Text style={styles.btnText}>Đăng ký ngay</Text>
                    <ArrowRight color="white" size={18} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.footerLink}
              onPress={() => router.push("/(auth)/signin")}
            >
              <Text style={styles.footerText}>
                Đã có tài khoản? <Text style={styles.linkText}>Đăng nhập</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- OTP MODAL --- */}
      <Modal visible={showOtpModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.otpCard}>
            {isVerifiedSuccess ? (
              <Animated.View entering={FadeIn} style={styles.successContainer}>
                <View style={styles.successIconBox}>
                  <CheckCircle2 color="#10b981" size={40} />
                </View>
                <Text style={styles.successTitle}>Xác thực thành công!</Text>
                <Text style={styles.successSub}>
                  Đang chuyển đến đăng nhập...
                </Text>
              </Animated.View>
            ) : (
              <>
                <View style={styles.otpHeader}>
                  <Text style={styles.otpTitle}>Xác thực Email</Text>
                  <TouchableOpacity onPress={() => setShowOtpModal(false)}>
                    <X color="#64748b" size={20} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.otpDesc}>
                  Mã OTP đã được gửi đến:{"\n"}
                  <Text style={{ color: "#60a5fa" }}>{formData.email}</Text>
                </Text>

                <View style={styles.otpInputRow}>
                  {otp.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(el) => (otpInputs.current[i] = el)}
                      style={styles.otpBox}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onChangeText={(v) => handleOtpChange(v, i)}
                      onKeyPress={(e) => handleOtpKeyPress(e, i)}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.verifyBtn}
                  onPress={handleVerifyOtp}
                  disabled={otpLoading}
                >
                  {otpLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={styles.btnText}>Xác nhận OTP</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={resendTimer > 0}
                  onPress={() => {
                    sendOTP2(formData.email);
                    setResendTimer(60);
                  }}
                >
                  <Text
                    style={[
                      styles.resendText,
                      { color: resendTimer > 0 ? "#475569" : "#3b82f6" },
                    ]}
                  >
                    {resendTimer > 0
                      ? `Gửi lại sau ${resendTimer}s`
                      : "Gửi lại mã OTP"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#060d1f" },
  bgGlowContainer: { ...StyleSheet.absoluteFillObject },
  glow: {
    position: "absolute",
    width: width,
    height: width,
    borderRadius: width / 2,
    opacity: 0.5,
  },
  scrollContent: { paddingHorizontal: 24, paddingTop: 50, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 25 },
  logoWrapper: {
    width: 60,
    height: 60,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 15,
  },
  logoGradient: { flex: 1, justifyContent: "center", alignItems: "center" },
  appTitle: { color: "white", fontSize: 26, fontWeight: "800" },
  appSubtitle: { color: "#60a5fa", fontSize: 13 },
  formCard: {
    backgroundColor: "rgba(10, 16, 32, 0.85)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.1)",
  },
  rowInputs: { flexDirection: "row", gap: 12 },
  inputGroup: { marginBottom: 15 },
  label: { color: "#cbd5e1", fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.4)",
    paddingHorizontal: 15,
    height: 48,
    color: "white",
  },
  focused: { borderColor: "#3b82f6", backgroundColor: "rgba(30, 41, 80, 0.9)" },
  passWrapper: { flexDirection: "row", alignItems: "center" },
  eyeBtn: { position: "absolute", right: 12 },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
  },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 10, fontWeight: "700", marginLeft: 5 },
  mainBtn: { marginTop: 10, borderRadius: 12, overflow: "hidden" },
  btnGradient: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnText: { color: "white", fontSize: 15, fontWeight: "700" },
  footerLink: { marginTop: 20, alignItems: "center" },
  footerText: { color: "#94a3b8", fontSize: 13 },
  linkText: { color: "#3b82f6", fontWeight: "700" },

  // Modal OTP
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  otpCard: {
    width: "100%",
    backgroundColor: "#0d1526",
    borderRadius: 24,
    padding: 25,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  otpHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  otpTitle: { color: "white", fontSize: 18, fontWeight: "800" },
  otpDesc: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  otpInputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 25,
  },
  otpBox: {
    width: 42,
    height: 50,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    textAlign: "center",
    color: "white",
    fontSize: 20,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: "#334155",
  },
  verifyBtn: {
    backgroundColor: "#2563eb",
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  resendText: { textAlign: "center", fontSize: 13, fontWeight: "600" },

  // Success state in modal
  successContainer: { alignItems: "center", padding: 20 },
  successIconBox: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(16,185,129,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  successTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 5,
  },
  successSub: { color: "#94a3b8", fontSize: 13 },
});
