import { useState } from "react";
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Play } from "lucide-react-native";

type Props = {
  uri: string;
  style: StyleProp<ViewStyle>;
  resizeMode?: ResizeMode;
  controls?: boolean;
  badgeText?: string;
  onPress?: () => void;
};

export default function VideoMedia({ uri, style, resizeMode = ResizeMode.COVER, controls = false, badgeText = "Video", onPress }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const content = (
    <View style={[styles.wrap, style]}>
      <Video
        source={{ uri }}
        style={StyleSheet.absoluteFillObject}
        resizeMode={resizeMode}
        isLooping={false}
        shouldPlay={false}
        useNativeControls={controls}
        onLoadStart={() => {
          setError(false);
          setLoading(true);
        }}
        onReadyForDisplay={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />

      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#bfdbfe" />
          <Text style={styles.loadingText}>Đang tải video...</Text>
        </View>
      ) : null}

      {!controls ? (
        <View style={styles.badge}>
          <Play size={12} color="#bfdbfe" fill="#bfdbfe" />
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>Không phát được video</Text>
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    backgroundColor: "#0b1220",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(3,7,18,0.28)",
    gap: 8,
  },
  loadingText: {
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: "700",
  },
  badge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.78)",
  },
  badgeText: {
    color: "#bfdbfe",
    fontSize: 10,
    fontWeight: "800",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(3,7,18,0.7)",
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 11,
    fontWeight: "700",
  },
});
