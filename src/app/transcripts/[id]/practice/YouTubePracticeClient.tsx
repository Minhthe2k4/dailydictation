"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PracticeProgress, PracticeTranscript, PracticeSentence } from "@/types/practice";

declare global {
  interface Window {
    YT?: {
      Player: new (
        element: string | HTMLElement,
        options: {
          videoId: string;
          playerVars?: Record<string, string | number | boolean>;
          events?: {
            onReady?: (event: { target: YouTubePlayer }) => void;
            onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
          };
        }
      ) => YouTubePlayer;
      PlayerState: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
};

type FullAnswerWord = {
  answer: string;
  correct: boolean;
};

function formatTime(seconds?: number) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "--:--";
  }

  const total = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const remainingSeconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function splitWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function clampIndex(index: number, length: number) {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
}

function buildRevealWords(answer: string, typed: string): FullAnswerWord[] {
  const answerWords = splitWords(answer);
  const typedWords = splitWords(typed);

  return answerWords.map((word, index) => ({
    answer: word,
    correct: Boolean(typedWords[index]) && word.localeCompare(typedWords[index], undefined, { sensitivity: "base" }) === 0,
  }));
}

export default function YouTubePracticeClient({ transcript, initialProgress = null }: { transcript: PracticeTranscript; initialProgress?: PracticeProgress | null }) {
  const sentences = transcript.sentences;
  const videoId = useMemo(() => {
    const url = transcript.sourceUrl ?? "";
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
  }, [transcript.sourceUrl]);

  const playerHostId = `youtube-player-${transcript.id}`;
  const playerRef = useRef<YouTubePlayer | null>(null);
  const pollRef = useRef<number | null>(null);
  const activeIndexRef = useRef(0);
  const repeatLeftRef = useRef(3);
  const isPlayingRef = useRef(false);
  const segmentFinishedRef = useRef(false);
  const sentencesRef = useRef<PracticeSentence[]>(sentences);
  const manualSentenceChangeRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  const initialActiveIndex = useMemo(() => {
    if (!initialProgress?.sentenceId) {
      return 0;
    }

    const matchedIndex = sentences.findIndex((sentence) => sentence.id === initialProgress.sentenceId);
    return matchedIndex >= 0 ? matchedIndex : 0;
  }, [initialProgress?.sentenceId, sentences]);

  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatLeft, setRepeatLeft] = useState(3);
  const [segmentFinished, setSegmentFinished] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [checked, setChecked] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [maskedWords, setMaskedWords] = useState<string[]>([]);
  const [fullAnswerWords, setFullAnswerWords] = useState<FullAnswerWord[]>([]);
  const [showFullAnswer, setShowFullAnswer] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectedMeaning, setSelectedMeaning] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState("");
  const [jumpToValue, setJumpToValue] = useState("");

  const activeSentenceData = sentences[activeIndex] ?? null;
  const activeStart = activeSentenceData?.startSec ?? 0;
  const activeEnd = activeSentenceData?.endSec ?? activeStart + 4;

  async function persistProgress(sentenceId: string | null, value: string) {
    if (!transcript.id || !sentenceId) {
      return;
    }

    await fetch(`/api/transcripts/${transcript.id}/progress`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sentenceId,
        typedText: value,
      }),
    });
  }

  useEffect(() => {
    if (initialProgress?.sentenceId) {
      const matchedIndex = sentences.findIndex((sentence) => sentence.id === initialProgress.sentenceId);
      if (matchedIndex >= 0) {
        setActiveIndex(matchedIndex);
      }
    }
  }, [initialProgress?.sentenceId, sentences]);

  useEffect(() => {
    sentencesRef.current = sentences;
  }, [sentences]);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    repeatLeftRef.current = repeatLeft;
  }, [repeatLeft]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    segmentFinishedRef.current = segmentFinished;
  }, [segmentFinished]);

  useEffect(() => {
    if (activeIndex >= sentences.length) {
      setActiveIndex(Math.max(0, sentences.length - 1));
    }
  }, [activeIndex, sentences.length]);

  useEffect(() => {
    if (!transcript.id || !activeSentenceData) {
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void persistProgress(activeSentenceData.id, typedText).catch(() => null);
    }, 400);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [activeSentenceData, transcript.id, typedText]);

  useEffect(() => {
    if (!videoId) {
      return;
    }

    let cancelled = false;

    const stopPolling = () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const startPolling = () => {
      stopPolling();
      pollRef.current = window.setInterval(() => {
        const player = playerRef.current;
        if (!player) {
          return;
        }

        const nextCurrentTime = player.getCurrentTime();
        const nextDuration = player.getDuration();
        setCurrentTime(nextCurrentTime);
        if (Number.isFinite(nextDuration) && nextDuration > 0) {
          setDuration(nextDuration);
        }

        const currentSentences = sentencesRef.current;
        const currentIndex = activeIndexRef.current;
        const active = currentSentences[currentIndex];
        if (!active || !isPlayingRef.current || segmentFinishedRef.current) {
          return;
        }

        const endLimit = typeof active.endSec === "number" ? active.endSec : active.startSec ? active.startSec + 4 : nextCurrentTime + 4;
        if (nextCurrentTime + 0.08 < endLimit) {
          return;
        }

        const repeatsLeftNow = repeatLeftRef.current;
        if (repeatsLeftNow > 1) {
          player.seekTo(active.startSec ?? 0, true);
          player.playVideo();
          repeatLeftRef.current = repeatsLeftNow - 1;
          setRepeatLeft(repeatLeftRef.current);
          return;
        }

        player.pauseVideo();
        isPlayingRef.current = false;
        setIsPlaying(false);
        repeatLeftRef.current = 0;
        setRepeatLeft(0);
        segmentFinishedRef.current = true;
        setSegmentFinished(true);
        stopPolling();
      }, 220);
    };

    const initPlayer = () => {
      if (cancelled || !window.YT?.Player || !document.getElementById(playerHostId)) {
        return;
      }

      playerRef.current?.destroy();
      const player = new window.YT.Player(playerHostId, {
        videoId,
        playerVars: {
          enablejsapi: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            if (cancelled) {
              return;
            }

            playerRef.current = target;
            setPlayerReady(true);
            setDuration(target.getDuration());
            setCurrentTime(target.getCurrentTime());
          },
          onStateChange: ({ data, target }) => {
            if (cancelled) {
              return;
            }

            playerRef.current = target;
            const playing = data === window.YT?.PlayerState.PLAYING;
            isPlayingRef.current = playing;
            setIsPlaying(playing);
            setCurrentTime(target.getCurrentTime());
            setDuration(target.getDuration());

            if (playing) {
              startPolling();
            } else {
              stopPolling();
            }
          },
        },
      });

      playerRef.current = player;
    };

    if (window.YT?.Player) {
      initPlayer();
    } else {
      const existingScript = document.getElementById("youtube-iframe-api");
      if (!existingScript) {
        const script = document.createElement("script");
        script.id = "youtube-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }

      const previousReadyHandler = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReadyHandler?.();
        initPlayer();
      };
    }

    return () => {
      cancelled = true;
      stopPolling();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [playerHostId, videoId]);

  useEffect(() => {
    // Only clear text and reset state if this was a manual sentence change
    if (manualSentenceChangeRef.current) {
      setTypedText("");
      setChecked(false);
      setFeedback("");
      setMaskedWords([]);
      setFullAnswerWords([]);
      setShowFullAnswer(false);
      setSelectedText("");
      setSelectedMeaning("");
      setRepeatLeft(3);
      repeatLeftRef.current = 3;
      setSegmentFinished(false);
      segmentFinishedRef.current = false;
      manualSentenceChangeRef.current = false;
    }
  }, [activeIndex]);

  async function handleLookupMeaning(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    setSelectedText(trimmed);
    setLookupLoading(true);
    setSelectedMeaning("");

    try {
      const res = await fetch("/api/korean-translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Không thể tra từ.");
      }

      const payload = (await res.json()) as { meaning?: string };
      setSelectedMeaning(payload.meaning ?? "");
    } catch (lookupError) {
      setSelectedMeaning(lookupError instanceof Error ? lookupError.message : "Không thể tra từ.");
    } finally {
      setLookupLoading(false);
    }
  }

  function seekToActiveSentence() {
    const player = playerRef.current;
    if (!player || !activeSentenceData) {
      return;
    }

    setSegmentFinished(false);
    segmentFinishedRef.current = false;
    setRepeatLeft(3);
    repeatLeftRef.current = 3;
    setIsPlaying(true);
    isPlayingRef.current = true;
    player.seekTo(activeStart, true);
    player.playVideo();
  }

  function handleCheckAnswer() {
    if (!activeSentenceData) {
      setFeedback("Không có câu để kiểm tra.");
      return;
    }

    if (!typedText.trim()) {
      setFeedback("Hãy nhập câu bạn vừa nghe trước khi kiểm tra.");
      return;
    }

    const answerWords = splitWords(activeSentenceData.text);
    const reveal = buildRevealWords(activeSentenceData.text, typedText);
    const typedWords = splitWords(typedText);
    const masked = answerWords.map((word, index) => {
      const typedWord = typedWords[index];
      const isCorrect = Boolean(typedWord) && word.localeCompare(typedWord, undefined, { sensitivity: "base" }) === 0;
      return isCorrect ? typedWord : "*";
    });
    const correctCount = reveal.filter((item) => item.correct).length;
    const score = answerWords.length > 0 ? Math.round((correctCount / answerWords.length) * 100) : 0;

    setMaskedWords(masked);
    setFullAnswerWords(reveal);
    setShowFullAnswer(false);
    setChecked(true);
    setFeedback(`Đúng ${correctCount}/${answerWords.length} (${score}%)`);
  }

  function handleNextSentence() {
    if (sentences.length === 0) {
      return;
    }

    manualSentenceChangeRef.current = true;
    void persistProgress(activeSentenceData?.id ?? null, typedText).catch(() => null);
    const nextIndex = clampIndex(activeIndex + 1, sentences.length);
    setActiveIndex(nextIndex);
    setCurrentTime(sentences[nextIndex]?.startSec ?? 0);
    const player = playerRef.current;
    if (player && sentences[nextIndex]?.startSec !== undefined) {
      player.seekTo(sentences[nextIndex].startSec ?? 0, true);
    }
  }

  function handlePrevSentence() {
    if (sentences.length === 0) {
      return;
    }

    manualSentenceChangeRef.current = true;
    void persistProgress(activeSentenceData?.id ?? null, typedText).catch(() => null);
    const nextIndex = clampIndex(activeIndex - 1, sentences.length);
    setActiveIndex(nextIndex);
    setCurrentTime(sentences[nextIndex]?.startSec ?? 0);
    const player = playerRef.current;
    if (player && sentences[nextIndex]?.startSec !== undefined) {
      player.seekTo(sentences[nextIndex].startSec ?? 0, true);
    }
  }

  function handleJumpToSentence() {
    if (sentences.length === 0) {
      return;
    }

    const nextIndex = Number.parseInt(jumpToValue, 10) - 1;
    if (Number.isNaN(nextIndex) || nextIndex < 0 || nextIndex >= sentences.length) {
      setError(`Vui lòng nhập số từ 1 đến ${sentences.length}.`);
      return;
    }

    manualSentenceChangeRef.current = true;
    void persistProgress(activeSentenceData?.id ?? null, typedText).catch(() => null);
    setError("");
    setActiveIndex(nextIndex);
    setCurrentTime(sentences[nextIndex]?.startSec ?? 0);
    setJumpToValue("");

    const player = playerRef.current;
    if (player && sentences[nextIndex]?.startSec !== undefined) {
      player.seekTo(sentences[nextIndex].startSec ?? 0, true);
    }
  }

  if (!videoId) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5">
        Không tìm thấy video YouTube hợp lệ trong nguồn của bài luyện này.
      </div>
    );
  }

  if (sentences.length === 0) {
    return (
      <div className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5">
        Bài này chưa có câu nào để luyện.
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
      <section className="rounded-[2rem] bg-[#071f24] p-5 text-white shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">Video gốc</p>
            <h2 className="mt-1 text-2xl font-bold">Phát đoạn, lặp 3 lần rồi dừng</h2>
          </div>
          {transcript.sourceUrl ? (
            <a
              href={transcript.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Mở video gốc
            </a>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-[1.75rem] bg-black shadow-2xl ring-1 ring-white/10">
          <div id={playerHostId} className="aspect-video w-full" />
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-cyan-50/90">
            <span className="rounded-full bg-white/10 px-3 py-1 font-semibold">
              Câu {activeIndex + 1}/{sentences.length}
            </span>
            <label className="flex items-center gap-2">
              <span className="text-cyan-50/80">Nhảy đến câu</span>
              <input
                type="number"
                min={1}
                max={sentences.length}
                value={jumpToValue}
                onChange={(event) => setJumpToValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleJumpToSentence();
                  }
                }}
                className="w-20 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-white outline-none placeholder:text-cyan-50/40"
                placeholder="Số"
              />
            </label>
            <button
              type="button"
              onClick={handleJumpToSentence}
              className="rounded-full bg-white px-4 py-2 font-semibold text-[#082126] transition hover:bg-cyan-100"
            >
              Đi
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-cyan-50/80">
            <span>{playerReady ? (isPlaying ? "Đang phát" : segmentFinished ? "Đã lặp đủ 3 lần" : "Đã sẵn sàng") : "Đang khởi tạo player..."}</span>
            <span>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all"
              style={{ width: `${duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0}%` }}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={seekToActiveSentence}
              className="rounded-full bg-cyan-300 px-5 py-3 font-bold text-[#082126] transition hover:bg-cyan-200"
            >
              Phát câu này
            </button>
            <button
              type="button"
              onClick={() => {
                const player = playerRef.current;
                if (!player) {
                  return;
                }
                if (isPlaying) {
                  player.pauseVideo();
                } else {
                  player.playVideo();
                }
              }}
              className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              {isPlaying ? "Tạm dừng" : "Tiếp tục"}
            </button>
            <button
              type="button"
              onClick={handlePrevSentence}
              className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Câu trước
            </button>
            <button
              type="button"
              onClick={handleNextSentence}
              className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
            >
              Tiếp theo
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-[1.5rem] bg-white p-5 text-[#10262d] shadow-xl">
          {!checked ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Chưa hiện phụ đề hay đáp án. Bấm <span className="font-semibold">Check đáp án</span> sau khi nghe đủ 3 lần.
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Kết quả check</p>
                <div className="mt-3 flex flex-wrap gap-2 leading-8">
                  {maskedWords.map((word, index) => {
                    const isMasked = word === "*";
                    return (
                      <span
                        key={`${word}-${index}`}
                        className={`rounded-full px-3 py-1 text-sm font-semibold ${isMasked ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
                      >
                        {word}
                      </span>
                    );
                  })}
                </div>
                {!showFullAnswer ? (
                  <button
                    type="button"
                    onClick={() => setShowFullAnswer(true)}
                    className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                  >
                    Show full đáp án
                  </button>
                ) : null}
              </div>

              {showFullAnswer ? (
                <div
                  className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5"
                  onMouseUp={() => {
                    const selection = window.getSelection()?.toString().trim();
                    if (selection) {
                      void handleLookupMeaning(selection);
                    }
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Full đáp án</p>
                  <div className="mt-3 flex flex-wrap gap-2 leading-8">
                    {fullAnswerWords.map((item, index) => (
                      <button
                        key={`${item.answer}-${index}`}
                        type="button"
                        onClick={() => void handleLookupMeaning(item.answer)}
                        className={`rounded-full px-3 py-1 text-sm font-semibold transition ${item.correct ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-800"}`}
                      >
                        {item.answer}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

            </>
          )}

          <label className="block text-sm font-semibold text-[#114149]" htmlFor="dictation-input">
            Nhập lại câu bạn nghe được
          </label>
          <p className="mt-1 text-xs text-slate-500">Không hiện phụ đề ở đây. Hãy nghe đến 3 lượt rồi bấm kiểm tra.</p>
          <textarea
            id="dictation-input"
            value={typedText}
            onChange={(event) => setTypedText(event.target.value)}
            className="mt-3 min-h-36 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-base outline-none transition focus:border-cyan-400 focus:bg-white"
            placeholder="Nghe và gõ lại câu tiếng Hàn..."
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCheckAnswer}
              className="rounded-full bg-[#f1893c] px-5 py-3 font-bold text-white transition hover:bg-[#d9772f]"
            >
              Check đáp án
            </button>
            <button
              type="button"
              onClick={() => setTypedText("")}
              className="rounded-full border border-slate-200 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Xóa ô nhập
            </button>
          </div>

          {feedback ? <p className="mt-4 text-sm font-medium text-[#1f4d59]">{feedback}</p> : null}
          {error ? <p className="mt-2 text-sm font-medium text-rose-600">{error}</p> : null}
        </div>
      </section>

      <aside className="rounded-[2rem] bg-white p-5 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tra từ</p>
            <h3 className="mt-1 text-2xl font-bold text-slate-900">Từ điển Hàn - Việt</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{sentences.length} câu</span>
        </div>

        <div className="mt-4 rounded-3xl border border-cyan-100 bg-cyan-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">Từ đang tra</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{selectedText || "Chọn hoặc bấm vào một từ"}</p>
          <p className="mt-2 text-sm text-slate-700">{lookupLoading ? "Đang tra nghĩa..." : selectedMeaning || ""}</p>
        </div>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Cách dùng</p>
          <p className="mt-2">1. Bấm <span className="font-semibold">Phát câu này</span>.</p>
          <p className="mt-1">2. Video tự lặp 3 lần cho tới khi dừng hẳn.</p>
          <p className="mt-1">3. Gõ lại, bấm <span className="font-semibold">Check đáp án</span>, rồi bấm vào từ để tra nghĩa.</p>
          <p className="mt-1">4. Chỉ khi bấm <span className="font-semibold">Tiếp theo</span> mới sang câu khác.</p>
        </div>
      </aside>
    </div>
  );
}
