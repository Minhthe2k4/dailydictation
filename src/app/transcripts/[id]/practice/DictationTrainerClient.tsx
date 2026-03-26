"use client";
import { DictationTrainer } from "@/components/DictationTrainer";
type Sentence = {
  id: string;
  text: string;
  level: string;
  vietnameseMean?: string;
  vocabularyNote?: string;
  grammarNote?: string;
};
export default function DictationTrainerClient({ sentences }: { sentences: Sentence[] }) {
  return <DictationTrainer sentences={sentences} />;
}
