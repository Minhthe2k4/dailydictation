import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as YoutubeTranscriptModule from "youtube-transcript";

// Extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
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

type TrackInfo = {
  langCode: string;
  kind?: string;
  name?: string;
};

type SubtitleChunk = {
  text: string;
  startSec: number;
  endSec: number;
};

type TimedSegment = {
  text: string;
  startSec: number;
  endSec: number;
  segmentOrder: number;
};

function normalizeToSec(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value > 1000 ? value / 1000 : value;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildTimedSegments(chunks: SubtitleChunk[]): TimedSegment[] {
  if (chunks.length === 0) {
    return [];
  }

  const segments: TimedSegment[] = [];
  let currentText = "";
  let currentStart = chunks[0].startSec;
  let currentEnd = chunks[0].endSec;

  const flush = () => {
    const text = normalizeText(currentText);
    if (!text) {
      currentText = "";
      return;
    }

    segments.push({
      text,
      startSec: Number(currentStart.toFixed(2)),
      endSec: Number(currentEnd.toFixed(2)),
      segmentOrder: segments.length + 1,
    });

    currentText = "";
  };

  for (const chunk of chunks) {
    const chunkText = normalizeText(chunk.text);
    if (!chunkText) {
      continue;
    }

    if (!currentText) {
      currentStart = chunk.startSec;
      currentEnd = chunk.endSec;
      currentText = chunkText;
    } else {
      currentText = `${currentText} ${chunkText}`;
      currentEnd = chunk.endSec;
    }

    const duration = currentEnd - currentStart;
    const hasSentenceEnd = /[.!?。！？]$/.test(chunkText);
    const tooLongText = currentText.length >= 90;
    const tooLongDuration = duration >= 8;

    if (hasSentenceEnd || tooLongText || tooLongDuration) {
      flush();
    }
  }

  if (currentText) {
    flush();
  }

  return segments;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseTrackListXml(xml: string): TrackInfo[] {
  const tracks: TrackInfo[] = [];
  const trackTagRegex = /<track\s+([^>]*?)\/?>(?:<\/track>)?/g;

  for (const match of xml.matchAll(trackTagRegex)) {
    const attrText = match[1] ?? "";
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)="([^"]*)"/g;

    for (const attrMatch of attrText.matchAll(attrRegex)) {
      const key = attrMatch[1];
      const rawValue = attrMatch[2] ?? "";
      attrs[key] = decodeXmlEntities(rawValue);
    }

    if (!attrs.lang_code) {
      continue;
    }

    tracks.push({
      langCode: attrs.lang_code,
      kind: attrs.kind,
      name: attrs.name,
    });
  }

  return tracks;
}

function extractTranscriptChunksFromJson3(payload: unknown): SubtitleChunk[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const events = (
    payload as {
      events?: Array<{
        tStartMs?: number;
        dDurationMs?: number;
        segs?: Array<{ utf8?: string }>;
      }>;
    }
  ).events;

  if (!events) {
    return [];
  }

  const chunks: SubtitleChunk[] = [];
  for (const event of events) {
    if (!event.segs) {
      continue;
    }

    const text = normalizeText(event.segs.map((seg) => seg.utf8 ?? "").join(""));
    if (!text) {
      continue;
    }

    const startSec = normalizeToSec(event.tStartMs ?? 0);
    const durationSec = normalizeToSec(event.dDurationMs ?? 0);
    const endSec = Number((startSec + Math.max(durationSec, 0.3)).toFixed(2));

    chunks.push({ text, startSec, endSec });
  }

  return chunks;
}

