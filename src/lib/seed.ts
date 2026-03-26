import { prisma } from "@/lib/prisma";

const INITIAL_SENTENCES = [
  { text: "안녕하세요. 오늘 날씨가 정말 좋네요.", level: "beginner" },
  { text: "저는 한국어 듣기 연습을 매일 하고 있어요.", level: "beginner" },
  { text: "지하철에서 내리기 전에 가방을 꼭 챙기세요.", level: "intermediate" },
  { text: "주말에는 친구들과 한강에서 자전거를 탑니다.", level: "intermediate" },
  { text: "발표를 준비하면서 자료를 체계적으로 정리했습니다.", level: "advanced" },
];

export async function ensureSeedSentences() {
  const count = await prisma.sentence.count();

  if (count === 0) {
    await prisma.sentence.createMany({
      data: INITIAL_SENTENCES,
    });
  }
}
