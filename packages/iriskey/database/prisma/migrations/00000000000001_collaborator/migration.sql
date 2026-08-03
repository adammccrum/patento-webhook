-- AlterTable
ALTER TABLE "Solution" ADD COLUMN     "lastOpenedAt" TIMESTAMP(3),
ADD COLUMN     "openCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SolutionConversation" (
    "id" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolutionConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "proposedContent" TEXT,
    "acceptedVersion" INTEGER,
    "servedByModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolutionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SolutionConversation_solutionId_key" ON "SolutionConversation"("solutionId");

-- CreateIndex
CREATE INDEX "SolutionConversation_solutionId_idx" ON "SolutionConversation"("solutionId");

-- CreateIndex
CREATE INDEX "SolutionMessage_conversationId_idx" ON "SolutionMessage"("conversationId");

-- CreateIndex
CREATE INDEX "SolutionMessage_createdAt_idx" ON "SolutionMessage"("createdAt");

-- AddForeignKey
ALTER TABLE "SolutionConversation" ADD CONSTRAINT "SolutionConversation_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "Solution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionMessage" ADD CONSTRAINT "SolutionMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SolutionConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

