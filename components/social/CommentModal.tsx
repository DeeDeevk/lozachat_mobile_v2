import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Audio } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { X, ImagePlus, CornerDownRight, Send } from "lucide-react-native";
import { postService } from "@/services/postService";
import { usePostStore } from "@/stores/usePostStore";
import type { Comment, Post } from "@/types/post";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { subscribeSocialEvent } from "@/utils/socialRealtime";

type CommentNode = Comment & { replies: CommentNode[] };

function buildTree(flat: Comment[]): CommentNode[] {
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  flat.forEach((comment) => map.set(comment._id, { ...comment, replies: [] }));
  flat.forEach((comment) => {
    const parentId = typeof comment.parentId === "object" && comment.parentId !== null ? comment.parentId._id : comment.parentId;
    if (parentId && map.has(parentId)) map.get(parentId)!.replies.push(map.get(comment._id)!);
    else roots.push(map.get(comment._id)!);
  });

  return roots;
}

function commentDepthStyle(depth: number) {
  return { marginLeft: Math.min(depth * 14, 42) };
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U"
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />;
  }

  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarFallbackText}>{getInitials(name)}</Text>
    </View>
  );
}

function VoicePlayer({ uri }: { uri: string }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      void soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
        soundRef.current = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!status.isLoaded) return;
          setPlaying(status.isPlaying);
          if (status.didJustFinish) {
            setPlaying(false);
          }
        });
        setPlaying(true);
        return;
      }

      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setPlaying(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableOpacity style={styles.voicePlayer} onPress={() => void toggle()}>
      {loading ? <ActivityIndicator size="small" color="#bfdbfe" /> : <Text style={styles.voicePlayerIcon}>{playing ? "❚❚" : "▶"}</Text>}
      <View style={styles.voicePlayerMeta}>
        <Text style={styles.voicePlayerTitle}>{playing ? "Đang phát voice comment" : "Voice comment"}</Text>
        <Text style={styles.voicePlayerSub}>Chạm để phát / tạm dừng</Text>
      </View>
    </TouchableOpacity>
  );
}

interface Props {
  visible: boolean;
  post: Post | null;
  currentUserId: string;
  autoOpenReplyTo?: string | null;
  imageId?: string | null;
  onClose: () => void;
}

