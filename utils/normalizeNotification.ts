import type { NotificationItem } from "@/types/post";

function toId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "_id" in value) {
    return toId((value as { _id: unknown })._id);
  }
  return String(value);
}

export function normalizeNotification(item: NotificationItem): NotificationItem {
  return {
    ...item,
    _id: toId(item._id),
    userId: toId(item.userId),
    actorId: {
      ...item.actorId,
      _id: toId(item.actorId?._id),
    },
    postId: item.postId
      ? {
          ...item.postId,
          _id: toId(item.postId._id),
        }
      : item.postId,
    commentId: item.commentId
      ? {
          ...item.commentId,
          _id: toId(item.commentId._id),
        }
      : item.commentId,
  };
}