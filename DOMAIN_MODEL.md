# LAO Intelligence Engine — Domain Model

**Status**: Architecture Design  
**Version**: 1.0  
**Last Updated**: 2024-07-31

---

## Overview

The LAO Intelligence Engine models an adaptive learning system where learners progress toward goals through intelligently sequenced missions. The domain is driven by learner state, not content structure.

The engine answers:
- **Who** is the learner? (Profile, preferences, constraints)
- **What** do they want? (Goals, aspirations, objectives)
- **What** do they know? (Knowledge state, skills, gaps)
- **What's next?** (Recommended mission, lesson, challenge)
- **How** are they progressing? (Velocity, achievements, milestones)

---

## Core Domain Objects

### 1. Learner

**Purpose**: Represents a user in the learning system.

**Attributes**
```typescript
interface Learner {
  // Identity
  id: UUID;
  email: string;
  name: string;
  
  // Preferences
  preferences: LearnerPreferences {
    learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
    pacePreference: 'slow' | 'normal' | 'fast';
    availableHoursPerWeek: number;
    preferredLanguage: string;
    timezone: string;
  }
  
  // Profile
  profile: LearnerProfile {
    onboardedAt: DateTime;
    lastActiveAt: DateTime;
    totalHoursLearned: number;
    completedMissionsCount: number;
    currentStreak: number;
    longestStreak: number;
  }
  
  // Relationships
  goals: Goal[];
  currentLearningPath: LearningPath | null;
  completedMissions: Mission[];
  achievements: Achievement[];
  knowledgeState: KnowledgeState;
  
  // Metadata
  tenant: TenantId;
  createdAt: DateTime;
  updatedAt: DateTime;
}

interface LearnerPreferences {
  learningStyle: LearnerStyle;
  pacePreference: PacePreference;
  availableHoursPerWeek: number;
  preferredLanguage: string;
  timezone: string;
  topicsOfInterest: string[];
  careersOfInterest: string[];
}
```

**Responsibilities**
- Store learner identity and preferences
- Maintain learner state over time
- Track learner activity
- Reference learner's goals, paths, achievements

---

### 2. Goal

**Purpose**: Represents what a learner wants to achieve.

**Attributes**
```typescript
interface Goal {
  // Identity
  id: UUID;
  learnerId: UUID;
  
  // Definition
  title: string;
  description: string;
  goalType: 'skill' | 'certification' | 'career' | 'personal' | 'academic';
  category: string; // e.g., 'machine-learning', 'web-development', 'business-analytics'
  
  // SMART Goal attributes
  targetValue: number; // e.g., "build 3 projects"
  targetUnit: string; // e.g., "projects", "certifications", "hours"
  deadline: DateTime | null;
  
  // Status
  status: 'active' | 'paused' | 'achieved' | 'abandoned';
  progressPercentage: number; // 0-100
  
  // Relationships
  requiredSkills: Skill[];
  relatedMissions: Mission[];
  associatedLearningPaths: LearningPath[];
  
  // Metadata
  priority: number; // 1-5, higher is more important
  createdAt: DateTime;
  updatedAt: DateTime;
  achievedAt: DateTime | null;
}
```

**Responsibilities**
- Define what learner is trying to achieve
- Track goal progress
- Determine which missions are relevant
- Drive recommendation engine

---

### 3. KnowledgeState

**Purpose**: Represents what a learner knows at any point in time.

