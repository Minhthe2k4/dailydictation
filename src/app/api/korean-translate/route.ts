import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { lookupKoreanMeaning } from "@/lib/korean-translate";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { text?: string };
  if (!body.text || !body.text.trim()) {
    return NextResponse.json({ message: "text required" }, { status: 400 });
  }

  return NextResponse.json({
    text: body.text.trim(),
    meaning: lookupKoreanMeaning(body.text),
  });
}
