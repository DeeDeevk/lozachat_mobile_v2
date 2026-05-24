import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ChatThemeMode = "solid" | "gradient" | "image";

export interface ChatThemeOption {
  id: string;
  name: string;
  mode: ChatThemeMode;

  appBackgroundColor?: string;
  appBackgroundColors?: string[];
  appBackgroundImage?: string;

  messageAreaOverlay?: string;

  mineBubbleColor?: string;
  mineBubbleColors?: string[];
}

export const CHAT_THEME_OPTIONS: ChatThemeOption[] = [
  {
    id: "aurora",
    name: "Aurora",
    mode: "gradient",
    appBackgroundColor: "#041226",
    messageAreaOverlay: "rgba(6,15,35,0.3)",
    mineBubbleColors: ["#2563eb", "#1d4ed8"],
  },
  {
    id: "sunset",
    name: "Sunset",
    mode: "gradient",
    appBackgroundColor: "#1f1424",
    messageAreaOverlay: "rgba(34,16,40,0.28)",
    mineBubbleColors: ["#f97316", "#ec4899"],
  },
  {
    id: "mint",
    name: "Mint",
    mode: "solid",
    appBackgroundColor: "#0f2b2a",
    messageAreaOverlay: "rgba(6,22,20,0.2)",
    mineBubbleColors: ["#10b981", "#0ea5a4"],
  },
  {
    id: "graphite",
    name: "Graphite",
    mode: "solid",
    appBackgroundColor: "#111827",
    messageAreaOverlay: "rgba(2,6,23,0.25)",
    mineBubbleColors: ["#475569", "#334155"],
  },
  {
    id: "skyline",
    name: "Skyline",
    mode: "image",
    appBackgroundColor: "#0b1220",
    appBackgroundImage:
      "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=1600&q=80",
    messageAreaOverlay: "rgba(6,14,28,0.45)",
    mineBubbleColors: ["#1488CC", "#2B32B2"],
  },
  {
    id: "sand",
    name: "Sand",
    mode: "image",
    appBackgroundColor: "#1f1a16",
    appBackgroundImage:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
    messageAreaOverlay: "rgba(25,18,12,0.42)",
    mineBubbleColors: ["#DECBA4"],
  },
];

const DEFAULT_CHAT_THEME = CHAT_THEME_OPTIONS[0];

interface ChatThemeState {
  selectedByConversation: Record<string, string>;
  setThemeForConversation: (conversationId: string, themeId: string) => void;
  clearThemes: () => void;
}

export function getChatThemeById(themeId?: string | null): ChatThemeOption {
  return (
    CHAT_THEME_OPTIONS.find((theme) => theme.id === themeId) ||
    DEFAULT_CHAT_THEME
  );
}

export const useChatThemeStore = create<ChatThemeState>()(
  persist(
    (set) => ({
      selectedByConversation: {},

      setThemeForConversation: (conversationId, themeId) =>
        set((state) => {
          const newState = {
            selectedByConversation: {
              ...state.selectedByConversation,
              [conversationId]: themeId,
            },
          };

          return newState;
        }),

      clearThemes: () => set({ selectedByConversation: {} }),
    }),
    {
      name: "chat-theme-storage",
      storage: createJSONStorage(() => AsyncStorage), // 🔥 fix mobile
      partialize: (state) => ({
        selectedByConversation: state.selectedByConversation,
      }),
    },
  ),
);
