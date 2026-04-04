"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UploadTranscriptPage() {
  const router = useRouter();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [level, setLevel] = useState("beginner");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleYoutubeStart(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!youtubeUrl.trim()) {
      setError("Vui lòng nhập YouTube URL");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const extractRes = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeUrl }),
      });

      if (!extractRes.ok) {
        const data = await extractRes.json().catch(() => null) as { message?: string } | null;
        throw new Error(data?.message || "Failed to extract subtitles");
      }

      const extracted = (await extractRes.json()) as {
        title?: string | null;
        transcript: string;
        segments: Array<{
          text: string;
          startSec?: number;
          endSec?: number;
          segmentOrder?: number;
        }>;
        sourceUrl: string;
      };

      const createRes = await fetch("/api/transcripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: extracted.title || `YouTube - ${new Date().toLocaleDateString("vi-VN")}`,
          sourceUrl: extracted.sourceUrl,
          rawTranscript: extracted.transcript,
          segments: Array.isArray(extracted.segments) ? extracted.segments : [],
          level,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json().catch(() => null) as { message?: string } | null;
        throw new Error(data?.message || "Failed to create transcript");
      }

      const created = (await createRes.json()) as { transcript: { id: string } };
      router.push(`/transcripts/${created.transcript.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_32%),linear-gradient(135deg,_#042f2e_0%,_#0f172a_45%,_#111827_100%)] p-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/transcripts" className="mb-6 inline-block text-sm font-semibold text-cyan-100 hover:underline">
          ← Quay lại danh sách bài luyện
        </Link>

        <div className="rounded-[2rem] border border-white/10 bg-white/95 p-8 shadow-2xl backdrop-blur">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-700">YouTube practice</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900">Dán link video và luyện ngay</h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Video gốc sẽ được mở trực tiếp, subtitle sẽ bám theo thời gian thực, và bạn có thể xóa từng đoạn không cần thiết trước khi chép chính tả.
            </p>
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleYoutubeStart} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                YouTube URL
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(event) => setYoutubeUrl(event.target.value)}
                placeholder="https://youtube.com/watch?v=... hoặc https://youtu.be/..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Level
              </label>
              <select
                value={level}
                onChange={(event) => setLevel(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-5 py-3 font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-600 hover:to-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Đang mở video..." : "Mở trang luyện"}
              </button>
              <Link
                href="/transcripts"
                className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-center font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Hủy
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}