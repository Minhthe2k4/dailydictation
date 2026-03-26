import { NextRequest, NextResponse } from "next/server";
import { koViDict } from "@/lib/kovi-dict";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const { text, lang } = await req.json();
  if (!text || !lang) {
    return NextResponse.json({ error: "Missing text or lang" }, { status: 400 });
  }


  // Tách từ đơn giản bằng khoảng trắng (có thể cải tiến bằng tokenizer Hàn)
  // Loại bỏ ký tự đặc biệt cuối từ
  const words = text
    .replace(/[.,!?;:()\[\]{}"'“”‘’]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  // Trả về danh sách từ vựng, tra nghĩa từ điển nếu có
  const vocabulary = words.map((word: string) => ({
    word,
    meaning: koViDict[word] || ""
  }));

  // Demo: translation và grammar giữ nguyên mẫu
  // Dịch nghĩa cả câu: ghép nghĩa các từ nếu có, nếu không thì trả về chuỗi rỗng
  const translation = vocabulary.map(v => v.meaning || v.word).join(" ");

  const result = {
    translation,
    vocabulary,
    grammar: [
      { pattern: "-습니다", explanation: "Đuôi câu trang trọng" }
    ]
  };

  return NextResponse.json(result);
}
