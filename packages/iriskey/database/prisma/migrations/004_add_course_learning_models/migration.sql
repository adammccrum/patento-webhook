-- CreateTable Course
CREATE TABLE "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable Mission
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "problemArea" TEXT NOT NULL,
    "toolkitName" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "coachPrompt" TEXT NOT NULL,
    "buildTemplate" TEXT,
    "reflectionPrompt" TEXT NOT NULL,
    "successCriteria" TEXT,
    "achievement" TEXT NOT NULL,
    "timeSavedMinutes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Mission_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE
);

-- CreateTable CourseEnrollment
CREATE TABLE "CourseEnrollment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "currentMissionPosition" INTEGER NOT NULL DEFAULT 0,
    "missionsCompleted" INTEGER NOT NULL DEFAULT 0,
    "toolkitItems" TEXT NOT NULL DEFAULT '[]',
    "confidenceStart" REAL,
    "confidenceEnd" REAL,
    "enrolledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAccessedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "CourseEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
    CONSTRAINT "CourseEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE
);

-- CreateIndex Course
CREATE INDEX "Course_status_idx" ON "Course"("status");

-- CreateIndex Mission
CREATE INDEX "Mission_courseId_idx" ON "Mission"("courseId");
CREATE INDEX "Mission_position_idx" ON "Mission"("position");

-- CreateIndex CourseEnrollment
CREATE UNIQUE INDEX "CourseEnrollment_userId_courseId_key" ON "CourseEnrollment"("userId", "courseId");
CREATE INDEX "CourseEnrollment_userId_idx" ON "CourseEnrollment"("userId");
CREATE INDEX "CourseEnrollment_courseId_idx" ON "CourseEnrollment"("courseId");
CREATE INDEX "CourseEnrollment_completedAt_idx" ON "CourseEnrollment"("completedAt");