**Attributes**
```typescript
interface KnowledgeState {
  // Identity
  id: UUID;
  learnerId: UUID;
  
  // Competencies (rated 0-100)
  competencies: Map<SkillId, Competency> {
    skillId: {
      skillName: string;
      level: 0-100; // 0 = no knowledge, 100 = expert
      confidence: 0-100; // System's confidence in this assessment
      lastAssessedAt: DateTime;
      assessmentMethod: 'quiz' | 'project' | 'ai-evaluation' | 'self-report' | 'inference';
    }
  }
  
  // Knowledge gaps (skills needed but not yet learned)
  gaps: KnowledgeGap[] {
    skillId: UUID;
    priority: number; // 1-10
    detectedBy: 'goal-analysis' | 'mission-requirement' | 'ai-evaluation';
  }
  
  // Learning velocity (how fast they learn)
  velocity: {
    avgHoursPerMission: number;
    avgMissionsPerWeek: number;
    speedFactor: number; // 0.5 = slow, 1.0 = normal, 2.0 = fast
  }
  
  // Metadata
  lastUpdatedAt: DateTime;
  lastAssessmentAt: DateTime;
}

interface Competency {
  skillId: UUID;
  skillName: string;
  level: number; // 0-100
  confidence: number; // 0-100
  lastAssessedAt: DateTime;
  assessmentMethod: 'quiz' | 'project' | 'ai-evaluation' | 'self-report' | 'inference';
}

interface KnowledgeGap {
  skillId: UUID;
  skillName: string;
  priority: number; // 1-10
  detectedBy: string;
  detectedAt: DateTime;
}
```

**Responsibilities**
- Maintain learner's competency state
- Identify knowledge gaps
- Calculate learning velocity
- Inform recommendations

---

### 4. Skill

**Purpose**: Represents a learnable ability or knowledge area.

**Attributes**
```typescript
interface Skill {
  // Identity
  id: UUID;
  name: string;
  slug: string; // e.g., 'python-basics'
  
  // Description
  description: string;
  category: string; // e.g., 'programming', 'data-science', 'business'
  
  // Prerequisites and relationships
  prerequisites: Skill[]; // Skills needed before learning this
  relatedSkills: Skill[]; // Skills that pair well with this
  advancedSkills: Skill[]; // Skills that build on this
  
  // Proficiency levels
  levels: SkillLevel[] {
    level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    description: string;
    requiredCompetency: number; // 0-100 on knowledge scale
    missions: Mission[];
  }
  
  // Metadata
  createdAt: DateTime;
  updatedAt: DateTime;
  isActive: boolean;
}
```

**Responsibilities**
- Define learnable competencies
- Establish prerequisite relationships
- Map proficiency levels
- Support knowledge gap analysis

---

### 5. LearningPath

**Purpose**: Represents the optimal sequence of missions for a learner to achieve goals.

**Attributes**
```typescript
interface LearningPath {
  // Identity
  id: UUID;
  learnerId: UUID;
  
  // Definition
  pathName: string;
  description: string;
  primaryGoal: Goal;
  relatedGoals: Goal[];
  
  // Composition
  missions: PathMission[] {
    mission: Mission;
    sequence: number;
    isUnlocked: boolean;
    isStarted: boolean;
    isCompleted: boolean;
    startedAt: DateTime | null;
    completedAt: DateTime | null;
    estimatedDurationHours: number;
    prerequisitesMetAt: DateTime | null;
  }
  
  // Status
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  progressPercentage: number; // 0-100
  estimatedCompletionDate: DateTime;
  
  // Quality metrics
  efficiency: number; // 0-100, how optimally path is sequenced
  
  // Metadata
  generatedAt: DateTime;
  lastReorderedAt: DateTime | null;
  regenerationReason: string | null; // Why path was regenerated
}
```

**Responsibilities**
- Represent personalized learning sequence
- Track mission progression
- Determine next available mission
- Support dynamic reordering based on new information

---

### 6. Mission

**Purpose**: Represents a unit of learning work that teaches specific skills.

