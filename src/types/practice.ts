export type PracticeProgress = {
  sentenceId: string | null;
  typedText: string;
};

export type PracticeSentence = {
  id: string;
  text: string;
  level: string;
  segmentOrder?: number | null;
  startSec?: number | null;
  endSec?: number | null;
  vietnameseMean?: string | null;
  vocabularyNote?: string | null;
  grammarNote?: string | null;
  bookmarked?: boolean;
};

export type PracticeTranscript = {
  id: string;
  title: string;
  level: string;
  sourceUrl?: string | null;
  sentences: PracticeSentence[];
};