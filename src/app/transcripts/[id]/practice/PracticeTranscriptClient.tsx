"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DictationTrainerClient from "./DictationTrainerClient";

interface Sentence {
  id: string;
  text: string;
  level: string;
  vietnameseMean?: string;
  vocabularyNote?: string;
  grammarNote?: string;
  bookmarked?: boolean;
}

interface TranscriptData {
  id: string;
  title: string;
  level: string;
  sentences: Sentence[];
}

export default function PracticeTranscriptClient({ id }: { id: string }) {
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchTranscript() {
      try {
        const res = await fetch(`/api/transcripts/${id}`);
        if (!res.ok) throw new Error("Failed to load transcript");
        const data = await res.json();
        if (data.transcript.sentences.length === 0) {
          throw new Error("No sentences yet. Please generate sentences first.");
        }
        setTranscript(data.transcript);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchTranscript();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6 flex items-center justify-center">
        <p className="text-white text-xl">Đang tải dữ liệu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
          <Link href={`/transcripts/${id}/edit`} className="text-white hover:underline">
            ← Quay lại chỉnh sửa
          </Link>
        </div>
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
        <div className="flex items-center justify-between mb-6">
          <Link href={`/transcripts/${id}/edit`} className="text-white hover:underline">
            ← Quay lại {transcript.title}
          </Link>
          <span className="text-white text-sm font-semibold capitalize bg-white/20 px-3 py-1 rounded-full">
            {transcript.level === "beginner" ? "Sơ cấp" : transcript.level === "intermediate" ? "Trung cấp" : transcript.level === "advanced" ? "Nâng cao" : transcript.level}
          </span>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Luyện nghe: {transcript.title}</h1>
          <p className="text-gray-600">{transcript.sentences.length} câu để luyện tập</p>
        </div>

        <DictationTrainerClient sentences={transcript.sentences} />
      </div>
    </div>
  );
}