
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TranscriptListClient from "./TranscriptListClient";

type Transcript = {
  id: string;
  title: string;
  level: string;
  createdAt: string | Date;
  sourceUrl?: string | null;
  _count: { sentences: number };
};

export default async function TranscriptsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }

  const transcripts = await prisma.transcript.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      level: true,
      createdAt: true,
      sourceUrl: true,
      _count: {
        select: { sentences: true },
      },
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">📚 Quản lý bài luyện</h1>
          <Link
            href="/"
            className="text-white hover:underline text-sm font-semibold"
          >
            ← Về trang chủ
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-8">
          <Link
            href="/transcripts/upload"
            className="block bg-white rounded-3xl shadow-lg p-6 hover:shadow-xl transition text-center font-bold text-lg text-purple-600"
          >
            ➕ Thêm từ YouTube
          </Link>
        </div>

        <TranscriptListClient transcripts={transcripts} />
      </div>
    </div>
  );
}
