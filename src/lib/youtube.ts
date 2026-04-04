export function extractYoutubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export function buildYoutubeEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    enablejsapi: "1",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
  });

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}