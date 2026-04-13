export const formatTime = (date?: string) => {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getInitials = (name = "") => {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

export const mapConversation = (conv: any, myId: string) => {
  const isGroup = conv.type === "group";

  let name = "";
  let otherUser: any;

  if (isGroup) {
    name = conv.group?.name || "Nhóm";
  } else {
    otherUser = conv.participants.find((p: any) => p._id !== myId);
    name = otherUser?.displayName || "Unknown";
  }

  return {
    id: conv._id,
    name,
    avatar: getInitials(name),
    avatarColor: "#3b82f6",
    lastMessage: conv.lastMessage?.content || "Chưa có tin nhắn",
    time: formatTime(conv.lastMessageAt),
    unread: conv.unreadCounts?.[myId] || 0,
    online: false,
  };
};


export const mapMessage = (msg: any, myId: string) => {
  return {
    id: msg._id,
    senderId: msg.senderId._id === myId ? "me" : "them",
    text: msg.content,
    time: formatTime(msg.createdAt),
    status: "read",
    type: "text",
  };
};