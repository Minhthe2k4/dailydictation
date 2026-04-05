import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PracticeClientWrapper from "./PracticeClientWrapper";

export default async function PracticeTranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const transcript = await prisma.transcript.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      level: true,
      sourceUrl: true,
      userId: true,
      sentences: {
        orderBy: [
          { segmentOrder: "asc" },
          { createdAt: "asc" },
        ],
        select: {
          id: true,
          text: true,
          level: true,
          segmentOrder: true,
          startSec: true,
          endSec: true,
          vietnameseMean: true,
          vocabularyNote: true,
          grammarNote: true,
          bookmarked: true,
        },
      },
    },
  });

  if (!transcript || transcript.userId !== session.user.id) {
    redirect("/transcripts");
  }

  const progress = await prisma.practiceState.findUnique({
    where: {
      userId_transcriptId: {
        userId: session.user.id,
        transcriptId: id,
      },
    },
    select: {
      sentenceId: true,
      typedText: true,
    },
  });

  return <PracticeClientWrapper transcript={transcript} initialProgress={progress} />;
}
