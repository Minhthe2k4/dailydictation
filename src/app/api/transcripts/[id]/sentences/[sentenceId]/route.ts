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

  const body = (await req.json()) as { text?: string };
  if (!body.text || !body.text.trim()) {
    return NextResponse.json({ message: "Text required" }, { status: 400 });
  }

  const updated = await prisma.sentence.update({
    where: { id: sentenceId },
    data: { text: body.text.trim() },
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
