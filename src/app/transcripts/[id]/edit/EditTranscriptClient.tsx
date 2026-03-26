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
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
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

  useEffect(() => {
    async function fetchTranscript() {
      try {
        const res = await fetch(`/api/transcripts/${id}`);
        if (!res.ok) throw new Error("Failed to load transcript");
        const data = await res.json();
        setTranscript(data.transcript);
        setEditedText(data.transcript.editedTranscript);
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.6fr] gap-6">
          {/* Editor */}
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{transcript.title}</h1>
            <p className="text-gray-600 mb-6 capitalize">Level: {transcript.level}</p>

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
            </div>

            {/* Practice Button */}
            <Link
              href={`/transcripts/${id}/practice`}
              className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-lg hover:shadow-lg transition text-center"
            >
              ▶️ Start Practice
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
                          <input
                            className="flex-1 border rounded px-2 py-1 text-gray-900"
                            value={editingText}
                            onChange={e => setEditingText(e.target.value)}
                            disabled={savingEdit}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              setSavingEdit(true);
                              setEditError("");
                              try {
                                const res = await fetch(`/api/transcripts/${id}/sentences/${sent.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ text: editingText }),
                                });
                                if (!res.ok) {
                                  const payload = (await res.json().catch(() => null)) as { message?: string } | null;
                                  throw new Error(payload?.message ?? "Failed to update sentence");
                                }
                                // Refresh transcript after edit
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
                            onClick={() => { setEditingSentenceId(sent.id); setEditingText(sent.text); setEditError(""); }}
                            className="shrink-0 rounded-md border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 ml-2"
                          >
                            Edit
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