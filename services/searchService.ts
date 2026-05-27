import api from "@/lib/axios";
import type { SearchResponse } from "@/types/post";

export const searchService = {
  searchAll: async (query: string): Promise<SearchResponse> => {
    const res = await api.get("/search", { params: { q: query } });
    return res.data;
  },
};