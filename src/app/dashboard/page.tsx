import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import DashboardClientWrapper from "./DashboardClientWrapper";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureSeedSentences } from "@/lib/seed";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  await ensureSeedSentences();

  const [sentences, history] = await Promise.all([
    prisma.sentence.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        text: true,
        level: true,
      },
    }),
    prisma.attempt.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        score: true,
        typedText: true,
        createdAt: true,
        sentence: {
          select: {
            text: true,
            level: true,
          },
        },
      },
    }),
  ]);

  const serializedHistory = history.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#f6eee3_0%,#dff0ec_50%,#f9f8f4_100%)] px-6 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <h1 className="text-4xl font-black text-[#10252d]">Dashboard luyen nghe</h1>
        <p className="mt-2 text-sm text-[#35535e]">
          Xin chao {session.user.name ?? "ban"}, hay bat dau mot bai nghe moi.
        </p>

        <div className="mt-6">
          <DashboardClientWrapper sentences={sentences} initialHistory={serializedHistory} />
        </div>
      </div>
    </main>
  );
}
