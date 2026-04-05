"use client";

import Link from "next/link";
import DictationTrainerClient from "./DictationTrainerClient";
import YouTubePracticeClient from "./YouTubePracticeClient";
import { extractYoutubeVideoId } from "@/lib/youtube";
import { PracticeProgress, PracticeTranscript } from "@/types/practice";

export default function PracticeTranscriptClient({ transcript, initialProgress }: { transcript: PracticeTranscript; initialProgress: PracticeProgress | null }) {
  if (transcript.sentences.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-white text-xl">No sentences yet. Please generate sentences first.</p>
          <Link href={`/transcripts/${transcript.id}/edit`} className="text-white hover:underline">
            ← Quay lại chỉnh sửa
          </Link>
        </div>
      </div>
    );
  }

  const hasYoutubeSource = Boolean(extractYoutubeVideoId(transcript.sourceUrl ?? ""));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href={`/transcripts/${transcript.id}/edit`} className="text-white hover:underline">
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

        {hasYoutubeSource ? (
          <YouTubePracticeClient transcript={transcript} initialProgress={initialProgress} />
        ) : (
          <DictationTrainerClient transcriptId={transcript.id} sentences={transcript.sentences} initialProgress={initialProgress} />
        )}
      </div>
    </div>
  );
}