function textFromSegments(segments: TimedSegment[]): string {
  return segments
    .map((segment) => segment.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function textFromChunks(chunks: SubtitleChunk[]): string {
  return chunks
    .map((chunk) => chunk.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

async function tryFetchTranscript(url: string): Promise<SubtitleChunk[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    return [];
  }

  const text = await res.text();
  if (!text.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    return extractTranscriptChunksFromJson3(parsed);
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { youtubeUrl?: string };

  if (!body.youtubeUrl) {
    return NextResponse.json({ message: "YouTube URL required" }, { status: 400 });
  }

  const videoId = extractVideoId(body.youtubeUrl);
  if (!videoId) {
    return NextResponse.json(
      { message: "Invalid YouTube URL" },
      { status: 400 }
    );
  }

  try {
    const fetchTranscriptFn =
      (YoutubeTranscriptModule as { fetchTranscript?: (videoId: string, config?: { lang?: string }) => Promise<Array<{ text: string }>> }).fetchTranscript ??
      (YoutubeTranscriptModule as { YoutubeTranscript?: { fetchTranscript?: (videoId: string, config?: { lang?: string }) => Promise<Array<{ text: string }>> } }).YoutubeTranscript?.fetchTranscript;

    // Primary strategy: library-based extraction (more reliable than manual timedtext parsing).
    try {
      if (!fetchTranscriptFn) {
        throw new Error("youtube-transcript export not available");
      }

      // First try Korean transcript.
      let transcriptChunks = await fetchTranscriptFn(videoId, {
        lang: "ko",
      });

      // If Korean not available, fallback to default language track.
      if (!transcriptChunks || transcriptChunks.length === 0) {
        transcriptChunks = await fetchTranscriptFn(videoId);
      }

      const timedChunks: SubtitleChunk[] = transcriptChunks
        .map((item) => {
          const startSec = normalizeToSec((item as { offset?: number }).offset ?? 0);
          const durationSec = normalizeToSec((item as { duration?: number }).duration ?? 0);
          const text = normalizeText(item.text ?? "");
          return {
            text,
            startSec,
            endSec: Number((startSec + Math.max(durationSec, 0.3)).toFixed(2)),
          };
        })
        .filter((item) => item.text.length > 0);

      const segments = buildTimedSegments(timedChunks);
      const transcript = textFromSegments(segments) || textFromChunks(timedChunks);

      if (transcript) {
        return NextResponse.json({
          videoId,
          transcript,
          segments,
          sourceUrl: body.youtubeUrl,
          language: "ko",
        });
      }
    } catch (libraryError) {
      console.warn("youtube-transcript primary extraction failed, fallback to timedtext", libraryError);
    }

    // Fallback strategy: timedtext endpoint parsing.
    const trackListUrl = `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&type=list`;
    const trackListRes = await fetch(trackListUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
    });

    if (!trackListRes.ok) {
      throw new Error(`Subtitle track list fetch failed: ${trackListRes.status}`);
    }

    const trackListXml = await trackListRes.text();
    const tracks = parseTrackListXml(trackListXml);

    const koreanTracks = tracks.filter((track) => track.langCode.toLowerCase().startsWith("ko"));

    const urlsToTry: string[] = [];

    // Direct Korean attempts first
    urlsToTry.push(
      `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=ko&fmt=json3`
    );
    urlsToTry.push(
      `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=ko&kind=asr&fmt=json3`
    );

    // Then explicit track attempts based on YouTube track list
    for (const track of koreanTracks.length > 0 ? koreanTracks : tracks) {
      const params = new URLSearchParams({
        v: videoId,
        lang: track.langCode,
        fmt: "json3",
      });

      if (track.kind) {
        params.set("kind", track.kind);
      }

      if (track.name) {
        params.set("name", track.name);
      }

      urlsToTry.push(`https://www.youtube.com/api/timedtext?${params.toString()}`);
    }

    let timedChunks: SubtitleChunk[] = [];
    for (const subtitleUrl of urlsToTry) {
      timedChunks = await tryFetchTranscript(subtitleUrl);
      if (timedChunks.length > 0) {
        break;
      }
    }

    const segments = buildTimedSegments(timedChunks);
    const transcript = textFromSegments(segments) || textFromChunks(timedChunks);

    if (!transcript) {
      return NextResponse.json(
        {
          message:
            "Khong lay duoc phu de tu video nay (tu dong hoac thu cong). Hay kiem tra video co subtitle va khong bi chan theo khu vuc.",
        },
        { status: 404 }
      );
    }

    const selectedLanguage =
      koreanTracks[0]?.langCode ?? tracks[0]?.langCode ?? "ko";

    return NextResponse.json({
      videoId,
      transcript,
      segments,
      sourceUrl: body.youtubeUrl,
      language: selectedLanguage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("YouTube extraction error:", message, error);
    return NextResponse.json(
      { message: `Failed to extract subtitles: ${message}` },
      { status: 500 }
    );
  }
}
