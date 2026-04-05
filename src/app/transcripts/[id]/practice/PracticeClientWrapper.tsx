"use client";
import PracticeTranscriptClient from "./PracticeTranscriptClient";
import { PracticeProgress, PracticeTranscript } from "@/types/practice";

export default function PracticeClientWrapper({ transcript, initialProgress }: { transcript: PracticeTranscript; initialProgress: PracticeProgress | null }) {
  return <PracticeTranscriptClient transcript={transcript} initialProgress={initialProgress} />;
}
