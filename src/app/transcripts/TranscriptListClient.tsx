"use client";
import Link from "next/link";
import { useState } from "react";

type Transcript = {
  id: string;
  title: string;
  level: string;
  createdAt: string | Date;
  sourceUrl?: string | null;
  _count: { sentences: number };
};

export default function TranscriptListClient({ transcripts }: { transcripts: Transcript[] }) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  async function handleDelete(id: string) {
    if (!window.confirm("Bạn có chắc chắn muốn xóa transcript này?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/transcripts/${id}`, { method: "DELETE" });
    if (res.ok) {
      window.location.reload();
    } else {
      alert("Xóa transcript thất bại!");
      setDeletingId(null);
    }
  }

  if (transcripts.length === 0) {
    return (
      <div className="bg-white rounded-3xl shadow-2xl p-12 text-center">
        <p className="text-gray-600 text-lg mb-6">Chưa có kịch bản nào. Hãy tạo mới để bắt đầu luyện nghe!</p>
        <Link
          href="/transcripts/upload"
          className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-8 rounded-lg hover:shadow-lg transition"
        >
          ➕ Tải lên kịch bản đầu tiên
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {transcripts.map((transcript) => (
        <div
          key={transcript.id}
          className="bg-white rounded-3xl shadow-xl hover:shadow-2xl transition overflow-hidden group border border-gray-100"
        >
          <div className="p-7 flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-gray-800 group-hover:text-purple-700 transition line-clamp-2">
                {transcript.title}
              </h3>
              <span className="text-xs font-semibold bg-gradient-to-r from-pink-100 to-purple-100 text-purple-700 px-3 py-1 rounded-full capitalize whitespace-nowrap ml-3">
                {transcript.level === "beginner" ? "Sơ cấp" : transcript.level === "intermediate" ? "Trung cấp" : transcript.level === "advanced" ? "Nâng cao" : transcript.level}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-3 text-gray-500 text-xs">
              <span>📝 {transcript._count.sentences} câu</span>
              <span>•</span>
              <span>Ngày tạo: {new Date(transcript.createdAt).toLocaleDateString("vi-VN")}</span>
            </div>

            {transcript.sourceUrl && (
              <a
                href={transcript.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-700 mb-3 truncate hover:underline"
              >
                🔗 Nguồn: {transcript.sourceUrl}
              </a>
            )}

            <div className="flex-1" />

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
              <Link
                href={`/transcripts/${transcript.id}/edit`}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-semibold py-2 rounded-lg hover:from-purple-700 hover:to-pink-600 transition text-center shadow"
              >
                ✏️ Chỉnh sửa
              </Link>
              <Link
                href={`/transcripts/${transcript.id}/practice`}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold py-2 rounded-lg hover:from-blue-700 hover:to-cyan-600 transition text-center shadow"
              >
                ▶️ Luyện tập
              </Link>
              <button
                className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-sm font-semibold py-2 rounded-lg hover:from-red-600 hover:to-pink-600 transition shadow disabled:opacity-60"
                onClick={() => handleDelete(transcript.id)}
                disabled={deletingId === transcript.id}
              >
                {deletingId === transcript.id ? "Đang xóa..." : "🗑️ Xóa"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}