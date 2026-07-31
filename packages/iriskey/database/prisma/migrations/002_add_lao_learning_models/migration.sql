-- CreateTable LearnerGoal
CREATE TABLE "LearnerGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'active',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearnerGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateTable Mission
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problemArea" TEXT NOT NULL,
    "solutionType" TEXT NOT NULL,
    "solutionDescription" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "confidenceAtStart" REAL,
    "confidenceAtEnd" REAL,
    "timeSpent" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mission_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LearnerGoal" ("id") ON DELETE CASCADE,
    CONSTRAINT "Mission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateTable Asset
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "isInUseToday" BOOLEAN NOT NULL DEFAULT false,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE,
    CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateTable Portfolio
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemSolved" TEXT NOT NULL,
    "solutionCreated" TEXT NOT NULL,
    "reflection" TEXT,
    "confidenceGained" REAL,
    "timeSpentMinutes" INTEGER,
    "missionCompletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'in_daily_use',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Portfolio_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE CASCADE,
    CONSTRAINT "Portfolio_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LearnerGoal" ("id") ON DELETE CASCADE,
    CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateTable LearnerState
CREATE TABLE "LearnerState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "overallConfidence" REAL NOT NULL DEFAULT 0.5,
    "problemsSolved" INTEGER NOT NULL DEFAULT 0,
    "predictedReturnDate" DATETIME,
    "graphMasteryLevel" INTEGER,
    "graphConfidence" REAL,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearnerState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

-- CreateTable CoachConversation
CREATE TABLE "CoachConversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "messages" TEXT NOT NULL DEFAULT '[]',
    "problem" TEXT,
    "exploration" TEXT,
    "recommendedSolution" TEXT,
    "buildingPhase" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex LearnerGoal
CREATE INDEX "LearnerGoal_userId_idx" ON "LearnerGoal"("userId");
CREATE INDEX "LearnerGoal_status_idx" ON "LearnerGoal"("status");
CREATE INDEX "LearnerGoal_createdAt_idx" ON "LearnerGoal"("createdAt");

-- CreateIndex Mission
CREATE INDEX "Mission_goalId_idx" ON "Mission"("goalId");
CREATE INDEX "Mission_userId_idx" ON "Mission"("userId");
CREATE INDEX "Mission_status_idx" ON "Mission"("status");
CREATE INDEX "Mission_completedAt_idx" ON "Mission"("completedAt");

-- CreateIndex Asset
CREATE INDEX "Asset_missionId_idx" ON "Asset"("missionId");
CREATE INDEX "Asset_userId_idx" ON "Asset"("userId");
CREATE INDEX "Asset_type_idx" ON "Asset"("type");

-- CreateIndex Portfolio
CREATE INDEX "Portfolio_goalId_idx" ON "Portfolio"("goalId");
CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");
CREATE INDEX "Portfolio_missionCompletedAt_idx" ON "Portfolio"("missionCompletedAt");

-- CreateIndex LearnerState
CREATE UNIQUE INDEX "LearnerState_userId_key" ON "LearnerState"("userId");

-- CreateIndex CoachConversation
CREATE INDEX "CoachConversation_userId_idx" ON "CoachConversation"("userId");
CREATE INDEX "CoachConversation_missionId_idx" ON "CoachConversation"("missionId");
CREATE INDEX "CoachConversation_expiresAt_idx" ON "CoachConversation"("expiresAt");

-- CreateIndex Portfolio unique on missionId
CREATE UNIQUE INDEX "Portfolio_missionId_key" ON "Portfolio"("missionId");
