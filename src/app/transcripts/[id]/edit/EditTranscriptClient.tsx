"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Sentence {
  id: string;
  text: string;
  level: string;
  segmentOrder?: number;
  startSec?: number;
  endSec?: number;
  vietnameseMean?: string;
  vocabularyNote?: string;
  grammarNote?: string;
}

interface TranscriptData {
  id: string;
  title: string;
  editedTranscript: string;
  level: string;
  sourceUrl?: string | null;
  sentences: Sentence[];
}

export default function EditTranscriptClient({ id }: { id: string }) {
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [editedText, setEditedText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [punctuating, setPunctuating] = useState(false);
  const [deletingSentenceId, setDeletingSentenceId] = useState<string | null>(null);
  const [error, setError] = useState("");
  // Edit sentence state
  const [editingSentenceId, setEditingSentenceId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingStartSec, setEditingStartSec] = useState("");
  const [editingEndSec, setEditingEndSec] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [fixingTimeframes, setFixingTimeframes] = useState(false);
  const [previewSentenceId, setPreviewSentenceId] = useState<string | null>(null);

  const getYoutubeVideoId = (sourceUrl?: string | null) => {
    const url = sourceUrl ?? "";
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
  };
  async function handlePunctuate() {
    setPunctuating(true);
    setError("");
    try {
      const res = await fetch("/api/punctuate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editedText, language: "Korean" }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to punctuate");
      }
      const data = await res.json();
      setEditedText(data.improved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPunctuating(false);
    }
  }

  const formatTime = (seconds?: number) => {
    if (typeof seconds !== "number" || Number.isNaN(seconds)) {
      return "--:--";
    }

    const total = Math.max(0, Math.floor(seconds));
    const mm = String(Math.floor(total / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const parseTimeInput = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const estimateDuration = (text: string) => {
    const lengthBased = text.trim().length / 12;
    return Math.min(6, Math.max(1.2, Number(lengthBased.toFixed(2))));
  };

  const activePreviewSentence = transcript?.sentences.find((sentence) => sentence.id === previewSentenceId) ?? transcript?.sentences[0] ?? null;
  const previewVideoId = getYoutubeVideoId(transcript?.sourceUrl);
  const previewSrc = previewVideoId
    ? (() => {
        const params = new URLSearchParams({
          autoplay: "1",
          rel: "0",
          modestbranding: "1",
          playsinline: "1",
          enablejsapi: "1",
        });

        if (activePreviewSentence?.startSec !== undefined) {
          params.set("start", String(Math.max(0, Math.floor(activePreviewSentence.startSec))));
        }

        if (activePreviewSentence?.endSec !== undefined && activePreviewSentence.endSec > (activePreviewSentence.startSec ?? 0)) {
          params.set("end", String(Math.ceil(activePreviewSentence.endSec)));
        }

        return `https://www.youtube.com/embed/${previewVideoId}?${params.toString()}`;
      })()
    : null;

  useEffect(() => {
    async function fetchTranscript() {
      try {
        const res = await fetch(`/api/transcripts/${id}`);
        if (!res.ok) throw new Error("Failed to load transcript");
        const data = await res.json();
        setTranscript(data.transcript);
        setEditedText(data.transcript.editedTranscript);
        setPreviewSentenceId(data.transcript.sentences?.[0]?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchTranscript();
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/transcripts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedTranscript: editedText }),
      });

      if (!res.ok) throw new Error("Lưu kịch bản thất bại");
      setTranscript((prev) => (prev ? { ...prev, editedTranscript: editedText } : null));
      alert("Đã lưu kịch bản!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setSaving(false);
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true);
    setError("");

    try {
      // Auto-save edited transcript before analyzing
      const saveRes = await fetch(`/api/transcripts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editedTranscript: editedText }),
      });
      if (!saveRes.ok) throw new Error("Failed to save transcript before analyzing");

      // Now analyze with latest transcript
      const res = await fetch(`/api/transcripts/${id}/analyze`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to analyze");
      const data = await res.json();

      // Refresh transcript to show new sentences with analysis
      const getRes = await fetch(`/api/transcripts/${id}`);
      if (getRes.ok) {
        const updated = await getRes.json();
        setTranscript(updated.transcript);
      }

      alert(`Created/updated ${data.count} sentences with analysis!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDeleteSentence(sentenceId: string) {
    setDeletingSentenceId(sentenceId);
    setError("");

    try {
      const res = await fetch(`/api/transcripts/${id}/sentences/${sentenceId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "Failed to delete segment");
      }

      setTranscript((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          sentences: prev.sentences.filter((sentence) => sentence.id !== sentenceId),
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setDeletingSentenceId(null);
    }
  }

  async function handleAutoFixTimeframes() {
    if (!transcript?.sentences.length) {
      return;
    }

    setFixingTimeframes(true);
    setError("");

    try {
      const sorted = [...transcript.sentences].sort((left, right) => {
        const leftOrder = left.segmentOrder ?? 0;
        const rightOrder = right.segmentOrder ?? 0;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return left.id.localeCompare(right.id);
      });

      let cursor = sorted.find((sentence) => typeof sentence.startSec === "number" && sentence.startSec >= 0)?.startSec ?? 0;

      for (let index = 0; index < sorted.length; index += 1) {
        const sentence = sorted[index];
        const nextSentence = sorted[index + 1];
        const estimatedDuration = estimateDuration(sentence.text);
        const startSec = Number(cursor.toFixed(2));
        const nextKnownStart = typeof nextSentence?.startSec === "number" ? nextSentence.startSec : null;
        const maxEnd = nextKnownStart !== null ? Math.max(startSec + 0.3, nextKnownStart - 0.05) : startSec + estimatedDuration;
        const endSec = Number(Math.max(startSec + 0.3, maxEnd).toFixed(2));

        const res = await fetch(`/api/transcripts/${id}/sentences/${sentence.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startSec, endSec }),
        });

        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? "Failed to update timeframes");
        }

        cursor = endSec + 0.12;
      }

      const getRes = await fetch(`/api/transcripts/${id}`);
      if (getRes.ok) {
        const updated = await getRes.json();
        setTranscript(updated.transcript);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFixingTimeframes(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6 flex items-center justify-center">
        <p className="text-white text-xl">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (!transcript) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-white text-xl">Không tìm thấy kịch bản</p>
          <Link href="/transcripts" className="text-white hover:underline">
            ← Quay lại danh sách kịch bản
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/transcripts" className="text-white hover:underline mb-6 inline-block">
          ← Back to Transcripts
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-6">
          {/* Editor */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{transcript.title}</h1>
            <p className="text-gray-600 mb-6 capitalize">Level: {transcript.level}</p>

            <div className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">YouTube preview</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">
                    {activePreviewSentence ? `Câu ${activePreviewSentence.segmentOrder ?? transcript.sentences.indexOf(activePreviewSentence) + 1}` : "Chưa có câu để xem"}
                  </h2>
                </div>
                {activePreviewSentence ? (
                  <div className="text-right text-xs text-slate-500">
                    <p>{formatTime(activePreviewSentence.startSec)} - {formatTime(activePreviewSentence.endSec)}</p>
                    <p className="mt-1 max-w-xs truncate">{activePreviewSentence.text}</p>
                  </div>
                ) : null}
              </div>

              {previewSrc ? (
                <div className="overflow-hidden rounded-2xl bg-black shadow-lg">
                  <iframe
                    key={`${activePreviewSentence?.id ?? "preview"}-${activePreviewSentence?.startSec ?? 0}-${activePreviewSentence?.endSec ?? 0}`}
                    src={previewSrc}
                    title="YouTube preview"
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
                  Chưa có link YouTube hợp lệ để preview.
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Edit Transcript
              </label>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-korean text-lg leading-relaxed"
              />
              <p className="text-sm text-gray-500 mt-2">
                Sentences will be split by periods (.), question marks (?), or exclamation marks (!)
              </p>
            </div>

            <div className="flex gap-4 mb-8">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {saving ? "Saving..." : "💾 Save Transcript"}
              </button>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {analyzing ? "Analyzing..." : "🔍 Generate Sentences"}
              </button>
              <button
                onClick={handlePunctuate}
                disabled={punctuating || !editedText.trim()}
                className="flex-1 bg-purple-600 text-white font-bold py-3 rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
              >
                {punctuating ? "AI Đang chấm câu..." : "✨ AI Chấm câu"}
              </button>
              <button
                onClick={handleAutoFixTimeframes}
                disabled={fixingTimeframes || transcript.sentences.length === 0}
                className="flex-1 bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
              >
                {fixingTimeframes ? "Đang sửa timeframe..." : "🕒 Auto-fix timeframe"}
              </button>
            </div>

            {/* Practice Button */}
            <Link
              href={`/transcripts/${id}/practice`}
              className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-lg hover:shadow-lg transition text-center"
            >
              ▶️ Sang luyện tập với script đã sửa
            </Link>
          </div>

          {/* Sentences List */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 h-fit">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Sentences ({transcript.sentences.length})
            </h2>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {transcript.sentences.length === 0 ? (
                <p className="text-gray-500">Click &quot;Generate Sentences&quot; to create practice material</p>
              ) : (
                transcript.sentences.map((sent, idx) => (
                  <div key={sent.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      {editingSentenceId === sent.id ? (
                        <>
                          <div className="flex-1 space-y-2">
                            <input
                              className="w-full border rounded px-2 py-1 text-gray-900"
                              value={editingText}
                              onChange={e => setEditingText(e.target.value)}
                              disabled={savingEdit}
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                className="w-full border rounded px-2 py-1 text-gray-900 text-xs"
                                value={editingStartSec}
                                onChange={(e) => setEditingStartSec(e.target.value)}
                                disabled={savingEdit}
                                placeholder="startSec"
                              />
                              <input
                                className="w-full border rounded px-2 py-1 text-gray-900 text-xs"
                                value={editingEndSec}
                                onChange={(e) => setEditingEndSec(e.target.value)}
                                disabled={savingEdit}
                                placeholder="endSec"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              setSavingEdit(true);
                              setEditError("");
                              try {
                                const startSec = parseTimeInput(editingStartSec);
                                const endSec = parseTimeInput(editingEndSec);
                                const res = await fetch(`/api/transcripts/${id}/sentences/${sent.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    text: editingText,
                                    ...(startSec !== null ? { startSec } : {}),
                                    ...(endSec !== null ? { endSec } : {}),
                                  }),
                                });
                                if (!res.ok) {
                                  const payload = (await res.json().catch(() => null)) as { message?: string } | null;
                                  throw new Error(payload?.message ?? "Failed to update sentence");
                                }
                                const getRes = await fetch(`/api/transcripts/${id}`);
                                if (getRes.ok) {
                                  const updated = await getRes.json();
                                  setTranscript(updated.transcript);
                                }
                                setEditingSentenceId(null);
                              } catch (err) {
                                setEditError(err instanceof Error ? err.message : "Unknown error");
                              } finally {
                                setSavingEdit(false);
                              }
                            }}
                            disabled={savingEdit || !editingText.trim()}
                            className="ml-2 rounded-md border border-green-300 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                          >
                            {savingEdit ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingSentenceId(null); setEditError(""); }}
                            disabled={savingEdit}
                            className="ml-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-gray-900">
                            <span className="text-purple-600 font-bold">{sent.segmentOrder ?? idx + 1}.</span> {sent.text}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSentenceId(sent.id);
                              setEditingText(sent.text);
                              setEditingStartSec(typeof sent.startSec === "number" ? String(sent.startSec) : "");
                              setEditingEndSec(typeof sent.endSec === "number" ? String(sent.endSec) : "");
                              setEditError("");
                              setPreviewSentenceId(sent.id);
                            }}
                            className="shrink-0 rounded-md border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 ml-2"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setPreviewSentenceId(sent.id)}
                            className="shrink-0 rounded-md border border-cyan-300 px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-50 ml-1"
                          >
                            Tua đến đây
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSentence(sent.id)}
                            disabled={deletingSentenceId === sent.id}
                            className="shrink-0 rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 ml-1"
                          >
                            {deletingSentenceId === sent.id ? "Deleting..." : "Delete"}
                          </button>
                        </>
                      )}
                    </div>
                    {editingSentenceId === sent.id && editError && <p className="text-xs text-red-600 mb-1">{editError}</p>}
                    {(typeof sent.startSec === "number" || typeof sent.endSec === "number") && (
                      <p className="text-xs text-indigo-700 mb-2">
                        Time: {formatTime(sent.startSec)} - {formatTime(sent.endSec)}
                      </p>
                    )}
                    {sent.vietnameseMean && (
                      <p className="text-sm text-gray-700 mb-1">
                        <span className="font-semibold">VN:</span> {sent.vietnameseMean}
                      </p>
                    )}
                    {sent.vocabularyNote && (
                      <p className="text-xs text-blue-600 mb-1">
                        <span className="font-semibold">Từ vựng:</span> {sent.vocabularyNote}
                      </p>
                    )}
                    {sent.grammarNote && (
                      <p className="text-xs text-green-700 mb-1">
                        <span className="font-semibold">Ngữ pháp:</span> {sent.grammarNote}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}