"use client";
import { DictationTrainer } from "@/components/DictationTrainer";
type Sentence = {
  id: string;
  text: string;
  level: string;
};
type AttemptItem = {
  id: string;
  score: number;
  typedText: string;
  createdAt: string;
  sentence: {
    text: string;
    level: string;
  };
};
export default function DictationTrainerClient({ sentences, initialHistory }: { sentences: Sentence[]; initialHistory: AttemptItem[] }) {
  return <DictationTrainer sentences={sentences} initialHistory={initialHistory} />;
}