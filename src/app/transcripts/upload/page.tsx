"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type UploadMode = "youtube" | "paste";

type TimedSegment = {
  text: string;
  startSec?: number;
  endSec?: number;
  segmentOrder?: number;
};

export default function UploadTranscriptPage() {
  const router = useRouter();
  const [mode, setMode] = useState<UploadMode>("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [rawTranscript, setRawTranscript] = useState("");
  const [segments, setSegments] = useState<TimedSegment[]>([]);
  const [level, setLevel] = useState("beginner");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleYoutubeExtract() {
    if (!youtubeUrl.trim()) {
      setError("Vui lòng nhập YouTube URL");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to extract subtitles");
      }

      const data = await res.json();
      setTitle(`YouTube - ${new Date().toLocaleDateString("vi-VN")}`);
      setSourceUrl(data.sourceUrl);
      setRawTranscript(data.transcript);
      setSegments(Array.isArray(data.segments) ? data.segments : []);
      setMode("paste");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/transcripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          sourceUrl: sourceUrl || null,
          rawTranscript,
          segments,
          level,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to create transcript");
      }

      const data = await res.json();
      router.push(`/transcripts/${data.transcript.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/transcripts" className="text-white hover:underline mb-6 inline-block">
          ← Quay lại danh sách kịch bản
        </Link>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Tải lên kịch bản luyện nghe</h1>
          <p className="text-gray-600 mb-8">Chọn cách nhập nội dung tiếng Hàn để luyện tập</p>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Bộ chọn chế độ nhập */}
          <div className="flex gap-4 mb-8 p-4 bg-gray-100 rounded-lg">
            <button
              onClick={() => setMode("youtube")}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition ${
                mode === "youtube"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-800"
              }`}
            >
              🎥 Lấy từ YouTube
            </button>
            <button
              onClick={() => setMode("paste")}
              className={`flex-1 py-2 px-4 rounded-lg font-semibold transition ${
                mode === "paste"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-800"
              }`}
            >
              📝 Dán văn bản
            </button>
          </div>

          {/* Chế độ lấy từ YouTube */}
          {mode === "youtube" && (
            <div className="mb-8 p-6 bg-blue-50 rounded-lg border-2 border-blue-200">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Tự động lấy phụ đề từ YouTube</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Đường dẫn YouTube
                  </label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... hoặc https://youtu.be/..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    ✓ Tự động lấy phụ đề tiếng Hàn (từ auto-generated hoặc upload)
                  </p>
                  {segments.length > 0 ? (
                    <p className="text-xs text-green-700 mt-1">
                      ✓ Đã tách {segments.length} đoạn theo thời gian
                    </p>
                  ) : null}
                </div>
                <button
                  onClick={handleYoutubeExtract}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? "Đang lấy phụ đề..." : "🎬 Lấy phụ đề"}
                </button>
              </div>
            </div>
          )}

          {/* Paste/Edit Mode */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., K-drama Episode 1, News Article"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Source URL (optional)
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or source link"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Korean Transcript *
              </label>
              <textarea
                value={rawTranscript}
                onChange={(e) => setRawTranscript(e.target.value)}
                placeholder="Paste your Korean text here. Sentences will be split by periods (.) automatically."
                className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-korean"
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                Tip: Use periods (.) or exclamation marks (!) to separate sentences
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Level
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 rounded-lg hover:shadow-lg transition disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create & Edit"}
              </button>
              <Link
                href="/transcripts"
                className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-300 transition text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
