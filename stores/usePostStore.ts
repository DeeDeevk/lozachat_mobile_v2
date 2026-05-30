import { create } from "zustand";
import Toast from "react-native-toast-message";
import type { Comment, Post, PostImage, ReactionType, Visibility } from "@/types/post";
import { postService } from "@/services/postService";
import { normalizePost, normalizePosts } from "@/utils/normalizePost";

interface PostStore {
  posts: Post[];
  loading: boolean;
  hasMore: boolean;
  page: number;
  fetchPosts: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  createPost: (content: string, images?: any[], visibility?: Visibility) => Promise<void>;
  updatePost: (
    id: string,
    payload: {
      content: string;
      newImages?: any[];
      removeImages?: string[];
      visibility?: Visibility;
    },
  ) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  reactToPost: (postId: string, type: ReactionType) => Promise<void>;
  sharePost: (postId: string, content?: string, visibility?: Visibility) => Promise<void>;
  ensurePostInFeed: (postId: string) => Promise<Post | null>;
  getPostImages: (postId: string) => Promise<PostImage[]>;
  reactToImage: (postId: string, imageId: string, type: ReactionType) => Promise<PostImage>;
  getCommentsForPost: (postId: string, imageId?: string) => Promise<Comment[]>;
  addComment: (
    postId: string,
    content: string,
    parentId?: string | null,
    files?: any[],
    imageId?: string | null,
    audioFile?: any | null,
  ) => Promise<Comment>;
  deleteComment: (postId: string, commentId: string, isReply?: boolean) => Promise<void>;
  reactToComment: (postId: string, commentId: string, type: ReactionType) => Promise<Comment>;
}

export const usePostStore = create<PostStore>((set, get) => ({
  posts: [],
  loading: false,
  hasMore: true,
  page: 1,

  fetchPosts: async (reset = false) => {
    const { loading, page } = get();
    if (loading) return;
    const currentPage = reset ? 1 : page;
    set({ loading: true });

    try {
      const res = await postService.getPosts(currentPage);
      const newPosts = normalizePosts(res.posts || []);
      set((state) => ({
        posts: reset ? newPosts : [...state.posts, ...newPosts],
        hasMore: res.pagination?.hasMore ?? false,
        page: currentPage,
        loading: false,
      }));
    } catch {
      Toast.show({ type: "error", text1: "Không thể tải bài viết" });
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { loading, hasMore, page } = get();
    if (loading || !hasMore) return;
    set({ page: page + 1 });
    await get().fetchPosts();
  },

  createPost: async (content, images = [], visibility = "public") => {
    try {
      const post = normalizePost(await postService.createPost(content, images, visibility));
      set((state) => ({ posts: [post, ...state.posts] }));
      Toast.show({ type: "success", text1: "Đã đăng bài viết" });
    } catch {
      Toast.show({ type: "error", text1: "Đăng bài thất bại" });
      throw new Error("Create post failed");
    }
  },

  updatePost: async (id, payload) => {
    try {
      const updated = normalizePost(
        await postService.updatePost(
          id,
          payload.content,
          payload.newImages || [],
          payload.removeImages || [],
          payload.visibility,
        ),
      );
      set((state) => ({ posts: state.posts.map((post) => (post._id === id ? updated : post)) }));
      Toast.show({ type: "success", text1: "Đã cập nhật bài viết" });
    } catch {
      Toast.show({ type: "error", text1: "Cập nhật bài viết thất bại" });
      throw new Error("Update post failed");
    }
  },

  deletePost: async (id) => {
    try {
      await postService.deletePost(id);
      set((state) => ({ posts: state.posts.filter((post) => post._id !== id) }));
      Toast.show({ type: "success", text1: "Đã xoá bài viết" });
    } catch {
      Toast.show({ type: "error", text1: "Xoá thất bại" });
      throw new Error("Delete post failed");
    }
  },

  reactToPost: async (postId, type) => {
    try {
      const updated = normalizePost(await postService.reactToPost(postId, type));
      set((state) => ({ posts: state.posts.map((post) => (post._id === postId ? updated : post)) }));
    } catch {
      Toast.show({ type: "error", text1: "Không thể thả reaction" });
    }
  },

  sharePost: async (postId, content = "", visibility = "public") => {
    try {
      const shared = normalizePost(await postService.sharePost(postId, content, visibility));
      set((state) => ({
        posts: [
          shared,
          ...state.posts.map((post) =>
            post._id === postId ? { ...post, sharesCount: (post.sharesCount || 0) + 1 } : post,
          ),
        ],
      }));
      Toast.show({ type: "success", text1: "Đã chia sẻ bài viết" });
    } catch {
      Toast.show({ type: "error", text1: "Chia sẻ thất bại" });
      throw new Error("Share post failed");
    }
  },

  ensurePostInFeed: async (postId) => {
    const existing = get().posts.find((post) => post._id === postId);
    if (existing) return existing;

    try {
      const post = normalizePost(await postService.getById(postId));
      set((state) => ({
        posts: state.posts.some((item) => item._id === postId) ? state.posts : [post, ...state.posts],
      }));
      return post;
    } catch {
      return null;
    }
  },

  getPostImages: async (postId) => postService.getPostImages(postId),

  reactToImage: async (postId, imageId, type) => postService.reactToImage(postId, imageId, type),

  getCommentsForPost: async (postId, imageId) => {
    try {
      const res = await postService.getComments(postId, imageId);
      return res.comments;
    } catch {
      return [];
    }
  },

  addComment: async (postId, content, parentId = null, files = [], imageId = null, audioFile = null) => {
    try {
      const newComment = await postService.addComment(postId, content, parentId, files, imageId, audioFile);

      if (!parentId && !imageId) {
        set((state) => ({
          posts: state.posts.map((post) =>
            post._id === postId ? { ...post, commentsCount: (post.commentsCount || 0) + 1 } : post,
          ),
        }));
      }

      Toast.show({ type: "success", text1: parentId ? "Đã trả lời" : "Đã bình luận" });
      return newComment;
    } catch {
      Toast.show({ type: "error", text1: parentId ? "Trả lời thất bại" : "Bình luận thất bại" });
      throw new Error("Add comment failed");
    }
  },

  deleteComment: async (postId, commentId, isReply = false) => {
    try {
      await postService.deleteComment(postId, commentId);
      if (!isReply) {
        set((state) => ({
          posts: state.posts.map((post) =>
            post._id === postId ? { ...post, commentsCount: Math.max(0, (post.commentsCount || 0) - 1) } : post,
          ),
        }));
      }
      Toast.show({ type: "success", text1: "Đã xoá bình luận" });
    } catch {
      Toast.show({ type: "error", text1: "Không thể xoá bình luận" });
      throw new Error("Delete comment failed");
    }
  },

  reactToComment: async (postId, commentId, type) => {
    try {
      return await postService.reactToComment(postId, commentId, type);
    } catch {
      Toast.show({ type: "error", text1: "Không thể thả reaction" });
      throw new Error("React to comment failed");
    }
  },
}));