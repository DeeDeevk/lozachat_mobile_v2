export type ReactionType = "like" | "love" | "haha" | "wow" | "sad" | "angry";
export type Visibility = "public" | "friends" | "private";

export interface Author {
  _id: string;
  displayName: string;
  avatarUrl?: string;
}

export interface SharedPostRef {
  _id: string;
  author?: Author;
  content: string;
  images: string[];
  visibility: Visibility;
  createdAt: string;
}

export interface Reaction {
  userId: string | {
    _id: string;
    displayName: string;
    avatarUrl?: string;
    username?: string;
  };
  type: ReactionType;
  createdAt?: string;
}

export interface Post {
  _id: string;
  author: Author;
  content: string;
  images: string[];
  sharedFrom?: SharedPostRef | null;
  sharedFromAuthorName?: string;
  sharedFromAuthorAvatarUrl?: string;
  sharedFromAuthorId?: string;
  sharedOriginalContent?: string;
  sharedOriginalImages?: string[];
  reactions: Reaction[];
  commentsCount: number;
  sharesCount?: number;
  reactionsCount?: number; // virtual từ backend
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
}

export interface PostImage {
  _id: string;
  postId: string;
  url: string;
  order: number;
  reactions: Reaction[];
  reactionsCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface Comment {
  _id: string;
  postId: string;
  author: Author;
  content: string;
  parentId: string | { _id: string; author: Author; content: string } | null;
  imageId: string | null;
  images: string[];
  audioUrl?: string | null;
  reactions: Reaction[];
  reactionsCount: number;
  repliesCount: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
  hasMore: boolean;
}

export interface PostsResponse {
  posts: Post[];
  pagination: Pagination;
}

export interface CommentsResponse {
  comments: Comment[];
  pagination: Pagination;
}

export const REACTION_EMOJI: Record<ReactionType, string> = {
  like: "👍",
  love: "❤️",
  haha: "😂",
  wow: "😮",
  sad: "😢",
  angry: "😡",
};

export const REACTION_LABEL: Record<ReactionType, string> = {
  like: "Thích",
  love: "Yêu thích",
  haha: "Haha",
  wow: "Wow",
  sad: "Buồn",
  angry: "Phẫn nộ",
};

export const COMMENT_PLACEHOLDER = "Viết bình luận...";

export type NotificationType = "react" | "comment" | "reply" | "share" | "react_comment";

export interface NotificationItem {
  _id: string;
  userId: string;
  actorId: { _id: string; displayName: string; avatarUrl?: string };
  type: NotificationType;
  postId?: { _id: string; content: string; author: string; images?: string[] };
  commentId?: { _id: string; content: string };
  read: boolean;
  meta?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface SearchUser {
  _id: string;
  displayName: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface SearchResponse {
  posts: Post[];
  users: SearchUser[];
  query: string;
}
