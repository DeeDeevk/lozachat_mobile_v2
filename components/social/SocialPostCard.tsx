import { useEffect, useMemo, useState } from "react";
import { Alert, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { useRouter } from "expo-router";
import { CornerDownRight, MessageCircle, MoreHorizontal, Send, Share2, Sparkles, ThumbsUp, X } from "lucide-react-native";
import { usePostStore } from "@/stores/usePostStore";
import { postService } from "@/services/postService";
import type { Post, ReactionType, Visibility } from "@/types/post";
import { REACTION_EMOJI, REACTION_LABEL } from "@/types/post";
import CommentModal from "@/components/social/CommentModal";
import { formatRelativeTime } from "@/utils/formatRelativeTime";

const REACTION_TYPES: ReactionType[] = ["like", "love", "haha", "wow", "sad", "angry"];

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

function isMediaVideo(url: string) {
  return /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(url);
}

type MediaPreviewState = {
  sources: string[];
  index: number;
};

function MediaGrid({ images, onPressMedia }: { images: string[]; onPressMedia?: (index: number) => void }) {
  const visible = images.slice(0, 4);

  if (visible.length === 0) return null;

  if (visible.length === 1) {
    return (
      <View style={styles.oneMediaWrap}>
        <MediaItem src={visible[0]} style={styles.singleMedia} onPress={onPressMedia ? () => onPressMedia(0) : undefined} />
      </View>
    );
  }

  return (
    <View style={[styles.mediaGrid, visible.length === 3 && styles.mediaGridThree, visible.length === 4 && styles.mediaGridFour]}>
      {visible.map((src, index) => (
        <MediaItem key={`${src}-${index}`} src={src} style={styles.gridMedia} onPress={onPressMedia ? () => onPressMedia(index) : undefined} />
      ))}
    </View>
  );
}

function MediaItem({ src, style, onPress }: { src: string; style: any; onPress?: () => void }) {
  if (isMediaVideo(src)) {
    const videoNode = (
      <View style={[style, styles.videoFrame]}>
        <Video source={{ uri: src }} style={styles.videoPlayer} resizeMode={ResizeMode.COVER} isLooping={false} shouldPlay={false} useNativeControls={false} />
        <View style={styles.videoBadge}>
          <Sparkles size={12} color="#bfdbfe" />
          <Text style={styles.videoBadgeText}>Video</Text>
        </View>
      </View>
    );

    return onPress ? <TouchableOpacity activeOpacity={0.9} onPress={onPress}>{videoNode}</TouchableOpacity> : videoNode;
  }

  return onPress ? <TouchableOpacity activeOpacity={0.9} onPress={onPress}><Image source={{ uri: src }} style={style} /></TouchableOpacity> : <Image source={{ uri: src }} style={style} />;
}

function visibilityLabel(visibility: Visibility) {
  if (visibility === "friends") return "Bạn bè";
  if (visibility === "private") return "Chỉ mình tôi";
  return "Công khai";
}

function getReactionUserId(reaction: Post["reactions"][number]) {
  return typeof reaction.userId === "object" && reaction.userId !== null ? reaction.userId._id : reaction.userId;
}

function getReactionUserName(reaction: Post["reactions"][number]) {
  if (typeof reaction.userId === "object" && reaction.userId !== null) {
    return reaction.userId.displayName || reaction.userId.username || "Người dùng";
  }
  return "Người dùng";
}

function getReactionUserAvatar(reaction: Post["reactions"][number]) {
  if (typeof reaction.userId === "object" && reaction.userId !== null) {
    return reaction.userId.avatarUrl || "";
  }
  return "";
}

type ReactionDetailItem = {
  userId: string;
  type: ReactionType;
  displayName: string;
  avatarUrl?: string;
  createdAt?: string;
};

type ReactionDetailResponse = {
  post: { reactions: ReactionDetailItem[] };
  images?: Array<{ imageId: string; reactions: ReactionDetailItem[] }>;
};

interface Props {
  post: Post;
  currentUserId: string;
  highlighted?: boolean;
  autoOpenComments?: boolean;
  onProfilePress?: (userId: string) => void;
  onOpenDetail?: () => void;
}

export default function SocialPostCard({
  post,
  currentUserId,
  highlighted = false,
  autoOpenComments = false,
  onProfilePress,
  onOpenDetail,
}: Props) {
  const router = useRouter();
  const { reactToPost, sharePost, deletePost } = usePostStore();
  const updatePost = usePostStore((state) => state.updatePost);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePrivacyOpen, setSharePrivacyOpen] = useState(false);
  const [showOwnerMenu, setShowOwnerMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReactionStats, setShowReactionStats] = useState(false);
  const [reactionDetail, setReactionDetail] = useState<ReactionDetailResponse | null>(null);
  const [reactionDetailLoading, setReactionDetailLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [shareCaption, setShareCaption] = useState("");
  const [shareVisibility, setShareVisibility] = useState<Visibility>("public");
  const [editCaption, setEditCaption] = useState(post.content || "");
  const [editVisibility, setEditVisibility] = useState<Visibility>(post.visibility || "public");
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<MediaPreviewState | null>(null);

  useEffect(() => {
    if (autoOpenComments) setCommentsOpen(true);
  }, [autoOpenComments]);

  const myReaction = useMemo(
    () => post.reactions.find((reaction) => getReactionUserId(reaction) === currentUserId),
    [post.reactions, currentUserId],
  );

  const timeAgo = formatRelativeTime(post.createdAt);

  const sharedFromAuthorName =
    post.sharedFrom?.author?.displayName || post.sharedFromAuthorName || "Người dùng";

  const sharedImages =
    (post.sharedFrom?.images && post.sharedFrom.images.length > 0
      ? post.sharedFrom.images
      : undefined) ||
    (post.sharedOriginalImages && post.sharedOriginalImages.length > 0
      ? post.sharedOriginalImages
      : undefined) ||
    [];

  const reactionGroups = useMemo(() => {
    return REACTION_TYPES.map((reactionType) => {
      const reactions = post.reactions.filter((reaction) => reaction.type === reactionType);
      return {
        type: reactionType,
        reactions,
      };
    });
  }, [post.reactions]);

  const totalReactions = post.reactionsCount ?? post.reactions.length;

  const handlePickReaction = async (reaction: ReactionType) => {
    setShowReactionPicker(false);
    await reactToPost(post._id, reaction);
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      await sharePost(post._id, shareCaption.trim(), shareVisibility);
      setShowShareModal(false);
      setShareCaption("");
      setShareVisibility("public");
      setSharePrivacyOpen(false);
    } finally {
      setSharing(false);
    }
  };

  useEffect(() => {
    if (!showShareModal) {
      setSharePrivacyOpen(false);
    }
  }, [showShareModal]);

  useEffect(() => {
    if (!showReactionStats) {
      setReactionDetail(null);
      return;
    }

    let active = true;
    setReactionDetailLoading(true);
    void postService.getReactionsDetail(post._id)
      .then((data: ReactionDetailResponse) => {
        if (active) setReactionDetail(data);
      })
      .catch(() => {
        if (active) setReactionDetail(null);
      })
      .finally(() => {
        if (active) setReactionDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [post._id, showReactionStats]);

  useEffect(() => {
    setEditCaption(post.content || "");
    setEditVisibility(post.visibility || "public");
  }, [post.content, post.visibility]);

  const confirmDelete = () => {
    Alert.alert("Xoá bài viết", "Bạn muốn xoá bài viết này?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Xoá",
        style: "destructive",
        onPress: () => void deletePost(post._id),
      },
    ]);
  };

  const handleSaveEdit = async () => {
    setEditing(true);
    try {
      await updatePost(post._id, {
        content: editCaption.trim(),
        visibility: editVisibility,
      });
      setShowEditModal(false);
      setShowOwnerMenu(false);
    } finally {
      setEditing(false);
    }
  };

  const goProfile = () => {
    const target = post.author?._id;
    if (!target) return;
    if (onProfilePress) {
      onProfilePress(target);
      return;
    }
    router.push(`/profile/${target}` as never);
  };

  return (
    <>
      <View style={[styles.card, highlighted && styles.cardHighlighted]}>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={onOpenDetail}
          disabled={!onOpenDetail}
          style={styles.detailHitArea}
        >
          <View style={styles.header}>
          <TouchableOpacity style={styles.authorRow} onPress={goProfile} activeOpacity={0.8}>
            <Avatar name={post.author?.displayName || "Người dùng"} avatarUrl={post.author?.avatarUrl} />
            <View style={styles.authorMeta}>
              <Text style={styles.authorName} numberOfLines={1}>{post.author?.displayName || "Người dùng"}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{timeAgo}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.visibilityText}>{visibilityLabel(post.visibility)}</Text>
              </View>
            </View>
          </TouchableOpacity>

          {String(post.author?._id) === String(currentUserId) ? (
            <TouchableOpacity style={styles.moreBtn} onPress={() => setShowOwnerMenu(true)}>
              <MoreHorizontal size={18} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
          </View>

          {post.content ? <Text style={styles.content}>{post.content}</Text> : null}

          {post.images?.length ? <MediaGrid images={post.images} onPressMedia={(index) => setMediaPreview({ sources: post.images || [], index })} /> : null}

          {post.sharedFrom || post.sharedFromAuthorName || post.sharedOriginalContent ? (
            <View style={styles.sharedBlock}>
              <View style={styles.sharedHeader}>
                <CornerDownRight size={14} color="#60a5fa" />
                <Text style={styles.sharedLabel}>Bài được chia sẻ từ {sharedFromAuthorName}</Text>
              </View>
              {post.sharedOriginalContent ? <Text style={styles.sharedContent}>{post.sharedOriginalContent}</Text> : null}
              {sharedImages.length ? <MediaGrid images={sharedImages} onPressMedia={(index) => setMediaPreview({ sources: sharedImages, index })} /> : null}
            </View>
          ) : null}

          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statPill} onPress={() => setShowReactionStats(true)}>
              <ThumbsUp size={13} color="#94a3b8" />
              <Text style={styles.statText}>{totalReactions}</Text>
            </TouchableOpacity>
            <Text style={styles.statText}>{post.commentsCount || 0} bình luận</Text>
            <Text style={styles.statText}>{post.sharesCount || 0} chia sẻ</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.actionBtn, myReaction && styles.actionBtnActive]} onPress={() => setShowReactionPicker(true)}>
            <Text style={styles.actionEmoji}>{myReaction ? REACTION_EMOJI[myReaction.type] : "👍"}</Text>
            <Text style={[styles.actionText, myReaction && styles.actionTextActive]}>{myReaction ? REACTION_LABEL[myReaction.type] : "Thích"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, commentsOpen && styles.actionBtnActive]} onPress={() => setCommentsOpen(true)}>
            <MessageCircle size={16} color={commentsOpen ? "#bfdbfe" : "#94a3b8"} />
            <Text style={[styles.actionText, commentsOpen && styles.actionTextActive]}>Bình luận</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowShareModal(true)}>
            <Share2 size={16} color="#94a3b8" />
            <Text style={styles.actionText}>Chia sẻ</Text>
          </TouchableOpacity>
        </View>
      </View>

      <CommentModal visible={commentsOpen} post={post} currentUserId={currentUserId} onClose={() => setCommentsOpen(false)} />

      <Modal visible={showReactionStats} transparent animationType="fade" onRequestClose={() => setShowReactionStats(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowReactionStats(false)} />
        <View style={styles.statsSheet}>
          <View style={styles.reactionTitleRow}>
            <Text style={styles.reactionTitle}>Thống kê react</Text>
            <TouchableOpacity onPress={() => setShowReactionStats(false)}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <View style={styles.reactionStatsList}>
            {reactionGroups.map(({ type, reactions }) => {
              const detailReactions = reactionDetail?.post.reactions.filter((reaction) => reaction.type === type) || [];
              const visibleReactions = detailReactions.length > 0 ? detailReactions : reactions;
              const count = reactions.length;
              if (!count) return null;
              const sampleNames = detailReactions.length > 0
                ? detailReactions.slice(0, 3).map((reaction) => reaction.displayName).filter(Boolean)
                : reactions.slice(0, 3).map((reaction) => getReactionUserName(reaction)).filter(Boolean);
              return (
                <View key={type} style={styles.reactionStatItem}>
                  <View style={styles.reactionStatHeader}>
                    <Text style={styles.reactionStatEmoji}>{REACTION_EMOJI[type]}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reactionStatLabel}>{REACTION_LABEL[type]}</Text>
                      <Text style={styles.reactionStatCount}>{count} người</Text>
                    </View>
                  </View>

                  {reactionDetailLoading ? <Text style={styles.reactionStatPeople}>Đang tải danh sách người react...</Text> : null}
                  {sampleNames.length > 0 ? (
                    <Text style={styles.reactionStatPeople}>
                      {sampleNames.join(", ")}
                      {count > sampleNames.length ? ` và ${count - sampleNames.length} người khác` : ""}
                    </Text>
                  ) : null}

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionPeopleRow}>
                    {visibleReactions.map((reaction, index) => (
                      <View key={`${getReactionUserId(reaction)}-${index}`} style={styles.reactionPersonChip}>
                        {reactionDetail && detailReactions.length > 0 && reaction.avatarUrl ? (
                          <Image source={{ uri: reaction.avatarUrl }} style={styles.reactionPersonAvatar} />
                        ) : (
                          <View style={styles.reactionPersonFallback}>
                            <Text style={styles.reactionPersonFallbackText}>
                              {(reactionDetail && detailReactions.length > 0
                                ? reaction.displayName
                                : getReactionUserName(reaction)
                              ).slice(0, 1).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.reactionPersonName} numberOfLines={1}>
                          {reactionDetail && detailReactions.length > 0 ? reaction.displayName : getReactionUserName(reaction)}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal visible={showOwnerMenu} transparent animationType="fade" onRequestClose={() => setShowOwnerMenu(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowOwnerMenu(false)} />
        <View style={styles.ownerSheet}>
          <Text style={styles.ownerTitle}>Tùy chọn bài viết</Text>
          <TouchableOpacity style={styles.ownerAction} onPress={() => { setShowOwnerMenu(false); setShowEditModal(true); }}>
            <Text style={styles.ownerActionText}>Chỉnh sửa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ownerAction, styles.ownerActionDanger]} onPress={() => { setShowOwnerMenu(false); confirmDelete(); }}>
            <Text style={[styles.ownerActionText, styles.ownerActionDangerText]}>Xoá bài viết</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ownerCancel} onPress={() => setShowOwnerMenu(false)}>
            <Text style={styles.ownerCancelText}>Đóng</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <Pressable style={styles.overlay} onPress={() => { Keyboard.dismiss(); if (!editing) setShowEditModal(false); }} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardRoot}>
          <View style={styles.editSheet}>
            <View style={styles.reactionTitleRow}>
              <Text style={styles.reactionTitle}>Chỉnh sửa bài viết</Text>
              <View style={styles.keyboardActionRow}>
                <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.keyboardHideBtn}>
                  <Text style={styles.keyboardHideText}>Ẩn</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowEditModal(false)} disabled={editing}>
                  <X size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>

            <TextInput
              value={editCaption}
              onChangeText={setEditCaption}
              placeholder="Nội dung bài viết"
              placeholderTextColor="#64748b"
              multiline
              style={styles.shareInput}
            />

            <View style={styles.visibilityRow}>
            {(["public", "friends", "private"] as Visibility[]).map((visibility) => (
              <TouchableOpacity
                key={visibility}
                style={[styles.visibilityChip, editVisibility === visibility && styles.visibilityChipActive]}
                onPress={() => setEditVisibility(visibility)}
              >
                <Text style={[styles.visibilityChipText, editVisibility === visibility && styles.visibilityChipTextActive]}>{visibilityLabel(visibility)}</Text>
              </TouchableOpacity>
            ))}
            </View>

            <TouchableOpacity style={styles.shareAction} onPress={() => void handleSaveEdit()} disabled={editing}>
              <Text style={styles.shareActionText}>{editing ? "Đang lưu..." : "Lưu thay đổi"}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!mediaPreview} transparent animationType="slide" onRequestClose={() => setMediaPreview(null)}>
        <Pressable style={styles.overlay} onPress={() => setMediaPreview(null)} />
        {mediaPreview ? (
          <View style={styles.mediaSheet}>
            <View style={styles.reactionTitleRow}>
              <Text style={styles.reactionTitle}>{mediaPreview.index + 1}/{mediaPreview.sources.length}</Text>
              <TouchableOpacity onPress={() => setMediaPreview(null)}>
                <X size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <View style={styles.mediaPreviewFrame}>
              {isMediaVideo(mediaPreview.sources[mediaPreview.index]) ? (
                <View style={styles.mediaVideoFrame}>
                  <Sparkles size={22} color="#bfdbfe" />
                  <Text style={styles.mediaVideoText}>Video xem nhanh</Text>
                  <Text style={styles.mediaVideoSubtext}>Mở bài viết để xem mô tả và tương tác.</Text>
                </View>
              ) : (
                <Image source={{ uri: mediaPreview.sources[mediaPreview.index] }} style={styles.mediaPreviewImage} resizeMode="contain" />
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaThumbRow}>
              {mediaPreview.sources.map((src, index) => (
                <TouchableOpacity
                  key={`${src}-${index}`}
                  onPress={() => setMediaPreview((current) => (current ? { ...current, index } : current))}
                  style={[styles.mediaThumbWrap, mediaPreview.index === index && styles.mediaThumbWrapActive]}
                >
                  {isMediaVideo(src) ? (
                    <View style={styles.mediaThumbVideo}>
                      <Sparkles size={14} color="#bfdbfe" />
                    </View>
                  ) : (
                    <Image source={{ uri: src }} style={styles.mediaThumb} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.mediaNavRow}>
              <TouchableOpacity
                style={[styles.mediaNavBtn, mediaPreview.index === 0 && styles.mediaNavBtnDisabled]}
                onPress={() => setMediaPreview((current) => (current && current.index > 0 ? { ...current, index: current.index - 1 } : current))}
                disabled={mediaPreview.index === 0}
              >
                <Text style={styles.mediaNavText}>Trước</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.mediaNavBtn, mediaPreview.index === mediaPreview.sources.length - 1 && styles.mediaNavBtnDisabled]}
                onPress={() => setMediaPreview((current) => (current && current.index < current.sources.length - 1 ? { ...current, index: current.index + 1 } : current))}
                disabled={mediaPreview.index === mediaPreview.sources.length - 1}
              >
                <Text style={styles.mediaNavText}>Sau</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </Modal>

      <Modal visible={showReactionPicker} transparent animationType="fade" onRequestClose={() => setShowReactionPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowReactionPicker(false)} />
        <View style={styles.reactionSheet}>
          <View style={styles.reactionTitleRow}>
            <Text style={styles.reactionTitle}>Chọn cảm xúc</Text>
            <TouchableOpacity onPress={() => setShowReactionPicker(false)}>
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionRow}>
            {REACTION_TYPES.map((reaction) => (
              <TouchableOpacity
                key={reaction}
                style={[styles.reactionItem, myReaction?.type === reaction && styles.reactionItemActive]}
                onPress={() => void handlePickReaction(reaction)}
              >
                <Text style={styles.reactionEmoji}>{REACTION_EMOJI[reaction]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showShareModal} transparent animationType="slide" onRequestClose={() => setShowShareModal(false)}>
        <Pressable style={styles.overlay} onPress={() => { Keyboard.dismiss(); if (!sharing) setShowShareModal(false); }} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.keyboardRoot}>
          <View style={styles.shareSheet}>
            <View style={styles.shareHeader}>
              <View style={styles.shareAuthorRow}>
                <Avatar name={post.author?.displayName || "Người dùng"} avatarUrl={post.author?.avatarUrl} />
                <View style={styles.shareAuthorMeta}>
                  <Text style={styles.authorName} numberOfLines={1}>{post.author?.displayName || "Người dùng"}</Text>
                  <Text style={styles.shareAuthorSub}>Chia sẻ lại bài viết này</Text>
                </View>
              </View>
              <View style={styles.keyboardActionRow}>
                <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.keyboardHideBtn}>
                  <Text style={styles.keyboardHideText}>Ẩn</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowShareModal(false)} disabled={sharing}>
                  <X size={16} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sharePrivacyWrap}>
              <TouchableOpacity style={styles.sharePrivacyBtn} onPress={() => setSharePrivacyOpen((current) => !current)}>
                <Text style={styles.sharePrivacyLabel}>Quyền riêng tư</Text>
                <Text style={styles.sharePrivacyValue}>{visibilityLabel(shareVisibility)}</Text>
              </TouchableOpacity>
              {sharePrivacyOpen ? (
                <View style={styles.sharePrivacyMenu}>
                  {(["public", "friends", "private"] as Visibility[]).map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.sharePrivacyItem, shareVisibility === item && styles.sharePrivacyItemActive]}
                      onPress={() => {
                        setShareVisibility(item);
                        setSharePrivacyOpen(false);
                      }}
                    >
                      <Text style={[styles.sharePrivacyItemText, shareVisibility === item && styles.sharePrivacyItemTextActive]}>
                        {item === "public" ? "Công khai" : item === "friends" ? "Bạn bè" : "Riêng tư"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            <TextInput
              value={shareCaption}
              onChangeText={setShareCaption}
              placeholder="Thêm cảm nghĩ của bạn..."
              placeholderTextColor="#64748b"
              multiline
              style={styles.shareInput}
            />

            <TouchableOpacity style={styles.shareAction} onPress={() => void handleShare()} disabled={sharing}>
              <Text style={styles.shareActionText}>{sharing ? "Đang chia sẻ..." : "Chia sẻ ngay"}</Text>
              <Send size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  cardHighlighted: {
    borderColor: "rgba(96,165,250,0.55)",
    shadowColor: "#60a5fa",
    shadowOpacity: 0.16,
    shadowRadius: 18,
  },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 },
  detailHitArea: { gap: 0 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatarImage: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#0f172a" },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1d4ed8", alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  authorMeta: { flex: 1 },
  authorName: { color: "#e2e8f0", fontSize: 15, fontWeight: "800" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" },
  metaText: { color: "#94a3b8", fontSize: 11 },
  metaDot: { color: "#475569", fontSize: 11 },
  visibilityText: { color: "#7dd3fc", fontSize: 11, fontWeight: "700" },
  moreBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.03)" },
  content: { color: "#e2e8f0", fontSize: 14, lineHeight: 21, marginBottom: 12 },
  oneMediaWrap: { borderRadius: 22, overflow: "hidden", marginBottom: 12, backgroundColor: "#0b1220" },
  singleMedia: { width: "100%", height: 280, backgroundColor: "#0b1220" },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 12 },
  mediaGridThree: {},
  mediaGridFour: {},
  gridMedia: { width: "49%", height: 160, borderRadius: 18, backgroundColor: "#0b1220" },
  videoFrame: { backgroundColor: "#0f172a", overflow: "hidden", alignItems: "flex-start", justifyContent: "flex-end" },
  videoPlayer: { ...StyleSheet.absoluteFillObject },
  videoBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", margin: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(15,23,42,0.75)" },
  videoBadgeText: { color: "#bfdbfe", fontSize: 10, fontWeight: "800" },
  sharedBlock: { marginBottom: 12, padding: 12, borderRadius: 22, backgroundColor: "rgba(15,23,42,0.85)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  sharedHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sharedLabel: { color: "#93c5fd", fontSize: 12, fontWeight: "700", flex: 1 },
  sharedContent: { color: "#cbd5e1", fontSize: 13, lineHeight: 19, marginBottom: 10 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" },
  statPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.04)" },
  statText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBtn: { flex: 1, minHeight: 42, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" },
  actionBtnActive: { backgroundColor: "rgba(59,130,246,0.16)", borderColor: "rgba(59,130,246,0.3)" },
  actionEmoji: { fontSize: 16 },
  actionText: { color: "#94a3b8", fontSize: 12, fontWeight: "800" },
  actionTextActive: { color: "#bfdbfe" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.52)" },
  reactionSheet: { position: "absolute", left: 14, right: 14, bottom: 20, borderRadius: 24, backgroundColor: "#07111f", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 14 },
  reactionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  reactionTitle: { color: "#e2e8f0", fontSize: 15, fontWeight: "800" },
  reactionRow: { flexDirection: "row", gap: 8, paddingHorizontal: 2 },
  reactionItem: { width: 58, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.04)" },
  reactionItemActive: { backgroundColor: "rgba(59,130,246,0.18)" },
  reactionEmoji: { fontSize: 23 },
  shareSheet: { position: "absolute", left: 14, right: 14, bottom: 16, borderRadius: 28, backgroundColor: "#07111f", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 16 },
  shareHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  shareAuthorRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  shareAuthorMeta: { flex: 1 },
  shareAuthorSub: { color: "#94a3b8", fontSize: 11, marginTop: 2, fontWeight: "600" },
  sharePrivacyWrap: { marginBottom: 12, position: "relative" },
  sharePrivacyBtn: { minHeight: 44, borderRadius: 18, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sharePrivacyLabel: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  sharePrivacyValue: { color: "#e2e8f0", fontSize: 12, fontWeight: "800" },
  sharePrivacyMenu: { position: "absolute", left: 0, right: 0, top: 50, borderRadius: 18, padding: 8, backgroundColor: "#0b1526", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", zIndex: 10 },
  sharePrivacyItem: { minHeight: 42, borderRadius: 14, justifyContent: "center", paddingHorizontal: 12 },
  sharePrivacyItemActive: { backgroundColor: "rgba(59,130,246,0.16)" },
  sharePrivacyItemText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  sharePrivacyItemTextActive: { color: "#bfdbfe" },
  shareInput: { minHeight: 96, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.04)", color: "#e2e8f0", fontSize: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, textAlignVertical: "top" },
  shareAction: { minHeight: 48, borderRadius: 18, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  shareActionText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  statsSheet: { position: "absolute", left: 14, right: 14, bottom: 16, borderRadius: 26, backgroundColor: "#07111f", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 16 },
  reactionStatsList: { gap: 8 },
  reactionStatItem: { padding: 12, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.04)" },
  reactionStatHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  reactionStatEmoji: { fontSize: 18, width: 24, textAlign: "center" },
  reactionStatLabel: { color: "#e2e8f0", fontSize: 13, fontWeight: "700" },
  reactionStatCount: { color: "#bfdbfe", fontSize: 12, fontWeight: "800", marginTop: 1 },
  reactionStatPeople: { color: "#cbd5e1", fontSize: 11, lineHeight: 17, marginBottom: 10 },
  reactionPeopleRow: { gap: 8, paddingBottom: 2 },
  reactionPersonChip: { width: 82, alignItems: "center", gap: 6 },
  reactionPersonAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#0f172a" },
  reactionPersonFallback: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#1d4ed8" },
  reactionPersonFallbackText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  reactionPersonName: { color: "#cbd5e1", fontSize: 11, fontWeight: "700", textAlign: "center" },
  ownerSheet: { position: "absolute", left: 14, right: 14, bottom: 16, borderRadius: 24, backgroundColor: "#07111f", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 16 },
  ownerTitle: { color: "#e2e8f0", fontSize: 15, fontWeight: "900", marginBottom: 10 },
  ownerAction: { minHeight: 48, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  ownerActionText: { color: "#e2e8f0", fontSize: 14, fontWeight: "800" },
  ownerActionDanger: { backgroundColor: "rgba(239,68,68,0.14)" },
  ownerActionDangerText: { color: "#fca5a5" },
  ownerCancel: { minHeight: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  ownerCancelText: { color: "#94a3b8", fontSize: 13, fontWeight: "800" },
  editSheet: { position: "absolute", left: 14, right: 14, bottom: 16, borderRadius: 28, backgroundColor: "#07111f", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 16 },
  mediaSheet: { position: "absolute", left: 14, right: 14, bottom: 16, borderRadius: 28, backgroundColor: "#07111f", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", padding: 16 },
  mediaPreviewFrame: { height: 300, borderRadius: 22, overflow: "hidden", backgroundColor: "#050b16", marginBottom: 12, alignItems: "center", justifyContent: "center" },
  mediaPreviewImage: { width: "100%", height: "100%" },
  mediaVideoFrame: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  mediaVideoText: { color: "#e2e8f0", fontSize: 15, fontWeight: "900", marginTop: 10 },
  mediaVideoSubtext: { color: "#94a3b8", fontSize: 12, marginTop: 4, textAlign: "center" },
  mediaThumbRow: { gap: 8, paddingVertical: 4, marginBottom: 10 },
  mediaThumbWrap: { width: 52, height: 52, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "transparent", backgroundColor: "rgba(255,255,255,0.04)" },
  mediaThumbWrapActive: { borderColor: "rgba(96,165,250,0.8)" },
  mediaThumb: { width: "100%", height: "100%" },
  mediaThumbVideo: { flex: 1, alignItems: "center", justifyContent: "center" },
  mediaNavRow: { flexDirection: "row", gap: 10 },
  mediaNavBtn: { flex: 1, minHeight: 44, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },
  mediaNavBtnDisabled: { opacity: 0.4 },
  mediaNavText: { color: "#e2e8f0", fontSize: 13, fontWeight: "800" },
  keyboardRoot: { flex: 1, justifyContent: "flex-end" },
  keyboardActionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  keyboardHideBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)" },
  keyboardHideText: { color: "#bfdbfe", fontSize: 11, fontWeight: "800" },
});