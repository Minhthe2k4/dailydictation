import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const transcript = await prisma.transcript.findUnique({
    where: { id },
    include: {
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
        },
      },
    },
  });

  if (!transcript) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (transcript.userId !== session.user.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ transcript });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const body = (await req.json()) as {
    editedTranscript?: string;
    level?: string;
  };

  const updated = await prisma.transcript.update({
    where: { id },
    data: {
      editedTranscript: body.editedTranscript,
      level: body.level,
    },
    select: {
      id: true,
      title: true,
      editedTranscript: true,
      level: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ transcript: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  await prisma.transcript.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
