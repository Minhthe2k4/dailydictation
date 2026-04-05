import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { translateKoreanText } from "@/lib/korean-translate";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent";

function cleanGeminiText(text: string) {
  let cleaned = text.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json/, "").trim();
  }

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```/, "").trim();
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.replace(/```$/, "").trim();
  }

  return cleaned.replace(/^"|"$/g, "");
}

async function translateSentenceWithGemini(sentence: string) {
  if (!GEMINI_API_KEY) {
    return null;
  }

  const prompt = [
    "Dịch câu tiếng Hàn sau sang tiếng Việt tự nhiên.",
    "Chỉ trả về bản dịch, không giải thích, không markdown, không đặt trong code block.",
    `Câu: ${sentence}`,
  ].join("\n");

  const geminiRes = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!geminiRes.ok) {
    return null;
  }

  const data = (await geminiRes.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const translation = cleanGeminiText(rawText);
  return translation || null;
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

  const dictionaryTranslation = translateKoreanText(sentence.text);
  const needsGeminiTranslation = !dictionaryTranslation || dictionaryTranslation.includes("[Chưa có bản dịch sẵn]");
  const geminiTranslation = needsGeminiTranslation ? await translateSentenceWithGemini(sentence.text) : null;
  const fallbackTranslation = dictionaryTranslation.replace(/\s*\[Chưa có bản dịch sẵn\]$/, "").trim();
  const vietnamese = geminiTranslation || fallbackTranslation || sentence.text;

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
