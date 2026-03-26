"use client";
import PracticeTranscriptClient from "./PracticeTranscriptClient";
export default function PracticeClientWrapper({ id }: { id: string }) {
  return <PracticeTranscriptClient id={id} />;
}
