-- CreateTable AnalyticsEvent
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "AnalyticsEvent_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LearnerGoal" ("id") ON DELETE SET NULL
);

-- CreateTable SessionMetrics
CREATE TABLE "SessionMetrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "confidenceBefore" REAL,
    "confidenceAfter" REAL,
    "startedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "ttftMillis" INTEGER,
    "ttcMillis" INTEGER,
    "buildDurationMillis" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "assetCreated" BOOLEAN NOT NULL DEFAULT false,
    "reflectionSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "returnedWithin24h" BOOLEAN NOT NULL DEFAULT false,
    "returnedWithin7d" BOOLEAN NOT NULL DEFAULT false,
    "reflection" TEXT,
    "hasConfidenceLanguage" BOOLEAN NOT NULL DEFAULT false,
    "pauseCount" INTEGER NOT NULL DEFAULT 0,
    "abandonmentPoint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SessionMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "SessionMetrics_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "LearnerGoal" ("id") ON DELETE SET NULL
);

-- CreateIndex AnalyticsEvent
CREATE UNIQUE INDEX "SessionMetrics_sessionId_key" ON "SessionMetrics"("sessionId");
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");
CREATE INDEX "AnalyticsEvent_userId_idx" ON "AnalyticsEvent"("userId");
CREATE INDEX "AnalyticsEvent_eventType_idx" ON "AnalyticsEvent"("eventType");
CREATE INDEX "AnalyticsEvent_goalId_idx" ON "AnalyticsEvent"("goalId");
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

-- CreateIndex SessionMetrics
CREATE INDEX "SessionMetrics_userId_idx" ON "SessionMetrics"("userId");
CREATE INDEX "SessionMetrics_completedAt_idx" ON "SessionMetrics"("completedAt");
CREATE INDEX "SessionMetrics_ttftMillis_idx" ON "SessionMetrics"("ttftMillis");
