import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { translateKoreanText } from "@/lib/korean-translate";

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

  const vietnamese = translateKoreanToVietnamese(sentence.text);

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
