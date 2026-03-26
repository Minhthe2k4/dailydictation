import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Simple Korean-Vietnamese translation mapping (basic dictionary)
const koreanVietnameseDictionary: Record<string, string> = {
  안녕하세요: "Xin chào",
  감사합니다: "Cảm ơn",
  미안합니다: "Xin lỗi",
  네: "Vâng / Có",
  아니요: "Không",
  공부: "Học tập",
  선생님: "Giáo viên",
  학교: "Trường học",
  친구: "Bạn",
  가족: "Gia đình",
  날씨: "Thời tiết",
  좋다: "Tốt",
  나쁘다: "Xấu",
  크다: "Lớn",
  작다: "Nhỏ",
  많다: "Nhiều",
  적다: "Ít",
  먹다: "Ăn",
  마시다: "Uống",
  자다: "Ngủ",
  공부하다: "Học",
  걷다: "Đi bộ",
  달리다: "Chạy",
  치다: "Đánh",
  듣다: "Nghe",
  본다: "Nhìn",
  말하다: "Nói",
  쓰다: "Viết",
  읽다: "Đọc",
};

function translateKoreanToVietnamese(koreanText: string): string {
  let result = koreanText;

  // Simple word-by-word replacement (for demonstration)
  Object.entries(koreanVietnameseDictionary).forEach(([korean, vietnamese]) => {
    const regex = new RegExp(`\\b${korean}\\b`, "g");
    result = result.replace(regex, `${vietnamese} (${korean})`);
  });

  // If no translations found, return original with note
  if (result === koreanText) {
    return `${koreanText} [Translation needed - use Google Translate API for full translation]`;
  }

  return result;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { sentenceId?: string };

  if (!body.sentenceId) {
    return NextResponse.json({ message: "sentenceId required" }, { status: 400 });
  }

  const sentence = await prisma.sentence.findUnique({
    where: { id: body.sentenceId },
    include: {
      transcript: {
        select: { userId: true },
      },
    },
  });

  if (!sentence) {
    return NextResponse.json({ message: "Sentence not found" }, { status: 404 });
  }

  if (sentence.transcript?.userId !== session.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const vietnamese = translateKoreanToVietnamese(sentence.text);

  // Update sentence with translation
  const updated = await prisma.sentence.update({
    where: { id: body.sentenceId },
    data: {
      vietnameseMean: vietnamese,
    },
    select: {
      id: true,
      text: true,
      vietnameseMean: true,
    },
  });

  return NextResponse.json({ translated: updated });
}
