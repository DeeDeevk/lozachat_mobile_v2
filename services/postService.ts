import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosInstance from "../lib/axios";
import type {
  Comment,
  CommentsResponse,
  Post,
  PostImage,
  PostsResponse,
  ReactionType,
  Visibility,
} from "../types/post";

// 🔥 helper auth
const getAuthHeader = async () => {
  const token = await AsyncStorage.getItem("accessToken");
  return {
    Authorization: `Bearer ${token}`,
  };
};

// 🔥 helper convert file mobile
const getExtensionFromMime = (mimeType?: string) => {
  if (!mimeType) return "";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  if (mimeType === "video/mp4") return "mp4";
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "video/webm") return "webm";
  if (mimeType === "video/ogg") return "ogg";
  if (mimeType === "video/x-m4v") return "m4v";
  if (mimeType === "video/x-matroska") return "mkv";
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return "m4a";
  return "";
};

const inferMimeType = (file: any) => {
  const rawType = String(file?.mimeType || file?.type || "").toLowerCase();
  if (rawType.startsWith("image/")) return rawType;
  if (rawType.startsWith("video/")) return rawType;
  if (rawType.startsWith("audio/")) return rawType;
  if (rawType.includes("video")) return "video/mp4";
  if (rawType.includes("audio")) return "audio/mp4";
  if (rawType.includes("png")) return "image/png";
  if (rawType.includes("gif")) return "image/gif";
  if (rawType.includes("webp")) return "image/webp";
  if (rawType.includes("heic")) return "image/heic";
  if (rawType.includes("heif")) return "image/heif";
  if (rawType.includes("jpg") || rawType.includes("jpeg") || rawType.includes("image")) return "image/jpeg";

  const uri = String(file?.uri || "").toLowerCase();
  if (uri.endsWith(".mp4")) return "video/mp4";
  if (uri.endsWith(".mov")) return "video/quicktime";
  if (uri.endsWith(".webm")) return "video/webm";
  if (uri.endsWith(".ogg")) return "video/ogg";
  if (uri.endsWith(".m4v")) return "video/x-m4v";
  if (uri.endsWith(".mkv")) return "video/x-matroska";
  if (uri.endsWith(".m4a")) return "audio/mp4";
  if (uri.endsWith(".png")) return "image/png";
  if (uri.endsWith(".gif")) return "image/gif";
  if (uri.endsWith(".webp")) return "image/webp";
  if (uri.endsWith(".heic")) return "image/heic";
  if (uri.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
};

const buildFile = (file: any) => {
  const mimeType = inferMimeType(file);
  const extension = getExtensionFromMime(mimeType);
  const fileName = String(file?.fileName || file?.name || `file-${Date.now()}`).trim();
  const hasExtension = /\.[a-z0-9]+$/i.test(fileName);

  return {
    uri: file.uri,
    name: hasExtension ? fileName : `${fileName}${extension ? `.${extension}` : ""}`,
    type: mimeType,
  };
};

export const postService = {
  // ─── Posts ───────────────────────────────────────────────────

  getPosts: async (page = 1, limit = 10): Promise<PostsResponse> => {
    const headers = await getAuthHeader();
    const { data } = await axiosInstance.get("/posts", {
      params: { page, limit },
      headers,
    });
    return data;
  },

  getUserPosts: async (userId: string, page = 1): Promise<PostsResponse> => {
    const headers = await getAuthHeader();
    const { data } = await axiosInstance.get(`/posts/user/${userId}`, {
      params: { page },
      headers,
    });
    return data;
  },

  getById: async (id: string): Promise<Post> => {
    const headers = await getAuthHeader();
    const { data } = await axiosInstance.get(`/posts/${id}`, { headers });
    return data;
  },

  createPost: async (
    content: string,
    images: any[] = [],
    visibility: Visibility = "public",
  ): Promise<Post> => {
    const headers = await getAuthHeader();

    const fd = new FormData();
    fd.append("content", content);
    fd.append("visibility", visibility);

    images.forEach((img) => {
      fd.append("images", buildFile(img) as any);
    });

    const { data } = await axiosInstance.post("/posts", fd, {
      headers: {
        ...headers,
        "Content-Type": "multipart/form-data",
      },
    });

    return data;
  },

  updatePost: async (
    id: string,
    content: string,
    newImages: any[] = [],
    removeImages: string[] = [],
    visibility?: Visibility,
  ): Promise<Post> => {
    const headers = await getAuthHeader();

    const fd = new FormData();
    fd.append("content", content);

    if (visibility) fd.append("visibility", visibility);

    newImages.forEach((img) => {
      fd.append("images", buildFile(img) as any);
    });

    removeImages.forEach((url) => {
      fd.append("removeImages", url);
    });

    const { data } = await axiosInstance.put(`/posts/${id}`, fd, {
      headers: {
        ...headers,
        "Content-Type": "multipart/form-data",
      },
    });

    return data;
  },

  deletePost: async (id: string): Promise<void> => {
    const headers = await getAuthHeader();
    await axiosInstance.delete(`/posts/${id}`, { headers });
  },

  sharePost: async (
    postId: string,
    content = "",
    visibility: Visibility = "public",
  ): Promise<Post> => {
    const headers = await getAuthHeader();
    const { data } = await axiosInstance.post(
      `/posts/${postId}/share`,
      { content, visibility },
      { headers },
    );
    return data;
  },

  reactToPost: async (postId: string, type: ReactionType): Promise<Post> => {
    const headers = await getAuthHeader();
    const { data } = await axiosInstance.post(
      `/posts/${postId}/react`,
      { type },
      { headers },
    );
    return data;
  },

  getReactionsDetail: async (postId: string): Promise<any> => {
    const headers = await getAuthHeader();
    const { data } = await axiosInstance.get(`/posts/${postId}/reactions-detail`, {
      headers,
    });
    return data;
  },

  // ─── Images ──────────────────────────────────────────────────

  getPostImages: async (postId: string): Promise<PostImage[]> => {
    const headers = await getAuthHeader();
    const { data } = await axiosInstance.get(`/posts/${postId}/images`, {
      headers,
    });
    return data;
  },

  reactToImage: async (
    postId: string,
    imageId: string,
    type: ReactionType,
  ): Promise<PostImage> => {
    const headers = await getAuthHeader();
    const { data } = await axiosInstance.post(
      `/posts/${postId}/images/${imageId}/react`,
      { type },
      { headers },
    );
    return data;
  },

  // ─── Comments ────────────────────────────────────────────────

  getComments: async (
    postId: string,
    imageId?: string,
    page = 1,
  ): Promise<CommentsResponse> => {
    const headers = await getAuthHeader();

    const { data } = await axiosInstance.get(`/posts/${postId}/comments`, {
      params: { page, ...(imageId ? { imageId } : {}) },
      headers,
    });

    return data;
  },

  addComment: async (
    postId: string,
    content: string,
    parentId: string | null = null,
    imageFiles: any[] = [],
    imageId: string | null = null,
    audioFile: any | null = null,
  ): Promise<Comment> => {
    const headers = await getAuthHeader();

    const fd = new FormData();

    if (content?.trim()) fd.append("content", content.trim());
    if (parentId) fd.append("parentId", parentId);
    if (imageId) fd.append("imageId", imageId);

    imageFiles.forEach((f) => {
      fd.append("images", buildFile(f) as any);
    });

    if (audioFile) {
      fd.append("images", buildFile(audioFile) as any);
    }

    const { data } = await axiosInstance.post(`/posts/${postId}/comments`, fd, {
      headers: {
        ...headers,
        "Content-Type": "multipart/form-data",
      },
    });

    return data;
  },

  deleteComment: async (postId: string, commentId: string): Promise<void> => {
    const headers = await getAuthHeader();
    await axiosInstance.delete(`/posts/${postId}/comments/${commentId}`, {
      headers,
    });
  },

  reactToComment: async (
    postId: string,
    commentId: string,
    type: ReactionType,
  ): Promise<Comment> => {
    const headers = await getAuthHeader();

    const { data } = await axiosInstance.post(
      `/posts/${postId}/comments/${commentId}/react`,
      { type },
      { headers },
    );

    return data;
  },

  getReplies: async (
    postId: string,
    commentId: string,
    page = 1,
  ): Promise<CommentsResponse> => {
    const headers = await getAuthHeader();

    const { data } = await axiosInstance.get(
      `/posts/${postId}/comments/${commentId}/replies`,
      {
        params: { page },
        headers,
      },
    );

    return data;
  },
};
