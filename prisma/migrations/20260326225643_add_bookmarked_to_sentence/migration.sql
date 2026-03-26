-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sentence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "segmentOrder" INTEGER,
    "startSec" REAL,
    "endSec" REAL,
    "vietnameseMean" TEXT,
    "vocabularyNote" TEXT,
    "grammarNote" TEXT,
    "transcriptId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Sentence_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "Transcript" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Sentence" ("createdAt", "endSec", "grammarNote", "id", "level", "segmentOrder", "startSec", "text", "transcriptId", "vietnameseMean", "vocabularyNote") SELECT "createdAt", "endSec", "grammarNote", "id", "level", "segmentOrder", "startSec", "text", "transcriptId", "vietnameseMean", "vocabularyNote" FROM "Sentence";
DROP TABLE "Sentence";
ALTER TABLE "new_Sentence" RENAME TO "Sentence";
CREATE INDEX "Sentence_transcriptId_idx" ON "Sentence"("transcriptId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
