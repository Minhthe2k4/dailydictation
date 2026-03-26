"use client";
import DictationTrainerClient from "./DictationTrainerClient";
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
export default function DashboardClientWrapper({ sentences, initialHistory }: { sentences: Sentence[]; initialHistory: AttemptItem[] }) {
  return <DictationTrainerClient sentences={sentences} initialHistory={initialHistory} />;
}