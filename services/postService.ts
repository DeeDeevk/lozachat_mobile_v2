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
const buildFile = (file: any) => ({
  uri: file.uri,
  name: file.fileName || `file-${Date.now()}`,
  type: file.type || "application/octet-stream",
});

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

  reactToPost: async (postId: string, type: ReactionType): Promise<Post> => {
    const headers = await getAuthHeader();
    const { data } = await axiosInstance.post(
      `/posts/${postId}/react`,
      { type },
      { headers },
    );
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
