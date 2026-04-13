export function formatTime(date: string) {
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function mapConversation(conv: any, currentUserId: string) {
  const otherParticipant = conv.participants.find(
    (p: any) => p.userId !== currentUserId,
  );

  return {
    id: conv._id,

    name:
      conv.type === "group"
        ? "Nhóm chat"
        : "User " + otherParticipant?.userId?.slice(-4),

    avatar: conv.type === "group" ? "GR" : "U",
    avatarColor: conv.type === "group" ? "#8b5cf6" : "#3b82f6",

    lastMessage: conv.lastMessage?.content || "",
    time: formatTime(conv.lastMessage?.createdAt),

    unread: conv.unreadCounts?.[currentUserId] || 0,

    online: false,
    pinned: false,
    messages: [],
  };
}
