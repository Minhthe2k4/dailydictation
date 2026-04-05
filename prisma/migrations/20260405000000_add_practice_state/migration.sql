-- CreateTable
CREATE TABLE "PracticeState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "sentenceId" TEXT,
    "typedText" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PracticeState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeState_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeState_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "Sentence" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PracticeState_transcriptId_updatedAt_idx" ON "PracticeState"("transcriptId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeState_userId_transcriptId_key" ON "PracticeState"("userId", "transcriptId");