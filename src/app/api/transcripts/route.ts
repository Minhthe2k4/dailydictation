import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type IncomingSegment = {
  text: string;
  startSec?: number;
  endSec?: number;
  segmentOrder?: number;
};

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const transcripts = await prisma.transcript.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      level: true,
      createdAt: true,
      updatedAt: true,
      sourceUrl: true,
    },
  });

  return NextResponse.json({ transcripts });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    title?: string;
    sourceUrl?: string;
    rawTranscript?: string;
    level?: string;
    segments?: IncomingSegment[];
  };

  if (!body.title || !body.rawTranscript) {
    return NextResponse.json(
      { message: "Title and rawTranscript required" },
      { status: 400 }
    );
  }

  const transcript = await prisma.transcript.create({
    data: {
      userId: session.user.id,
      title: body.title,
      sourceUrl: body.sourceUrl || null,
      rawTranscript: body.rawTranscript,
      editedTranscript: body.rawTranscript,
      level: body.level || "beginner",
      ...(body.segments && body.segments.length > 0
        ? {
            sentences: {
              create: body.segments
                .filter((segment) => segment.text && segment.text.trim().length > 0)
                .map((segment, index) => ({
                  text: segment.text.trim(),
                  level: body.level || "beginner",
                  segmentOrder: segment.segmentOrder ?? index + 1,
                  startSec:
                    typeof segment.startSec === "number" ? Number(segment.startSec.toFixed(2)) : null,
                  endSec:
                    typeof segment.endSec === "number" ? Number(segment.endSec.toFixed(2)) : null,
                })),
            },
          }
        : {}),
    },
    select: {
      id: true,
      title: true,
      level: true,
      editedTranscript: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ transcript }, { status: 201 });
}
