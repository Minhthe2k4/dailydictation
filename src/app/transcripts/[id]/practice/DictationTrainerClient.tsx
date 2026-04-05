"use client";
import { DictationTrainer } from "@/components/DictationTrainer";
import { PracticeProgress, PracticeSentence } from "@/types/practice";

export default function DictationTrainerClient({ transcriptId, sentences, initialProgress }: { transcriptId: string; sentences: PracticeSentence[]; initialProgress: PracticeProgress | null }) {
  return <DictationTrainer transcriptId={transcriptId} sentences={sentences} initialProgress={initialProgress} />;
}
