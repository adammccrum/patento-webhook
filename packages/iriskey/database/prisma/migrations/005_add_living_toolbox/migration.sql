-- Living Toolbox: solutions become durable objects with versions and usage history.

-- CreateTable
CREATE TABLE "Solution" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "problemArea" TEXT NOT NULL DEFAULT 'General',
    "content" TEXT NOT NULL,
    "notes" TEXT,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "timeSavedMinutes" INTEGER NOT NULL DEFAULT 0,
    "totalTimeSavedMinutes" INTEGER NOT NULL DEFAULT 0,
    "originMissionId" TEXT,
    "originCourseId" TEXT,
    "shareId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionVersion" (
    "id" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolutionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolutionRun" (
    "id" TEXT NOT NULL,
    "solutionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "timeSavedMinutes" INTEGER,
    "note" TEXT,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolutionRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Solution_shareId_key" ON "Solution"("shareId");
CREATE INDEX "Solution_userId_idx" ON "Solution"("userId");
CREATE INDEX "Solution_userId_status_idx" ON "Solution"("userId", "status");
CREATE INDEX "Solution_lastUsedAt_idx" ON "Solution"("lastUsedAt");
CREATE INDEX "Solution_originMissionId_idx" ON "Solution"("originMissionId");

-- CreateIndex
CREATE UNIQUE INDEX "SolutionVersion_solutionId_version_key" ON "SolutionVersion"("solutionId", "version");
CREATE INDEX "SolutionVersion_solutionId_idx" ON "SolutionVersion"("solutionId");

-- CreateIndex
CREATE INDEX "SolutionRun_solutionId_idx" ON "SolutionRun"("solutionId");
CREATE INDEX "SolutionRun_ranAt_idx" ON "SolutionRun"("ranAt");

-- AddForeignKey
ALTER TABLE "Solution" ADD CONSTRAINT "Solution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionVersion" ADD CONSTRAINT "SolutionVersion_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "Solution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolutionRun" ADD CONSTRAINT "SolutionRun_solutionId_fkey" FOREIGN KEY ("solutionId") REFERENCES "Solution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
