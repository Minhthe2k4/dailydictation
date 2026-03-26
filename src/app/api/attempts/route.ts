import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}

function calculateScore(expected: string, typed: string): number {
  const normalizedExpected = expected.replace(/\s+/g, " ").trim();
  const normalizedTyped = typed.replace(/\s+/g, " ").trim();

  if (!normalizedExpected.length && !normalizedTyped.length) {
    return 100;
  }

  const distance = levenshteinDistance(normalizedExpected, normalizedTyped);
  const maxLen = Math.max(normalizedExpected.length, normalizedTyped.length, 1);
  const rawScore = Math.max(0, 1 - distance / maxLen);
  return Math.round(rawScore * 100);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { sentenceId?: string; typedText?: string };

  if (!body.sentenceId || typeof body.typedText !== "string") {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const sentence = await prisma.sentence.findUnique({
    where: { id: body.sentenceId },
    select: { id: true, text: true },
  });

  if (!sentence) {
    return NextResponse.json({ message: "Sentence not found" }, { status: 404 });
  }

  const score = calculateScore(sentence.text, body.typedText);

  const attempt = await prisma.attempt.create({
    data: {
      userId: session.user.id,
      sentenceId: sentence.id,
      typedText: body.typedText,
      score,
    },
    select: {
      id: true,
      score: true,
      typedText: true,
      createdAt: true,
      sentence: {
        select: {
          text: true,
          level: true,
        },
      },
    },
  });

  return NextResponse.json({ attempt });
}
