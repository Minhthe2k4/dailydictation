import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// PATCH /api/sentences/bookmark
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { sentenceId?: string; bookmarked?: boolean };
  if (!body.sentenceId || typeof body.bookmarked !== "boolean") {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const sentence = await prisma.sentence.findUnique({
    where: { id: body.sentenceId },
    select: { id: true },
  });
  if (!sentence) {
    return NextResponse.json({ message: "Sentence not found" }, { status: 404 });
  }

  const updated = await prisma.sentence.update({
    where: { id: body.sentenceId },
    data: { bookmarked: body.bookmarked },
    select: { id: true, bookmarked: true },
  });

  return NextResponse.json({ sentence: updated });
}
