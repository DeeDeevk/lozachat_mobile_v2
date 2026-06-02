import api from "@/lib/axios";
import { authService } from "@/services/authService";
import { AccountLockRequest, userService } from "@/services/userService";
import { useAuthStore } from "@/stores/useAuthStore";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { changePasswordService } from '@/services/otpService';
import { useOtpStore } from "@/stores/useOtpStore";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// ─── COLORS ────────────────────────────────────────────────────────────────────
const C = {
  bgDark: "#060D1F",
  bgCard: "#0F172A",
  bgItem: "#1E293B",
  accentBlue: "#3B82F6",
  primaryBlue: "#2563EB",
  textGrey: "#94A3B8",
  border: "#1E293B",
};

// ─── TYPES ─────────────────────────────────────────────────────────────────────
interface UserProfile {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  role: string;
  isLocked?: boolean;
  lockedAt?: string;
  lockedReason?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2)
    return (
      parts[parts.length - 2][0] + parts[parts.length - 1][0]
    ).toUpperCase();
  return name[0]?.toUpperCase() ?? "U";
}

// ─── SECTION TITLE ─────────────────────────────────────────────────────────────
function SectionTitle({ title }: { title: string }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 10 }}>
      <Text
        style={{
          color: C.accentBlue,
          fontSize: 12,
          fontWeight: "bold",
          letterSpacing: 1.2,
        }}
      >
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

// ─── INFO TILE ─────────────────────────────────────────────────────────────────
function InfoTile({
  icon,
  title,
  value,
}: {
  icon: any;
  title: string;
  value: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}
    >
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.05)",
          borderRadius: 10,
          padding: 8,
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={20} color="rgba(255,255,255,0.7)" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.textGrey, fontSize: 12 }}>{title}</Text>
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "500" }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── MENU TILE ─────────────────────────────────────────────────────────────────
function MenuTile({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: any;
  title: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.05)",
          borderRadius: 10,
          padding: 8,
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={20} color="rgba(255,255,255,0.7)" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "500" }}>
          {title}
        </Text>
        <Text style={{ color: C.textGrey, fontSize: 12 }}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={C.textGrey} />
    </TouchableOpacity>
  );
}

// ─── PASSWORD FIELD ────────────────────────────────────────────────────────────
function PasswordField({
  label,
  value,
  onChangeText,
  show,
  onToggle,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  show: boolean;
  onToggle: () => void;
  error?: string;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!show}
        placeholder={label}
        placeholderTextColor={C.textGrey}
        style={{
          backgroundColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: error ? "#F87171" : "rgba(255,255,255,0.1)",
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: "#fff",
          fontSize: 14,
          paddingRight: 44,
        }}
      />
      <TouchableOpacity
        onPress={onToggle}
        style={{ position: "absolute", right: 12, top: 12 }}
      >
        <Ionicons
          name={show ? "eye-off-outline" : "eye-outline"}
          size={20}
          color={C.textGrey}
        />
      </TouchableOpacity>
      {error && (
        <Text style={{ color: "#F87171", fontSize: 11, marginTop: 4 }}>
          {error}
        </Text>
      )}
    </View>
  );
}

// ─── STRENGTH BAR ─────────────────────────────────────────────────────────────
function StrengthBar({ password }: { password: string }) {
  const len = password.length;
  const s = len === 0 ? -1 : len < 6 ? 0 : len < 10 ? 1 : 2;
  if (s < 0) return null;
  const colors = ["#F87171", "#FB923C", "#4ADE80"];
  const labels = ["Yếu", "Trung bình", "Mạnh"];
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}
    >
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            marginRight: i < 2 ? 4 : 0,
            backgroundColor: i <= s ? colors[s] : "rgba(255,255,255,0.1)",
            borderRadius: 2,
          }}
        />
      ))}
      <Text style={{ color: colors[s], fontSize: 10, marginLeft: 8 }}>
        {labels[s]}
      </Text>
    </View>
  );
}

