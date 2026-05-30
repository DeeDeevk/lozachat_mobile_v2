export function isMediaVideo(url: string | undefined | null) {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov|m4v|mkv)(\?.*)?$/i.test(url);
}