**Attributes**
```typescript
interface Mission {
  // Identity
  id: UUID;
  title: string;
  slug: string;
  
  // Content
  description: string;
  objective: string; // What learner will be able to do
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimatedDurationHours: number;
  
  // Skills and goals
  teachesSkills: Skill[];
  requiresSkills: Skill[]; // Prerequisites
  supportsGoals: Goal[];
  
  // Structure
  lessons: Lesson[];
  finalProject: Project | null;
  
  // Unlock criteria
  unlockCriteria: UnlockCriteria {
    prerequisiteMissions: Mission[];
    requiredSkillLevels: Map<SkillId, MinimumLevel>;
    minimumKnowledgeState: KnowledgeRequirement;
  }
  
  // Content
  resources: Resource[];
  assessments: Assessment[];
  
  // Metadata
  createdAt: DateTime;
  updatedAt: DateTime;
  isActive: boolean;
  popularity: number; // 0-100 based on completions
}
```

**Responsibilities**
- Define learnable unit
- Contain lessons and assessments
- Track unlock criteria
- Support adaptive recommendation

---

### 7. Lesson

**Purpose**: Represents atomic learning content within a mission.

**Attributes**
```typescript
interface Lesson {
  // Identity
  id: UUID;
  missionId: UUID;
  title: string;
  sequence: number;
  
  // Content
  description: string;
  contentType: 'video' | 'text' | 'interactive' | 'exercise' | 'project' | 'quiz';
  content: ContentPayload; // Varies by type
  estimatedDurationMinutes: number;
  
  // Learning
  objectiveStatement: string; // What learner will learn
  concepts: string[]; // Key concepts covered
  
  // Assessment
  assessment: Assessment | null;
  
  // Metadata
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

**Responsibilities**
- Represent smallest unit of content
- Support different content types
- Include embedded assessments

---

### 8. Achievement

**Purpose**: Represents recognition of learner accomplishments.

**Attributes**
```typescript
interface Achievement {
  // Identity
  id: UUID;
  learnerId: UUID;
  
  // Definition
  achievementType: 'badge' | 'certificate' | 'milestone' | 'streak' | 'award';
  title: string;
  description: string;
  icon: string; // URL or identifier
  
  // Unlock criteria
  unlockedBy: AchievementCriteria {
    missionCompletion: Mission | null;
    goalAchievement: Goal | null;
    skillMastery: {skill: Skill; level: number} | null;
    consecutiveDaysLearning: number | null;
    custom: CustomCriteria;
  }
  
  // Rarity
  rarityTier: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  percentOfLearnersWithAchievement: number; // 0-100
  
  // Rewards
  creditsAwarded: number;
  
  // Status
  unlockedAt: DateTime;
  isPublic: boolean; // Can be shared
  
  // Metadata
  createdAt: DateTime;
}
```

**Responsibilities**
- Represent accomplishments
- Track achievement criteria
- Award credits and recognition

---

### 9. Progress

**Purpose**: Tracks measurable advancement through learning journey.

**Attributes**
```typescript
interface Progress {
  // Identity
  id: UUID;
  learnerId: UUID;
  
  // Mission progress
  missionProgress: MissionProgress[] {
    mission: Mission;
    status: 'not-started' | 'in-progress' | 'completed' | 'abandoned';
    lessonsCompleted: number;
    lessonsTotal: number;
    comprehensionScore: number; // 0-100 from assessments
    timeSpentHours: number;
    startedAt: DateTime | null;
    completedAt: DateTime | null;
  }
  
  // Goal progress
  goalProgress: GoalProgress[] {
    goal: Goal;
    progressPercentage: number; // 0-100
    missionsContributing: Mission[];
    estimatedDaysToCompletion: number;
  }
  
  // Overall metrics
  totalHoursLearned: number;
  totalMissionsCompleted: number;
  currentStreak: number; // Consecutive days learning
  averageMissionsPerWeek: number;
  
  // Metadata
  calculatedAt: DateTime;
}
```

**Responsibilities**
- Track progress across missions
- Calculate goal advancement
- Measure learning velocity

---

### 10. Assessment

**Purpose**: Evaluates learner understanding and skills.

**Attributes**
```typescript
interface Assessment {
  // Identity
  id: UUID;
  lessonId: UUID;
  missionId: UUID;
  