export default function CommentModal({ visible, post, currentUserId, imageId = null, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { addComment } = usePostStore();
  const [flatComments, setFlatComments] = useState<Comment[]>([]);
  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<any[]>([]);
  const [voiceNote, setVoiceNote] = useState<any | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  const tree = useMemo(() => buildTree(flatComments), [flatComments]);

  const loadComments = useCallback(async (reset = true) => {
    if (!post) return;
    setFetching(true);
    try {
      const nextPage = reset ? 1 : page + 1;
      const res = await postService.getComments(post._id, imageId ?? undefined, nextPage);
      setPage(nextPage);
      setHasMore(res.pagination.hasMore);
      setFlatComments((prev) => (reset ? res.comments : [...prev, ...res.comments]));
    } finally {
      setFetching(false);
    }
  }, [imageId, page, post]);

  useEffect(() => {
    if (!visible || !post) return;
    setPage(1);
    setFlatComments([]);
    setContent("");
    setFiles([]);
    setVoiceNote(null);
    setReplyTo(null);
    void loadComments(true);
  }, [visible, post, loadComments]);

  useEffect(() => {
    const unsubscribe = subscribeSocialEvent("notification", (notification) => {
      if (!post) return;

      const notificationPostId = typeof notification.postId === "object" && notification.postId !== null ? notification.postId._id : notification.postId;
      if (String(notificationPostId || "") !== String(post._id)) return;

      if (notification.type === "comment" || notification.type === "reply" || notification.type === "react_comment") {
        void loadComments(true);
      }
    });

    return unsubscribe;
  }, [loadComments, post]);

  useEffect(() => {
    return () => {
      void recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 4,
    });

    if (!result.canceled) {
      setFiles((prev) => [...prev, ...result.assets]);
    }
  };

  const removeImage = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeVoiceNote = () => {
    setVoiceNote(null);
  };

  const startRecording = async () => {
    if (isRecording || recordingRef.current) return;

    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();

    recordingRef.current = recording;
    setIsRecording(true);
  };

  const stopRecording = async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    setIsRecording(false);
    recordingRef.current = null;

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    if (uri) {
      setVoiceNote({
        uri,
        name: `voice-${Date.now()}.m4a`,
        type: "audio/mp4",
      });
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
  };

  const submit = async () => {
    if (!post) return;
    if (!content.trim() && files.length === 0 && !voiceNote) return;

    setSubmitting(true);
    try {
      await addComment(post._id, content.trim(), replyTo?._id ?? null, files, imageId, voiceNote);
      setContent("");
      setFiles([]);
      setVoiceNote(null);
      setReplyTo(null);
      setPage(1);
      await loadComments(true);
    } finally {
      setSubmitting(false);
    }
  };

  const renderNode = (comment: CommentNode, depth = 0) => {
    const authorName = comment.author?.displayName || "Người dùng";
    return (
      <View key={comment._id} style={[styles.commentBox, commentDepthStyle(depth)]}>
        <View style={styles.commentRow}>
          <Avatar name={authorName} avatarUrl={comment.author?.avatarUrl} />
          <View style={styles.commentBody}>
            <View style={styles.commentBubble}>
              <Text style={styles.commentAuthor}>{authorName}</Text>
              <Text style={styles.commentText}>{comment.content}</Text>
              {comment.audioUrl ? <VoicePlayer uri={comment.audioUrl} /> : null}
            </View>
            <View style={styles.commentActions}>
              <TouchableOpacity onPress={() => setReplyTo(comment)}>
                <Text style={styles.commentActionText}>Trả lời</Text>
              </TouchableOpacity>
              {String(comment.author?._id || "") === String(currentUserId) ? (
                <Text style={styles.commentMine}>Của bạn</Text>
              ) : null}
            </View>
          </View>
        </View>

        {comment.replies?.length > 0 ? (
          <View style={styles.replyList}>
            {comment.replies.map((reply) => renderNode(reply, depth + 1))}
          </View>
        ) : null}
      </View>
    );
  };

  if (!post) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 14 }]}> 
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}> 
            <View>
              <Text style={styles.title}>Bình luận</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {post.content || "Bài viết không có nội dung"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} color="#e2e8f0" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
            {fetching && flatComments.length === 0 ? (
              <Text style={styles.emptyText}>Đang tải bình luận...</Text>
            ) : tree.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có bình luận nào.</Text>
            ) : (
              tree.map((comment) => renderNode(comment))
            )}

            {hasMore ? (
              <TouchableOpacity onPress={() => void loadComments(false)} style={styles.moreBtn}>
                <Text style={styles.moreBtnText}>Xem thêm bình luận</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          {replyTo ? (
            <View style={styles.replyBanner}>
              <CornerDownRight size={14} color="#60a5fa" />
              <Text style={styles.replyBannerText} numberOfLines={1}>
                Trả lời {replyTo.author?.displayName || "người dùng"}
              </Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}>
                <Text style={styles.replyCancelText}>Huỷ</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {voiceNote ? (
            <View style={styles.voicePreview}>
              <View>
                <Text style={styles.voicePreviewLabel}>Ghi âm đã sẵn sàng</Text>
                <Text style={styles.voicePreviewSubtext}>Chạm gửi để đính kèm ghi âm vào bình luận.</Text>
              </View>
              <TouchableOpacity onPress={removeVoiceNote} style={styles.voiceRemoveBtn}>
                <Text style={styles.voiceRemoveText}>Xoá</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {files.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewStrip}>
              {files.map((file, index) => (
                <View key={`${file.uri}-${index}`} style={styles.previewWrap}>
                  <Image source={{ uri: file.uri }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.previewRemove} onPress={() => removeImage(index)}>
                    <X size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.composer}>
            <TouchableOpacity onPress={pickImages} style={styles.pickBtn}>
              <ImagePlus size={18} color="#bfdbfe" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void (isRecording ? stopRecording() : startRecording())}
              style={[styles.pickBtn, isRecording && styles.recordingBtn]}
            >
              <Text style={styles.micIcon}>{isRecording ? "■" : "🎤"}</Text>
            </TouchableOpacity>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Viết bình luận..."
              placeholderTextColor="#64748b"
              style={styles.input}
              multiline
            />
            <TouchableOpacity
              onPress={() => void submit()}
              disabled={submitting || (!content.trim() && files.length === 0 && !voiceNote)}
              style={[styles.sendBtn, (submitting || (!content.trim() && files.length === 0 && !voiceNote)) && styles.sendBtnDisabled]}
            >
              <Send size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    maxHeight: "86%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#07111f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingBottom: 18,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16 },
  title: { color: "#e2e8f0", fontSize: 18, fontWeight: "800" },
  subtitle: { color: "#94a3b8", fontSize: 12, marginTop: 4, maxWidth: "85%" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.05)" },
  list: { flexGrow: 0, maxHeight: 320 },
  listContent: { paddingHorizontal: 16, paddingBottom: 12 },
  emptyText: { color: "#64748b", textAlign: "center", paddingVertical: 24 },
  moreBtn: { alignSelf: "center", paddingHorizontal: 14, paddingVertical: 8, marginTop: 10, borderRadius: 999, backgroundColor: "rgba(59,130,246,0.12)" },
  moreBtnText: { color: "#bfdbfe", fontSize: 12, fontWeight: "700" },
  commentBox: { marginBottom: 12 },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  avatarImage: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#0f172a" },
  avatarFallback: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  commentBody: { flex: 1 },
  commentBubble: { borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 12, paddingVertical: 10 },
  commentAuthor: { color: "#e2e8f0", fontSize: 12, fontWeight: "700", marginBottom: 3 },
  commentText: { color: "#cbd5e1", fontSize: 13, lineHeight: 18 },
  commentActions: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6, marginLeft: 4 },
  commentActionText: { color: "#60a5fa", fontSize: 11, fontWeight: "700" },
  commentMine: { color: "#64748b", fontSize: 11, fontWeight: "700" },
  replyList: { marginTop: 10 },
  replyBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8, backgroundColor: "rgba(59,130,246,0.10)" },
  replyBannerText: { flex: 1, color: "#bfdbfe", fontSize: 12, fontWeight: "700" },
  replyCancelText: { color: "#fca5a5", fontSize: 12, fontWeight: "700" },
  previewStrip: { maxHeight: 88, paddingHorizontal: 16, marginBottom: 8 },
  previewWrap: { position: "relative", marginRight: 10 },
  previewImage: { width: 72, height: 72, borderRadius: 16, backgroundColor: "#111827" },
  previewRemove: { position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: "#ef4444", alignItems: "center", justifyContent: "center" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  pickBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(59,130,246,0.15)" },
  recordingBtn: { backgroundColor: "rgba(239,68,68,0.2)" },
  micIcon: { color: "#bfdbfe", fontSize: 14, fontWeight: "800" },
  input: { flex: 1, minHeight: 40, maxHeight: 110, color: "#e2e8f0", fontSize: 14, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.05)" },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#2563eb" },
  sendBtnDisabled: { opacity: 0.45 },
  voicePreview: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 16, backgroundColor: "rgba(59,130,246,0.12)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  voicePreviewLabel: { color: "#e2e8f0", fontSize: 12, fontWeight: "800" },
  voicePreviewSubtext: { color: "#bfdbfe", fontSize: 11, marginTop: 2 },
  voiceRemoveBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)" },
  voiceRemoveText: { color: "#fca5a5", fontSize: 12, fontWeight: "800" },
  voicePlayer: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: "rgba(59,130,246,0.10)", flexDirection: "row", alignItems: "center", gap: 10 },
  voicePlayerIcon: { color: "#bfdbfe", fontSize: 14, fontWeight: "900", width: 18, textAlign: "center" },
  voicePlayerMeta: { flex: 1 },
  voicePlayerTitle: { color: "#e2e8f0", fontSize: 12, fontWeight: "800" },
  voicePlayerSub: { color: "#94a3b8", fontSize: 11, marginTop: 1 },
});