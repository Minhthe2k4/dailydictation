import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Simple Korean vocabulary and grammar analyzer
function analyzeKoreanSentence(text: string) {
  const vocabularyNote: string[] = [];
  const grammarPatterns: string[] = [];

  // Basic pattern detection for common Korean grammar
  if (text.includes("-어요") || text.includes("-아요")) {
    grammarPatterns.push("Present tense polite ending (-어요/-아요)");
  }
  if (text.includes("-습니다") || text.includes("-습니다")) {
    grammarPatterns.push("Formal polite ending (-습니다)");
  }
  if (text.includes("-고 있") || text.includes("-고있")) {
    grammarPatterns.push("Progressive aspect (-고 있다)");
  }
  if (text.includes("-을 때")) {
    grammarPatterns.push("Temporal clause (-을 때)");
  }
  if (text.includes("-부터")) {
    grammarPatterns.push("Starting point marker (-부터)");
  }
  if (text.includes("가지고") || text.includes("들고")) {
    vocabularyNote.push("Carrying/holding verbs");
  }
  if (text.includes("꼭")) {
    vocabularyNote.push("꼭 (surely, must) - emphasis adverb");
  }
  if (text.includes("정말")) {
    vocabularyNote.push("정말 (really, truly) - adverb of emphasis");
  }

  return {
    vocabulary: vocabularyNote.length > 0 ? vocabularyNote.join("; ") : "Basic vocabulary",
    grammar: grammarPatterns.length > 0 ? grammarPatterns.join("; ") : "Standard structure",
  };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  void req;
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const transcript = await prisma.transcript.findUnique({
    where: { id },
    select: { userId: true, editedTranscript: true },
  });

  if (!transcript) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (transcript.userId !== session.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }


  // Always delete old sentences before generating new ones
  await prisma.sentence.deleteMany({ where: { transcriptId: id } });

  // Split and create new sentences from latest editedTranscript
  const splitSentences = transcript.editedTranscript
    .split(/[.!?。！？]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  await prisma.sentence.createMany({
    data: splitSentences.map((text, index) => ({
      text,
      level: "beginner",
      transcriptId: id,
      segmentOrder: index + 1,
    })),
  });

  let workingSegments = await prisma.sentence.findMany({
    where: { transcriptId: id },
    orderBy: [
      { segmentOrder: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      id: true,
      text: true,
    },
  });

  // Analyze each sentence sequentially to avoid SQLite timeout/locking
  const analyzed = [];
  for (const segment of workingSegments) {
    const { vocabulary, grammar } = analyzeKoreanSentence(segment.text);
    const updated = await prisma.sentence.update({
      where: { id: segment.id },
      data: {
        vocabularyNote: vocabulary,
        grammarNote: grammar,
      },
      select: {
        id: true,
        text: true,
        vocabularyNote: true,
        grammarNote: true,
      },
    });
    analyzed.push(updated);
  }

  return NextResponse.json({ analyzed, count: analyzed.length });
}
