export interface User {
  _id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Friend {
  _id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isOnline?: boolean;
  isNew?: boolean;
}

export type RequestStatus =
  | "none"
  | "sent" // current user đã gửi → chờ họ phản hồi
  | "received" // họ đã gửi cho current user → cần phản hồi
  | "friend" // đã là bạn bè
  | "self"; // chính mình

export interface FriendRequest {
  _id: string;
  from?: {
    _id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  to?: {
    _id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  message: string;
  createdAt: string;
  updatedAt: string;
}
