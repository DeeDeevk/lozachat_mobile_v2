import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export interface ParticipantAvatar {
  displayName?: string;
  avatarUrl?: string;
  username?: string;
}

interface MiniAvatarProps {
  p: ParticipantAvatar;
  fontSize?: number;
}

const AVATAR_COLORS = [
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
];

const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function MiniAvatar({ p, fontSize = 14 }: MiniAvatarProps) {
  const name = p.displayName || p.username || "?";

  if (p.avatarUrl) {
    return (
      <Image
        source={{ uri: p.avatarUrl }}
        style={styles.image}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: getAvatarColor(name) }]}>
      <Text style={[styles.text, { fontSize }]}>
        {name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  text: {
    color: "#fff",
    fontWeight: "700",
  },
});
