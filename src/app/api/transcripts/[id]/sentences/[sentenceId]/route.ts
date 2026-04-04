export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; sentenceId: string }> }
) {
  const { id, sentenceId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sentence = await prisma.sentence.findUnique({
    where: { id: sentenceId },
    select: {
      id: true,
      transcriptId: true,
      transcript: {
        select: { userId: true },
      },
    },
  });

  if (!sentence || sentence.transcriptId !== id) {
    return NextResponse.json({ message: "Sentence not found" }, { status: 404 });
  }

  if (sentence.transcript?.userId !== session.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    text?: string;
    startSec?: number | null;
    endSec?: number | null;
  };

  const hasText = typeof body.text === "string" && body.text.trim().length > 0;
  const hasStart = typeof body.startSec === "number" && Number.isFinite(body.startSec);
  const hasEnd = typeof body.endSec === "number" && Number.isFinite(body.endSec);

  if (!hasText && !hasStart && !hasEnd) {
    return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.sentence.update({
    where: { id: sentenceId },
    data: {
      ...(hasText ? { text: body.text!.trim() } : {}),
      ...(hasStart ? { startSec: Number(body.startSec!.toFixed(2)) } : {}),
      ...(hasEnd ? { endSec: Number(body.endSec!.toFixed(2)) } : {}),
    },
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
    },
  });

  return NextResponse.json({ sentence: updated });
}
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; sentenceId: string }> }
) {
  const { id, sentenceId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const sentence = await prisma.sentence.findUnique({
    where: { id: sentenceId },
    select: {
      id: true,
      transcriptId: true,
      transcript: {
        select: { userId: true },
      },
    },
  });

  if (!sentence || sentence.transcriptId !== id) {
    return NextResponse.json({ message: "Sentence not found" }, { status: 404 });
  }

  if (sentence.transcript?.userId !== session.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await prisma.sentence.delete({
    where: { id: sentenceId },
  });

  return NextResponse.json({ success: true });
}
