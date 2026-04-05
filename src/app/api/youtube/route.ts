import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import * as YoutubeTranscriptModule from "youtube-transcript";
import { extractYoutubeVideoId } from "@/lib/youtube";

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

type ExpandedChunk = SubtitleChunk & {
  hasSentenceBoundary: boolean;
};

function normalizeToSec(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value > 1000 ? value / 1000 : value;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function pickTimeValue(...candidates: unknown[]): number | null {
  for (const candidate of candidates) {
    const parsed = toFiniteNumber(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }
  return null;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripTrailingQuotes(value: string): string {
  return value.replace(/["'”’)}\]]+$/g, "").trim();
}

function isKoreanSentenceEnding(text: string): boolean {
  const normalized = stripTrailingQuotes(normalizeText(text));
  if (!normalized) {
    return false;
  }

  if (/[.!?。！？]$/.test(normalized)) {
    return true;
  }

  const lastToken = normalized.split(/\s+/).pop() ?? normalized;
  const endings = [
    /(?:습니다|습니까|습니다만|입니까|입니다|입니다만|합니다|합니까|했습니다|하겠습니다|하죠|하네요|하잖아요|하잖아|하거든요|하거든|하니까|하군요|해요|했어요|예요|이에요|네요|죠|지요|군요|거든요|더라고요|더라|잖아요|잖아|네요|구나|네)$/,
    /(?:다|다네요|다니까|다니|다죠|다네|다며|라네요|라니까|라니|라죠|라네)$/,
    /(?:까|까요|ㄹ까|을까|나|나요|니|니까|는가|인가|던가)$/,
  ];

  return endings.some((pattern) => pattern.test(lastToken));
}

function hasStrongKoreanBoundary(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) {
    return false;
  }

  const tokenCount = normalized.split(/\s+/).length;
  const characterCount = normalized.length;

  return isKoreanSentenceEnding(normalized) || (tokenCount >= 4 && characterCount >= 18 && /[ㄱ-ㅎ가-힣]/.test(normalized));
}

function splitIntoSentenceFragments(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) {
    return [];
  }

  const sentenceSegments = typeof Intl !== "undefined" && "Segmenter" in Intl
    ? Array.from(
        new Intl.Segmenter("ko", { granularity: "sentence" }).segment(normalized),
        (part) => part.segment.trim()
      ).filter(Boolean)
    : [];

  if (sentenceSegments.length > 1) {
    return sentenceSegments;
  }

  const regexFragments = normalized.match(/[^.!?。！？\n]+[.!?。！？]?/g);
  if (regexFragments && regexFragments.length > 1) {
    return regexFragments.map((fragment) => fragment.trim()).filter(Boolean);
  }

  return [normalized];
}

function expandChunkIntoFragments(chunk: SubtitleChunk): ExpandedChunk[] {
  const fragments = splitIntoSentenceFragments(chunk.text);
  if (fragments.length <= 1) {
    return [
      {
        ...chunk,
        text: normalizeText(chunk.text),
        hasSentenceBoundary: hasStrongKoreanBoundary(chunk.text),
      },
    ];
  }

  const totalChars = fragments.reduce((sum, fragment) => sum + fragment.length, 0) || fragments.length;
  const totalDuration = Math.max(chunk.endSec - chunk.startSec, fragments.length * 0.35);
  const expanded: ExpandedChunk[] = [];
  let cursor = chunk.startSec;

  fragments.forEach((fragment, index) => {
    const weight = fragment.length / totalChars;
    const estimatedDuration = index === fragments.length - 1
      ? Math.max(0.3, chunk.endSec - cursor)
      : Math.max(0.3, totalDuration * weight);
    const nextEnd = index === fragments.length - 1
      ? chunk.endSec
      : Math.min(chunk.endSec, Number((cursor + estimatedDuration).toFixed(2)));

    expanded.push({
      text: fragment,
      startSec: Number(cursor.toFixed(2)),
      endSec: Number(Math.max(nextEnd, cursor + 0.3).toFixed(2)),
      hasSentenceBoundary: hasStrongKoreanBoundary(fragment),
    });

    cursor = Math.max(nextEnd, cursor + 0.3);
  });

  return expanded;
}

function buildTimedSegments(chunks: SubtitleChunk[]): TimedSegment[] {
  if (chunks.length === 0) {
    return [];
  }

  const segments: TimedSegment[] = [];
  const expandedChunks = chunks.flatMap((chunk) => expandChunkIntoFragments(chunk));

  let currentText = "";
  let currentStart = expandedChunks[0].startSec;
  let currentEnd = expandedChunks[0].endSec;

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

  for (const chunk of expandedChunks) {
    const chunkText = normalizeText(chunk.text);
    if (!chunkText) {
      continue;
    }

    const gap = chunk.startSec - currentEnd;
    const shouldStartNewSegment =
      !currentText ||
      gap > 0.55 ||
      currentText.length >= 55 ||
      (currentEnd - currentStart) >= 4.5 ||
      chunk.hasSentenceBoundary;

    if (shouldStartNewSegment) {
      if (currentText) {
        flush();
      }

      currentStart = chunk.startSec;
      currentEnd = chunk.endSec;
      currentText = chunkText;
      continue;
    }

    currentText = `${currentText} ${chunkText}`;
    currentEnd = chunk.endSec;
  }

  if (currentText) {
    flush();
  }

  // Keep segment timeline stable and non-overlapping.
  for (let index = 0; index < segments.length - 1; index += 1) {
    const current = segments[index];
    const next = segments[index + 1];
    const maxEnd = Math.max(current.startSec + 0.2, next.startSec - 0.02);
    if (current.endSec > maxEnd) {
      current.endSec = Number(maxEnd.toFixed(2));
    }
  }

  for (const segment of segments) {
    if (segment.endSec <= segment.startSec) {
      segment.endSec = Number((segment.startSec + 0.25).toFixed(2));
    }
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

async function fetchYoutubeTitle(sourceUrl: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(sourceUrl)}&format=json`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as { title?: string };
    return typeof data.title === "string" ? data.title.trim() : null;
  } catch {
    return null;
  }
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

  const videoId = extractYoutubeVideoId(body.youtubeUrl);
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

      const timedChunks: SubtitleChunk[] = [];
      let fallbackStart = 0;

      for (const item of transcriptChunks) {
        const startRaw = pickTimeValue(
          (item as { offset?: number }).offset,
          (item as { start?: number }).start,
          (item as { startSec?: number }).startSec,
          (item as { startTime?: number }).startTime,
          (item as { offsetMs?: number }).offsetMs,
          (item as { startMs?: number }).startMs
        );
        const durationRaw = pickTimeValue(
          (item as { duration?: number }).duration,
          (item as { dur?: number }).dur,
          (item as { durationSec?: number }).durationSec,
          (item as { durationMs?: number }).durationMs,
          (item as { dDurationMs?: number }).dDurationMs
        );

        const text = normalizeText(item.text ?? "");
        if (!text) {
          continue;
        }

        const startSec = normalizeToSec(startRaw ?? fallbackStart);
        const durationSec = normalizeToSec(durationRaw ?? 0.6);
        const endSec = Number((startSec + Math.max(durationSec, 0.3)).toFixed(2));

        timedChunks.push({
          text,
          startSec,
          endSec,
        });

        fallbackStart = endSec;
      }

      const segments = buildTimedSegments(timedChunks);
      const transcript = textFromSegments(segments) || textFromChunks(timedChunks);

      if (transcript) {
        const title = await fetchYoutubeTitle(body.youtubeUrl);
        return NextResponse.json({
          videoId,
          title,
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
    let tracks: TrackInfo[] = [];
    
    try {
      const trackListRes = await fetch(trackListUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
      });

      if (trackListRes.ok) {
        const trackListXml = await trackListRes.text();
        tracks = parseTrackListXml(trackListXml);
        console.log(`[YouTube] Found ${tracks.length} subtitle tracks for video ${videoId}`);
      } else {
        console.warn(`[YouTube] Track list fetch failed: ${trackListRes.status}`);
      }
    } catch (trackListError) {
      console.warn(`[YouTube] Error fetching track list:`, trackListError);
    }

    const koreanTracks = tracks.filter((track) => track.langCode.toLowerCase().startsWith("ko"));

    const urlsToTry: string[] = [];

    // Direct Korean attempts first
    urlsToTry.push(
      `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=ko&fmt=json3`
    );
    urlsToTry.push(
      `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=ko&kind=asr&fmt=json3`
    );

    // Try without kind parameter
    urlsToTry.push(
      `https://www.youtube.com/api/timedtext?v=${encodeURIComponent(videoId)}&lang=ko`
    );

    // Then explicit track attempts based on YouTube track list
    for (const track of koreanTracks.length > 0 ? koreanTracks : tracks.slice(0, 10)) {
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

      // Also try without fmt parameter
      const paramsNoFmt = new URLSearchParams({
        v: videoId,
        lang: track.langCode,
      });
      if (track.kind) {
        paramsNoFmt.set("kind", track.kind);
      }
      urlsToTry.push(`https://www.youtube.com/api/timedtext?${paramsNoFmt.toString()}`);
    }

    // Try fetching any available language if Korean not found
    if (koreanTracks.length === 0 && tracks.length > 0) {
      for (const track of tracks.slice(0, 5)) {
        const params = new URLSearchParams({
          v: videoId,
          lang: track.langCode,
          fmt: "json3",
        });
        if (track.kind) {
          params.set("kind", track.kind);
        }
        urlsToTry.push(`https://www.youtube.com/api/timedtext?${params.toString()}`);
      }
    }

    let timedChunks: SubtitleChunk[] = [];
    let selectedLanguage = "ko";

    console.log(`[YouTube] Attempting ${urlsToTry.length} subtitle URLs for video ${videoId}`);
    for (let i = 0; i < urlsToTry.length; i++) {
      const subtitleUrl = urlsToTry[i];
      try {
        timedChunks = await tryFetchTranscript(subtitleUrl);
        if (timedChunks.length > 0) {
          // Extract language from URL params
          const urlParams = new URL(subtitleUrl, "https://youtube.com").searchParams;
          selectedLanguage = urlParams.get("lang") || selectedLanguage;
          console.log(`[YouTube] Successfully fetched ${timedChunks.length} chunks from URL ${i + 1}/${urlsToTry.length} with language: ${selectedLanguage}`);
          break;
        }
      } catch (urlError) {
        console.warn(`[YouTube] URL ${i + 1}/${urlsToTry.length} failed:`, urlError);
        continue;
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
    const title = await fetchYoutubeTitle(body.youtubeUrl);

    return NextResponse.json({
      videoId,
      title,
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
