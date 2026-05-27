import type { Author, Post } from "@/types/post";

function toId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "_id" in value) {
    return toId((value as { _id: unknown })._id);
  }
  return String(value);
}

function normalizeAuthor(author: Author | undefined | null): Author | undefined {
  if (!author) return undefined;
  return { ...author, _id: toId(author._id) };
}

export function normalizePost(post: Post): Post {
  const sharedFromAuthorId = post.sharedFromAuthorId ? toId(post.sharedFromAuthorId) : undefined;

  return {
    ...post,
    _id: toId(post._id),
    author: normalizeAuthor(post.author) as Author,
    sharedFromAuthorId,
    sharedFrom: post.sharedFrom
      ? {
          ...post.sharedFrom,
          _id: toId(post.sharedFrom._id),
          author: normalizeAuthor(post.sharedFrom.author),
        }
      : post.sharedFrom,
    reactions: (post.reactions || []).map((reaction) => ({
      ...reaction,
      userId: typeof reaction.userId === "object" && reaction.userId !== null
        ? {
            _id: toId((reaction.userId as { _id?: unknown })._id),
            displayName: (reaction.userId as { displayName?: string }).displayName || "Người dùng",
            avatarUrl: (reaction.userId as { avatarUrl?: string }).avatarUrl || "",
            username: (reaction.userId as { username?: string }).username || "",
          }
        : toId(reaction.userId),
    })),
  };
}

export function normalizePosts(posts: Post[]): Post[] {
  return posts.map(normalizePost);
}