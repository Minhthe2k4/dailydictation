import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureSeedSentences } from "@/lib/seed";

export async function GET() {
  await ensureSeedSentences();

  const sentences = await prisma.sentence.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      text: true,
      level: true,
    },
  });

  return NextResponse.json({ sentences });
}
