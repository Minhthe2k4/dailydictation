"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Sentence = {
  id: string;
  text: string;
  level: string;
  startSec?: number;
  endSec?: number;
  vietnameseMean?: string;
  vocabularyNote?: string;
  grammarNote?: string;
  bookmarked?: boolean;
};

type AttemptItem = {
  id: string;
  score: number;
  typedText: string;
  createdAt: string;
  sentence: {
    text: string;
    level: string;
  };
};

type DictationTrainerProps = {
  sentences: Sentence[];
  initialHistory?: AttemptItem[];
};

export function DictationTrainer({ sentences: initialSentences, initialHistory = [] }: DictationTrainerProps) {
  // Audio bar state (phải nằm trong thân hàm component)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioCurrent, setAudioCurrent] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [sentences] = useState(initialSentences);
  // Bookmark state (local optimistic update)
  const [sentencesState, setSentencesState] = useState(sentences);
  useEffect(() => { setSentencesState(sentences); }, [sentences]);
  const [bookmarking, setBookmarking] = useState(false);
  const activeSentenceWithBookmark = useMemo(() => sentencesState[activeIndex], [activeIndex, sentencesState]);
  async function handleToggleBookmark() {
    if (!activeSentenceWithBookmark) return;
    setBookmarking(true);
    const prev = activeSentenceWithBookmark.bookmarked;
    setSentencesState((prevList) => prevList.map((s, i) => i === activeIndex ? { ...s, bookmarked: !prev } : s));
    try {
      await fetch("/api/sentences/bookmark", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sentenceId: activeSentenceWithBookmark.id, bookmarked: !prev }),
      });
    } catch {
      setSentencesState((prevList) => prevList.map((s, i) => i === activeIndex ? { ...s, bookmarked: prev } : s));
    } finally {
      setBookmarking(false);
    }
  }
  const [history, setHistory] = useState(initialHistory);

  // Key for localStorage (unique per transcript if possible)
  // Use transcript id if available for unique key, fallback to generic
  const transcriptId = sentences.length > 0 ? sentences[0]?.id?.split('-')[0] || '' : '';
  const localStorageKey = transcriptId ? `dictation-active-index-${transcriptId}` : 'dictation-active-index';

  // On mount, restore activeIndex from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && sentences.length > 0) {
      const saved = window.localStorage.getItem(localStorageKey);
      if (saved !== null) {
        const idx = parseInt(saved, 10);
        if (!isNaN(idx) && idx >= 0 && idx < sentences.length) {
          setActiveIndex(idx);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentences.length, localStorageKey]);

  // Whenever activeIndex changes, save to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && sentences.length > 0) {
      window.localStorage.setItem(localStorageKey, String(activeIndex));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, sentences.length, localStorageKey]);
  const [typedText, setTypedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  // Gemini API output shape
  const [analysis, setAnalysis] = useState<{
    vocabulary?: { word: string; meaning: string }[];
    grammar?: string;
    meaning?: string;
    examples?: string[];
    error?: string;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [audioRate, setAudioRate] = useState(1);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const activeSentence = useMemo(() => sentences[activeIndex], [activeIndex, sentences]);

  const formatTime = (seconds?: number) => {
    if (typeof seconds !== "number" || Number.isNaN(seconds)) {
      return null;
    }

    const total = Math.max(0, Math.floor(seconds));
    const mm = String(Math.floor(total / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  // Play/pause speechSynthesis đơn giản, chỉ giữ tốc độ nghe
  const playAudio = () => {
    if (!activeSentence || typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(activeSentence.text);
    utterance.lang = "ko-KR";
    utterance.rate = audioRate;
    utterance.pitch = 1.1; // tăng nhẹ độ tự nhiên
    // Chọn voice Hàn tự nhiên nhất nếu có
    const voices = window.speechSynthesis.getVoices();
    // Ưu tiên các voice nữ, Google, Samsung, Wavenet, hoặc tên chứa 'ko'/'Korean'
    const krVoices = voices.filter(v => v.lang === "ko-KR");
    if (krVoices.length > 1) {
      // Ưu tiên Google, Samsung, Wavenet
      const prefer = krVoices.find(v => v.name.match(/(Google|Samsung|Wavenet)/i));
      utterance.voice = prefer || krVoices[0];
    } else if (krVoices.length === 1) {
      utterance.voice = krVoices[0];
    }
    utterance.onend = () => setAudioPlaying(false);
    utterance.onerror = () => setAudioPlaying(false);
    setAudioPlaying(true);
    // Một số trình duyệt cần gọi getVoices trước khi speak
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        playAudio();
      };
      window.speechSynthesis.getVoices();
      return;
    }
    window.speechSynthesis.speak(utterance);
  };
  const pauseAudio = () => {
    if (typeof window !== "undefined") {
      window.speechSynthesis.pause();
      setAudioPlaying(false);
    }
  };
  const resumeAudio = () => {
    if (typeof window !== "undefined") {
      window.speechSynthesis.resume();
      setAudioPlaying(true);
    }
  };

  const [wordReveal, setWordReveal] = useState<string[] | null>(null);
  const handleSubmit = async () => {
    if (!activeSentence || !typedText.trim()) {
      setFeedback("Hãy nhập nội dung bạn vừa nghe trước khi nộp.");
      return;
    }

    // So sánh từng từ, từ đúng hiện ra, từ sai che ***
    const answerWords = activeSentence.text.trim().split(/\s+/);
    const userWords = typedText.trim().split(/\s+/);
    const reveal: string[] = answerWords.map((w, i) => {
      if (userWords[i] && w.localeCompare(userWords[i], undefined, { sensitivity: 'base' }) === 0) {
        return w;
      }
      return '***';
    });
    setWordReveal(reveal);

    setLoading(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sentenceId: activeSentence.id,
          typedText,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: string }
          | null;
        throw new Error(payload?.message ?? "Không thể lưu kết quả.");
      }

      const payload = (await response.json()) as { attempt: AttemptItem };
      setHistory((prev) => [payload.attempt, ...prev].slice(0, 12));
      setFeedback(`Điểm của bạn: ${payload.attempt.score}/100`);
      // setTypedText("");
      setShowAnswer(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
      setFeedback(message);
    } finally {
      setLoading(false);
    }
  };

  const nextSentence = () => {
    if (!sentences.length) return;
    setActiveIndex((prev) => (prev + 1) % sentences.length);
    setTypedText("");
    setFeedback(null);
    setShowAnswer(false);
  };

  if (!activeSentenceWithBookmark) {
    return <p className="rounded-2xl bg-white/70 p-6">Không có câu nghe để luyện.</p>;
  }

  // Hàm gọi API phân tích khi xem đáp án
  const handleShowAnswer = async () => {
    setShowAnswer((prev) => !prev);
    // Nếu chuyển sang trạng thái showAnswer=true thì gọi Gemini API
    if (!showAnswer && activeSentence?.text) {
      setAnalyzing(true);
      setAnalysis(null);
      try {
        const res = await fetch("/api/gemini-explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sentence: activeSentence.text })
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Không phân tích được câu này.");
        }
        const data = await res.json();
        // Normalize vocabulary: if array of strings, convert to {word, meaning}
        let vocab = data.vocabulary;
        if (Array.isArray(vocab) && typeof vocab[0] === 'string') {
          vocab = vocab.map((item: string) => {
            const [word, ...rest] = item.split(":");
            return { word: word.trim(), meaning: rest.join(":").trim() };
          });
        }
        setAnalysis({
          vocabulary: vocab,
          grammar: data.grammar,
          meaning: data.meaning,
          examples: data.examples,
        });
      } catch (e) {
        setAnalysis({ error: (e instanceof Error ? e.message : "Lỗi không xác định") });
      } finally {
        setAnalyzing(false);
      }
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5">
        {/* Chỉ mục số câu hiện tại */}
        <div className="mb-2 text-sm font-semibold text-[#0f3f42] flex items-center gap-2">
          Câu {activeIndex + 1}/{sentences.length}
          <form
            onSubmit={e => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('jumpTo') as HTMLInputElement;
              const val = parseInt(input.value, 10);
              if (!isNaN(val) && val >= 1 && val <= sentences.length) {
                setActiveIndex(val - 1);
              }
              input.value = '';
            }}
          >
            <input
              type="number"
              name="jumpTo"
              min={1}
              max={sentences.length}
              placeholder="Tới số..."
              className="ml-2 w-16 px-2 py-1 border rounded text-sm"
            />
            <button type="submit" className="ml-1 px-2 py-1 rounded bg-blue-500 text-white text-xs">Tới</button>
          </form>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <button
            aria-label={activeSentenceWithBookmark?.bookmarked ? "Bỏ đánh dấu câu này" : "Đánh dấu câu này"}
            onClick={handleToggleBookmark}
            disabled={bookmarking}
            className={"text-2xl transition " + (activeSentenceWithBookmark?.bookmarked ? "text-yellow-400" : "text-gray-300 hover:text-yellow-400")}
            style={{ cursor: bookmarking ? "not-allowed" : "pointer" }}
          >
            {activeSentenceWithBookmark?.bookmarked ? "⭐" : "☆"}
          </button>
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[#0f3f42]">
          Luyện nghe tiếng Hàn
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[#132329]">Nghe và chép chính tả</h2>
        <p className="mt-2 text-sm text-[#33545d]">
          Cấp độ: <span className="font-semibold">{activeSentenceWithBookmark.level}</span>
        </p>
        {((typeof activeSentenceWithBookmark.startSec === "number") ||
          (typeof activeSentenceWithBookmark.endSec === "number")) && (
            <p className="mt-1 text-sm text-[#33545d]">
              Moc thoi gian: {formatTime(activeSentenceWithBookmark.startSec) ?? "--:--"} - {formatTime(activeSentenceWithBookmark.endSec) ?? "--:--"}
            </p>
          )}

        {/* Audio bar: chỉ play/pause cho speechSynthesis */}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={audioPlaying ? pauseAudio : playAudio}
            className="rounded-full bg-[#0f3f42] text-white w-10 h-10 flex items-center justify-center text-xl"
            aria-label={audioPlaying ? "Pause" : "Play"}
          >
            {audioPlaying ? (
              <span>❚❚</span>
            ) : (
              <span>▶️</span>
            )}
          </button>
          <span className="text-xs font-mono">Text-to-Speech</span>
          <button
            type="button"
            onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
            className="ml-2 px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setActiveIndex(i => Math.min(sentences.length - 1, i + 1))}
            className="px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
          >
            →
          </button>
          <label className="ml-2 flex items-center gap-1 text-sm">
            Tốc độ:
            <select
              value={audioRate}
              onChange={e => setAudioRate(Number(e.target.value))}
              className="border rounded px-1 py-0.5 text-sm"
            >
              <option value={0.25}>0.25x</option>
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={1.75}>1.75x</option>
              <option value={2.0}>2.0x</option>
            </select>
          </label>
        </div>
        {/* Nút đáp án, câu tiếp theo giữ nguyên */}
        <div className="mt-3 flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={handleShowAnswer}
            className="cursor-pointer rounded-xl border border-[#0f3f42] px-4 py-2 font-semibold text-[#0f3f42] transition hover:bg-[#eef6f6]"
          >
            {showAnswer ? "Ẩn đáp án" : analyzing ? "Đang phân tích..." : "Xem đáp án"}
          </button>
          <button
            type="button"
            onClick={nextSentence}
            className="cursor-pointer rounded-xl border border-[#f1893c] px-4 py-2 font-semibold text-[#ad581f] transition hover:bg-[#fff3eb]"
          >
            Câu tiếp theo
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && sentences.length > 0) {
                window.localStorage.setItem(localStorageKey, String(activeIndex));
                window.alert('Đã lưu tiến độ!');
              }
            }}
            className="cursor-pointer rounded-xl border border-green-600 px-4 py-2 font-semibold text-green-700 transition hover:bg-green-100"
          >
            Lưu tiến độ
          </button>
        </div>

        {showAnswer ? (
          <div className="mt-4 space-y-3 rounded-xl bg-[#f3faf9] p-4">
            <p className="font-semibold text-[#17363f]">{activeSentence.text}</p>
            {/* Nếu có lỗi từ Gemini hoặc lỗi parse, show rõ lỗi và chi tiết */}
            {analysis?.error && (
              <div className="text-xs text-red-600">
                Lỗi phân tích: {analysis.error}
              </div>
            )}
            {/* Nghĩa toàn câu */}
            {analysis?.meaning && (
              <div className="border-t border-[#d0e3e1] pt-3">
                <p className="text-sm text-[#17363f]">
                  <span className="font-semibold">Nghĩa toàn câu:</span> {analysis.meaning}
                </p>
              </div>
            )}
            {/* Từ vựng */}
            {Array.isArray(analysis?.vocabulary) && analysis.vocabulary.length > 0 && (
              <div>
                <p className="text-xs text-[#0f3f42] font-semibold mb-1">📚 Từ vựng:</p>
                <ul className="text-xs text-[#0f3f42] list-disc ml-5">
                  {analysis.vocabulary.map((v, i) =>
                    typeof v === 'object' && v !== null && 'word' in v && 'meaning' in v ? (
                      <li key={i}><span className="font-bold">{v.word}</span>: {v.meaning}</li>
                    ) : null
                  )}
                </ul>
              </div>
            )}
            {/* Nếu không có dữ liệu */}
            {!analysis && analyzing && (
              <div className="text-xs text-gray-500">Đang phân tích...</div>
            )}
          </div>
        ) : null}

        <label className="mt-5 block text-sm font-semibold text-[#17363f]" htmlFor="dictation-input">
          Nội dung bạn nghe được
        </label>
        <textarea
          id="dictation-input"
          value={typedText}
          onChange={(event) => setTypedText(event.target.value)}
          className="mt-2 min-h-36 w-full rounded-xl border border-[#d0e3e1] bg-[#fcfffe] p-4 text-[#1a2f37] outline-none focus:border-[#0f3f42]"
          placeholder="Nhập câu tiếng Hàn bạn vừa nghe được..."
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="mt-4 cursor-pointer rounded-xl bg-[#f1893c] px-5 py-3 font-semibold text-white transition hover:bg-[#d9772f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Đang lưu..." : "Nộp bài"}
        </button>

        {feedback ? <p className="mt-3 text-sm font-medium text-[#1f4d59]">{feedback}</p> : null}
        {wordReveal && (
          <div className="mt-4 p-3 rounded-xl bg-[#f3faf9] border border-[#d0e3e1]">
            {wordReveal.map((w, i) => {
              if (
                typeof w === 'object' &&
                w !== null &&
                'word' in w &&
                typeof (w as { word: unknown }).word === 'string'
              ) {
                return <span key={i} className="font-bold text-green-700">{(w as { word: string }).word} </span>;
              }
              if (w === '***') {
                return <span key={i} className="font-bold text-gray-400">*** </span>;
              }
              return <span key={i} className="font-bold text-green-700">{w} </span>;
            })}
          </div>
        )}
      </section>

      {/* Đã xóa phần lịch sử gần đây */}
    </div>
  );
}
