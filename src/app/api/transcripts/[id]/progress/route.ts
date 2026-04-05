import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const transcript = await prisma.transcript.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!transcript) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (transcript.userId !== session.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
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
      updatedAt: true,
    },
  });

  return NextResponse.json({ progress });
}

export async function PUT(req: Request, { params }: RouteContext) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const transcript = await prisma.transcript.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!transcript) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (transcript.userId !== session.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    sentenceId?: string | null;
    typedText?: string;
  } | null;

  if (!body || typeof body.typedText !== "string") {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  let sentenceId: string | null = null;

  if (typeof body.sentenceId === "string" && body.sentenceId) {
    const sentence = await prisma.sentence.findFirst({
      where: {
        id: body.sentenceId,
        transcriptId: id,
      },
      select: { id: true },
    });

    sentenceId = sentence?.id ?? null;
  }

  const progress = await prisma.practiceState.upsert({
    where: {
      userId_transcriptId: {
        userId: session.user.id,
        transcriptId: id,
      },
    },
    create: {
      userId: session.user.id,
      transcriptId: id,
      sentenceId,
      typedText: body.typedText,
    },
    update: {
      sentenceId,
      typedText: body.typedText,
    },
    select: {
      sentenceId: true,
      typedText: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ progress });
}