// ─── CHANGE PASSWORD MODAL ─────────────────────────────────────────────────────
function ChangePasswordModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{
    old?: string;
    new?: string;
    confirm?: string;
  }>({});

  const reset = () => {
    setOldPw("");
    setNewPw("");
    setConfirmPw("");
    setErrors({});
    setSaving(false);
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!oldPw) e.old = "Vui lòng nhập mật khẩu hiện tại";
    if (!newPw) e.new = "Vui lòng nhập mật khẩu mới";
    else if (newPw.length < 6) e.new = "Tối thiểu 6 ký tự";
    else if (newPw === oldPw) e.new = "Phải khác mật khẩu cũ";
    if (!confirmPw) e.confirm = "Vui lòng xác nhận mật khẩu";
    else if (confirmPw !== newPw) e.confirm = "Mật khẩu không khớp";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await changePasswordService.changePassword(oldPw, newPw);
      setSaving(false);
      Alert.alert('Thành công', 'Đổi mật khẩu thành công!');
      reset(); onClose();
    } catch (error: any) {
      setSaving(false);
      const msg = error?.response?.data?.message ?? 'Đổi mật khẩu thất bại';
      const isOldWrong = /old|incorrect|wrong|hiện tại|cũ/i.test(msg);
      if (isOldWrong) setErrors(p => ({ ...p, old: msg }));
      else Alert.alert('Lỗi', msg);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            padding: 20,
          }}
          onPress={onClose}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              style={{
                backgroundColor: C.bgCard,
                borderRadius: 16,
                padding: 20,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: "bold",
                  marginBottom: 20,
                }}
              >
                Đổi mật khẩu
              </Text>
              <PasswordField
                label="Mật khẩu hiện tại"
                value={oldPw}
                onChangeText={(t) => {
                  setOldPw(t);
                  setErrors((p) => ({ ...p, old: undefined }));
                }}
                show={showOld}
                onToggle={() => setShowOld((p) => !p)}
                error={errors.old}
              />
              <PasswordField
                label="Mật khẩu mới"
                value={newPw}
                onChangeText={(t) => {
                  setNewPw(t);
                  setErrors((p) => ({ ...p, new: undefined }));
                }}
                show={showNew}
                onToggle={() => setShowNew((p) => !p)}
                error={errors.new}
              />
              {newPw.length > 0 && <StrengthBar password={newPw} />}
              <PasswordField
                label="Xác nhận mật khẩu mới"
                value={confirmPw}
                onChangeText={(t) => {
                  setConfirmPw(t);
                  setErrors((p) => ({ ...p, confirm: undefined }));
                }}
                show={showConfirm}
                onToggle={() => setShowConfirm((p) => !p)}
                error={errors.confirm}
              />
              {confirmPw.length > 0 && newPw.length > 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <Ionicons
                    name={
                      confirmPw === newPw
                        ? "checkmark-circle-outline"
                        : "close-circle-outline"
                    }
                    size={14}
                    color={confirmPw === newPw ? "#4ADE80" : "#F87171"}
                  />
                  <Text
                    style={{
                      color: confirmPw === newPw ? "#4ADE80" : "#F87171",
                      fontSize: 11,
                      marginLeft: 4,
                    }}
                  >
                    {confirmPw === newPw ? "Mật khẩu khớp" : "Chưa khớp"}
                  </Text>
                </View>
              )}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                  marginTop: 8,
                }}
              >
                <TouchableOpacity
                  onPress={() => {
                    reset();
                    onClose();
                  }}
                  style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: C.textGrey }}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submit}
                  disabled={saving}
                  style={{
                    backgroundColor: C.accentBlue,
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                  }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "600" }}>
                      Xác nhận
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── EDIT PROFILE MODAL ────────────────────────────────────────────────────────
function EditProfileModal({
  visible,
  profile,
  onClose,
  onSaved,
}: {
  visible: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSaved: (p: UserProfile) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [phoneError, setPhoneError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const phoneRegex =
    /^(032|033|034|035|036|037|038|039|096|097|098|086|083|084|085|081|082|088|091|094|070|079|077|076|078|090|093|089|056|058|092|059|099)[0-9]{7}$/;

  const save = async () => {
    if (phone && !phoneRegex.test(phone)) {
      setPhoneError("Số điện thoại không hợp lệ");
      return;
    }
    setSaving(true);
    try {
      await userService.updateMe({ displayName, bio, phone });
      setSaving(false);
      onSaved({ ...profile, displayName, bio, phone });
      onClose();
      Alert.alert("Thành công", "Cập nhật thành công!");
    } catch (error: any) {
      setSaving(false);
      console.log("Lỗi cập nhật:", JSON.stringify(error?.response?.data));
      console.log("Status:", error?.response?.status);
      Alert.alert("Lỗi", error?.response?.data?.message ?? "Cập nhật thất bại");
    }
  };

  const Field = ({
    label,
    value,
    onChangeText,
    keyboardType = "default",
    error,
  }: any) => (
    <View style={{ marginBottom: 16 }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={label}
        placeholderTextColor={C.textGrey}
        keyboardType={keyboardType}
        style={{
          backgroundColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: error ? "#F87171" : "rgba(255,255,255,0.1)",
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: "#fff",
          fontSize: 14,
        }}
      />
      {error && (
        <Text style={{ color: "#F87171", fontSize: 11, marginTop: 4 }}>
          {error}
        </Text>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            padding: 20,
          }}
          onPress={onClose}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              style={{
                backgroundColor: C.bgCard,
                borderRadius: 16,
                padding: 20,
              }}
            >
              <Text
                style={{
                  color: "#fff",
                  fontSize: 18,
                  fontWeight: "bold",
                  marginBottom: 20,
                }}
              >
                Thông tin cá nhân
              </Text>
              <Field
                label="Họ và tên"
                value={displayName}
                onChangeText={setDisplayName}
              />
              <Field
                label="Bio / Giới thiệu"
                value={bio}
                onChangeText={setBio}
              />
              <Field
                label="Điện thoại"
                value={phone}
                onChangeText={(t: string) => {
                  setPhone(t);
                  setPhoneError(undefined);
                }}
                keyboardType="phone-pad"
                error={phoneError}
              />
              <Text
                style={{ color: C.textGrey, fontSize: 12, marginBottom: 16 }}
              >
                Chỉ bạn bè có lưu số của bạn trong danh bạ mới xem được số này
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <TouchableOpacity
                  onPress={onClose}
                  style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: C.textGrey }}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={save}
                  disabled={saving}
                  style={{
                    backgroundColor: C.accentBlue,
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 20,
                  }}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "600" }}>
                      Lưu
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── LOCK ACCOUNT REQUEST MODAL ────────────────────────────────────────────────
function LockAccountModal({
  visible,
  profile,
  onClose,
  onSubmitted,
}: {
  visible: boolean;
  profile: UserProfile;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { sendOTP, verifyOTP, loading } = useOtpStore();
  const [step, setStep] = useState<"reason" | "otp">("reason");
  const [reason, setReason] = useState("");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setStep("reason");
    setReason("");
    setOtp("");
    setSubmitting(false);
    setError("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const sendLockOtp = async () => {
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do khóa tài khoản");
      return;
    }

    setError("");
    await sendOTP(profile.email);
    const { error: otpError } = useOtpStore.getState();
    if (otpError) {
      setError(otpError);
      return;
    }
    setStep("otp");
  };

  const submitLockRequest = async () => {
    if (otp.trim().length < 6) {
      setError("Vui lòng nhập đủ 6 chữ số OTP");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await verifyOTP(profile.email, otp.trim());
      const { error: otpError, isOtpVerified } = useOtpStore.getState();
      if (otpError || !isOtpVerified) {
        setError(otpError || "OTP không hợp lệ");
        return;
      }

      const res = await userService.requestAccountLock(reason.trim());
      Alert.alert("Thành công", res.message);
      reset();
      onSubmitted();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Không thể gửi yêu cầu khóa tài khoản");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            justifyContent: "center",
            padding: 20,
          }}
          onPress={close}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={{ backgroundColor: C.bgCard, borderRadius: 16, padding: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: "rgba(248,113,113,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="lock-closed-outline" size={22} color="#F87171" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#fff", fontSize: 18, fontWeight: "bold" }}>
                    Yêu cầu khóa tài khoản
                  </Text>
                  <Text style={{ color: C.textGrey, fontSize: 12, marginTop: 2 }}>
                    Admin sẽ duyệt trước khi tài khoản bị khóa.
                  </Text>
                </View>
              </View>

              {step === "reason" ? (
                <>
                  <TextInput
                    value={reason}
                    onChangeText={(text) => {
                      setReason(text);
                      setError("");
                    }}
                    placeholder="Nhập lý do muốn khóa tài khoản"
                    placeholderTextColor={C.textGrey}
                    multiline
                    textAlignVertical="top"
                    style={{
                      minHeight: 110,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderWidth: 1,
                      borderColor: error ? "#F87171" : "rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      color: "#fff",
                      fontSize: 14,
                    }}
                  />
                  <Text style={{ color: C.textGrey, fontSize: 12, lineHeight: 18, marginTop: 10 }}>
                    Sau khi được duyệt, bạn sẽ không thể đăng nhập cho tới khi admin mở khóa.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ color: C.textGrey, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
                    Nhập mã OTP đã gửi đến {profile.email} để xác nhận yêu cầu.
                  </Text>
                  <TextInput
                    value={otp}
                    onChangeText={(text) => {
                      setOtp(text.replace(/\D/g, "").slice(0, 6));
                      setError("");
                    }}
                    placeholder="000000"
                    placeholderTextColor={C.textGrey}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderWidth: 1,
                      borderColor: error ? "#F87171" : "rgba(255,255,255,0.1)",
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      color: "#fff",
                      fontSize: 20,
                      letterSpacing: 8,
                      textAlign: "center",
                      fontWeight: "800",
                    }}
                  />
                </>
              )}

              {error ? (
                <Text style={{ color: "#F87171", fontSize: 12, marginTop: 10 }}>{error}</Text>
              ) : null}

              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
                <TouchableOpacity
                  onPress={close}
                  style={{ paddingVertical: 10, paddingHorizontal: 16 }}
                >
                  <Text style={{ color: C.textGrey }}>Hủy</Text>
                </TouchableOpacity>
                {step === "otp" && (
                  <TouchableOpacity
                    onPress={() => setStep("reason")}
                    style={{ paddingVertical: 10, paddingHorizontal: 8 }}
                  >
                    <Text style={{ color: C.textGrey }}>Sửa lý do</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={step === "reason" ? sendLockOtp : submitLockRequest}
                  disabled={loading || submitting}
                  style={{
                    backgroundColor: "#EF4444",
                    borderRadius: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 18,
                    minWidth: 98,
                    alignItems: "center",
                  }}
                >
                  {loading || submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "700" }}>
                      {step === "reason" ? "Gửi OTP" : "Xác nhận"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── DELETE ACCOUNT MODAL ──────────────────────────────────────────────────────
function DeleteAccountModal({
  visible,
  onClose,
  onDeleted,
}: {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await userService.deleteMe();
      setDeleting(false);
      onDeleted();
    } catch (error: any) {
      setDeleting(false);
      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ?? "Xóa tài khoản thất bại",
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "center",
          padding: 20,
        }}
        onPress={onClose}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View
            style={{
              backgroundColor: C.bgCard,
              borderRadius: 16,
              padding: 24,
              alignItems: "center",
            }}
          >
            <Ionicons name="warning" size={48} color="#F87171" />
            <Text
              style={{
                color: "#fff",
                fontWeight: "bold",
                fontSize: 16,
                marginTop: 12,
                marginBottom: 8,
              }}
            >
              Xóa tài khoản?
            </Text>
            <Text
              style={{
                color: C.textGrey,
                fontSize: 13,
                textAlign: "center",
                marginBottom: 24,
              }}
            >
              Hành động này không thể hoàn tác. Tất cả dữ liệu sẽ bị xóa vĩnh
              viễn.
            </Text>
            <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: C.bgItem,
                  borderRadius: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: C.textGrey, fontWeight: "600" }}>
                  Hủy
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                disabled={deleting}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  backgroundColor: "#EF4444",
                  borderRadius: 10,
                  alignItems: "center",
                }}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Xóa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showLockAccount, setShowLockAccount] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [lockRequests, setLockRequests] = useState<AccountLockRequest[]>([]);
  const router = useRouter();
  const signOut = useAuthStore((s) => s.signOut);

  const loadProfile = useCallback(async () => {
    // setLoading(false);
    // setProfile({
    //   _id: '1',
    //   username: 'khoa123',
    //   email: 'khoa@example.com',
    //   displayName: 'Nguyễn Văn Khoa',
    //   avatarUrl: undefined,
    //   bio: 'Lập trình viên đam mê Flutter & React Native',
    //   phone: '0901234567',
    //   role: 'user',
    //   createdAt: new Date().toISOString(),
    //   updatedAt: new Date().toISOString(),
    // });
    try {
      const res = await authService.getCurrentUser();
      setLoading(false);
      const data = res?.user ?? res;
      setProfile(data);
      try {
        const lockRes = await userService.getMyAccountLockRequests();
        setLockRequests(lockRes.requests ?? []);
      } catch (lockError) {
        console.log("Không thể tải yêu cầu khóa tài khoản:", lockError);
      }
    } catch (error: any) {
      setLoading(false);
      setError(error?.response?.data?.message ?? "Không thể tải thông tin");
      // router.replace('/(auth)/signin');
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Cần quyền truy cập thư viện ảnh");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    try {
      const formData = new FormData();
      formData.append("avatar", {
        uri,
        name: "avatar.jpg",
        type: "image/jpeg",
      } as any);
      const res = await api.post("/users/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfile(res.data?.user);
      Alert.alert("Thành công", "Cập nhật avatar thành công");
    } catch (error: any) {
      Alert.alert("Lỗi", error?.response?.data?.message ?? "Upload thất bại");
    }
  };

  const confirmLogout = () => {
    Alert.alert("Đăng xuất?", "Bạn có chắc chắn muốn thoát khỏi Loza?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
            router.replace("/(auth)/signin");
          } catch (error) {
            Alert.alert("Lỗi", "Đăng xuất thất bại, vui lòng thử lại");
          }
        },
      },
    ]);
  };

  const pendingLockRequest = lockRequests.find((request) => request.status === "pending");

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.bgDark,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={C.accentBlue} />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: C.bgDark,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Ionicons name="alert-circle-outline" size={48} color="#F87171" />
        <Text
          style={{
            color: "rgba(255,255,255,0.7)",
            marginTop: 12,
            marginBottom: 16,
          }}
        >
          {error}
        </Text>
        <TouchableOpacity
          onPress={loadProfile}
          style={{
            backgroundColor: C.accentBlue,
            paddingHorizontal: 24,
            paddingVertical: 10,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#fff" }}>Thử lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bgDark }}>
      {/* ── HEADER ── */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 52,
          paddingBottom: 12,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 20, fontWeight: "bold" }}>
          Cá nhân
        </Text>
        {profile && (
          <TouchableOpacity onPress={() => setShowEdit(true)}>
            <Ionicons name="create-outline" size={22} color={C.accentBlue} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── AVATAR (căn giữa giống Flutter) ── */}
        <View style={{ alignItems: "center", marginTop: 20, marginBottom: 16 }}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8}>
            <View style={{ position: "relative" }}>
              <View
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: 52,
                  borderWidth: 2,
                  borderColor: `${C.accentBlue}80`,
                  padding: 2,
                }}
              >
                <View
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    overflow: "hidden",
                    backgroundColor: C.accentBlue,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {profile?.avatarUrl ? (
                    <Image
                      source={{ uri: profile.avatarUrl }}
                      style={{ width: 96, height: 96 }}
                    />
                  ) : (
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 28,
                        fontWeight: "bold",
                      }}
                    >
                      {getInitials(profile?.displayName ?? "")}
                    </Text>
                  )}
                </View>
              </View>
              {/* Camera icon */}
              <View
                style={{
                  position: "absolute",
                  bottom: 2,
                  right: 2,
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  padding: 4,
                }}
              >
                <Ionicons name="camera" size={16} color="#000" />
              </View>
            </View>
          </TouchableOpacity>

          {/* Tên và username */}
          <Text
            style={{
              color: "#fff",
              fontSize: 22,
              fontWeight: "bold",
              marginTop: 12,
            }}
          >
            {profile?.displayName}
          </Text>
          <Text style={{ color: C.textGrey, fontSize: 14, marginTop: 4 }}>
            @{profile?.username}
          </Text>
        </View>

        {/* ── THÔNG TIN ── */}
        <View style={{ marginTop: 10 }}>
          <SectionTitle title="Thông tin" />
          <InfoTile
            icon="id-card-outline"
            title="Họ và tên"
            value={profile?.displayName ?? "-"}
          />
          <InfoTile
            icon="mail-outline"
            title="Email"
            value={profile?.email ?? "-"}
          />
          <InfoTile
            icon="call-outline"
            title="Điện thoại"
            value={profile?.phone ?? "Chưa cập nhật"}
          />
          <InfoTile
            icon="information-circle-outline"
            title="Bio"
            value={profile?.bio ?? "Chưa cập nhật"}
          />
        </View>

        <View
          style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }}
        />

        {/* ── TÀI KHOẢN ── */}
        <SectionTitle title="Tài khoản" />
        <MenuTile
          icon="lock-closed-outline"
          title="Bảo mật"
          subtitle="Thay đổi mật khẩu"
          onPress={() => setShowChangePw(true)}
        />
        <MenuTile
          icon="shield-outline"
          title="Khóa tài khoản"
          subtitle={
            pendingLockRequest
              ? "Yêu cầu khóa đang chờ admin duyệt"
              : "Gửi yêu cầu khóa tài khoản tới admin"
          }
          onPress={() => {
            if (pendingLockRequest) {
              Alert.alert(
                "Đang chờ duyệt",
                "Bạn đã có yêu cầu khóa tài khoản đang chờ admin duyệt.",
              );
              return;
            }
            if (profile) setShowLockAccount(true);
          }}
        />
        <MenuTile
          icon="trash-outline"
          title="Xóa tài khoản"
          subtitle="Xóa vĩnh viễn tài khoản và toàn bộ dữ liệu"
          onPress={() => setShowDeleteAccount(true)}
        />

        <View
          style={{ height: 1, backgroundColor: C.border, marginVertical: 8 }}
        />

        {/* ── CÀI ĐẶT ── */}
        <SectionTitle title="Cài đặt" />
        <MenuTile
          icon="notifications-outline"
          title="Thông báo"
          subtitle="Âm thanh, rung..."
        />
        <MenuTile
          icon="moon-outline"
          title="Giao diện"
          subtitle="Chế độ tối đang bật"
        />

        {/* ── ĐĂNG XUẤT ── */}
        <View
          style={{ paddingHorizontal: 20, marginTop: 32, marginBottom: 40 }}
        >
          <TouchableOpacity
            onPress={confirmLogout}
            style={{
              borderWidth: 1,
              borderColor: "#F87171",
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Ionicons name="log-out-outline" size={18} color="#F87171" />
            <Text style={{ color: "#F87171", fontWeight: "600" }}>
              Đăng xuất
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── MODALS ── */}
      {profile && (
        <EditProfileModal
          visible={showEdit}
          profile={profile}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => setProfile(updated)}
        />
      )}
      <ChangePasswordModal
        visible={showChangePw}
        onClose={() => setShowChangePw(false)}
      />
      {profile && (
        <LockAccountModal
          visible={showLockAccount}
          profile={profile}
          onClose={() => setShowLockAccount(false)}
          onSubmitted={loadProfile}
        />
      )}
      <DeleteAccountModal
        visible={showDeleteAccount}
        onClose={() => setShowDeleteAccount(false)}
        onDeleted={() => router.replace("/(auth)/signin")}
      />
    </View>
  );
}
