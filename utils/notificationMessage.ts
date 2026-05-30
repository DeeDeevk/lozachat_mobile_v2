import type { NotificationItem, NotificationType, ReactionType } from "@/types/post";
import { REACTION_EMOJI, REACTION_LABEL } from "@/types/post";

function clip(value: string, len = 42) {
  const text = (value || "").trim();
  if (!text) return "";
  return text.length > len ? `${text.slice(0, len)}...` : text;
}

function reactionText(type?: string) {
  const t = type as ReactionType | undefined;
  if (!t || !REACTION_LABEL[t]) return { label: "thích", emoji: "👍" };
  return { label: REACTION_LABEL[t], emoji: REACTION_EMOJI[t] };
}

export function getNotifMessage(n: NotificationItem): string {
  const actor = n.actorId?.displayName || "Ai đó";

  switch (n.type) {
    case "react": {
      const { label, emoji } = reactionText(n.meta?.reactionType);
      return `${actor} đã ${label} bài viết của bạn ${emoji}`;
    }
    case "comment": {
      const preview = clip(n.commentId?.content || "");
      return preview ? `${actor} đã bình luận: ${preview}` : `${actor} đã bình luận bài viết của bạn`;
    }
    case "reply": {
      const preview = clip(n.commentId?.content || "");
      return preview ? `${actor} đã trả lời: ${preview}` : `${actor} đã trả lời bình luận của bạn`;
    }
    case "share": {
      const caption = clip(n.meta?.shareCaption || "");
      return caption ? `${actor} đã chia sẻ bài viết của bạn: ${caption}` : `${actor} đã chia sẻ bài viết của bạn`;
    }
    case "react_comment": {
      const { label, emoji } = reactionText(n.meta?.reactionType);
      const preview = clip(n.commentId?.content || "");
      return preview
        ? `${actor} đã ${label} bình luận của bạn ${emoji}: ${preview}`
        : `${actor} đã ${label} bình luận của bạn ${emoji}`;
    }
    default:
      return `${actor} có hoạt động mới`;
  }
}

export function getNotifSubtext(n: NotificationItem): string | null {
  const postPreview = clip(n.postId?.content || "", 60);
  if (!postPreview) return null;
  if (n.type === "share" || n.type === "react") {
    return `Bài viết: "${postPreview}"`;
  }
  return postPreview;
}

export const NOTIF_TOAST_ICON: Record<NotificationType, string> = {
  react: "👍",
  comment: "💬",
  reply: "↩️",
  share: "🔁",
  react_comment: "👍🏻",
};