  // Definition
  assessmentType: 'quiz' | 'project' | 'challenge' | 'peer-review' | 'ai-evaluation';
  title: string;
  objective: string;
  skillsAssessed: Skill[];
  
  // Scoring
  passingScore: number; // 0-100
  maxScore: number; // 0-100
  
  // Questions/Items
  items: AssessmentItem[];
  
  // Results
  results: AssessmentResult[];
  
  // Metadata
  createdAt: DateTime;
  updatedAt: DateTime;
}

interface AssessmentResult {
  id: UUID;
  learnerId: UUID;
  assessmentId: UUID;
  score: number; // 0-100
  passed: boolean;
  completedAt: DateTime;
  feedback: string;
}
```

**Responsibilities**
- Evaluate learner understanding
- Measure skill competency
- Inform recommendation engine

---

## Domain Relationships

### Dependency Graph

```
Learner
  ├── has many Goals
  ├── has KnowledgeState
  ├── has LearningPath
  │   └── contains Missions (ordered)
  ├── completed Missions
  └── earned Achievements

Goal
  ├── requires Skills
  ├── mapped to Missions
  └── mapped to LearningPaths

Mission
  ├── teaches Skills
  ├── requires Skills (prerequisites)
  ├── contains Lessons
  │   └── has Assessment
  ├── has Assessment
  └── unlock criteria (other Missions, Skill levels)

Skill
  ├── has prerequisites Skills
  ├── has related Skills
  ├── taught by Missions
  └── measured by Assessments

KnowledgeState
  ├── tracks Competencies for Skills
  └── identifies Gaps

Achievement
  └── earned by completing Missions or Goals
```

---

## Cardinality

| Relationship | Cardinality | Notes |
|---|---|---|
| Learner → Goals | 1..N | A learner has multiple goals |
| Learner → LearningPaths | 1..N | Multiple active paths possible |
| Learner → Missions (completed) | 1..N | Many missions completed |
| Learner → Achievements | 1..N | Many achievements possible |
| Goal → Missions | 1..N | Goals mapped to many missions |
| LearningPath → Missions | 1..N | Path contains ordered missions |
| Mission → Lessons | 1..N | Mission composed of lessons |
| Mission → Skills (teaches) | 1..N | Mission teaches multiple skills |
| Mission → Skills (requires) | 0..N | Mission has prerequisites |
| Skill → Missions (teaches) | 1..N | Skill taught by many missions |
| Assessment → AssessmentResults | 1..N | Many attempts possible |

---

## Key Invariants

**Invariant 1: Unlock Criteria Must Be Satisfiable**
- If Mission A requires Mission B as prerequisite, Mission B must be accessible first

**Invariant 2: Goal-Mission Mapping Consistency**
- All missions in a LearningPath must contribute to the associated Goal

**Invariant 3: Skill Prerequisite Chain**
- No circular dependencies in skill prerequisites

**Invariant 4: Knowledge Consistency**
- A learner cannot complete a mission if prerequisites are not met (unless explicitly overridden)

**Invariant 5: Achievement Uniqueness**
- A learner receives an achievement only once

**Invariant 6: Progress Accuracy**
- Progress calculations must reflect actual completed assessments, not assumptions

---

## Evolution Notes

As LAO scales, this model will extend to support:
- **Cohorts**: Groups of learners with shared missions
- **Teams**: Collaborative learning
- **Personalization**: Deeper individual adaptation
- **Analytics**: Learning outcome tracking
- **Content Variants**: Multiple ways to learn same skill
- **Spaced Repetition**: Intelligent review scheduling
- **Microlearning**: 5-minute lessons
- **Mobile Offline**: Lesson caching and sync

This design supports these extensions without breaking the core model.

---

**Next Document**: EVENT_CATALOG.md  
**Status**: Ready for review
