# LAO Intelligence Engine — Database Evolution

**Status**: Architecture Design  
**Version**: 1.0  
**Last Updated**: 2024-07-31

---

## Overview

The database schema must evolve to support:
- Millions of learners
- Thousands of missions
- Hundreds of thousands of mission completions
- Real-time progress tracking
- Complex querying (recommendations, analytics)

This document defines the schema structure and evolution strategy without implementing it.

---

## Core Tables (Normalized PostgreSQL)

### Learners

```sql
CREATE TABLE learners (
  id UUID PRIMARY KEY,
  email VARCHAR(254) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  
  -- Preferences
  learning_style VARCHAR(50),
  pace_preference VARCHAR(50),
  available_hours_per_week INTEGER,
  timezone VARCHAR(100),
  preferred_language VARCHAR(10),
  
  -- Profile
  onboarded_at TIMESTAMP NOT NULL,
  last_active_at TIMESTAMP,
  total_hours_learned NUMERIC(10, 2),
  completed_missions_count INTEGER,
  current_streak INTEGER,
  longest_streak INTEGER,
  
  -- Status
  state VARCHAR(50) NOT NULL,  -- active, paused, deactivated, etc.
  
  -- System
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  
  -- Indexes
  INDEX idx_learners_tenant_id (tenant_id),
  INDEX idx_learners_email (email),
  INDEX idx_learners_state (state),
  INDEX idx_learners_last_active_at (last_active_at)
);
```

### Goals

```sql
CREATE TABLE goals (
  id UUID PRIMARY KEY,
  learner_id UUID NOT NULL REFERENCES learners(id),
  
  -- Definition
  title VARCHAR(255) NOT NULL,
  description TEXT,
  goal_type VARCHAR(50) NOT NULL,  -- skill, certification, career, etc.
  category VARCHAR(100),
  
  -- SMART
  target_value INTEGER,
  target_unit VARCHAR(50),
  deadline TIMESTAMP,
  
  -- Status
  status VARCHAR(50) NOT NULL,  -- active, achieved, abandoned
  progress_percentage NUMERIC(5, 2),
  
  -- Priority
  priority INTEGER,  -- 1-5
  
  -- System
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  achieved_at TIMESTAMP,
  
  -- Indexes
  INDEX idx_goals_learner_id (learner_id),
  INDEX idx_goals_status (status),
  INDEX idx_goals_goal_type (goal_type),
  INDEX idx_goals_deadline (deadline)
);
```

### Missions

```sql
CREATE TABLE missions (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  objective TEXT,
  
  difficulty VARCHAR(50),  -- beginner, intermediate, advanced
  estimated_duration_hours NUMERIC(10, 2),
  
  -- Content
  content JSONB,  -- Lessons and structure stored as JSON
  
  -- Metadata
  popularity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  
  -- Indexes
  INDEX idx_missions_slug (slug),
  INDEX idx_missions_difficulty (difficulty),
  INDEX idx_missions_is_active (is_active)
);
```

### Mission Skills

```sql
CREATE TABLE mission_skills (
  id UUID PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES missions(id),
  skill_id UUID NOT NULL REFERENCES skills(id),
  skill_type VARCHAR(50),  -- teaches, requires
  
  UNIQUE(mission_id, skill_id, skill_type),
  
  INDEX idx_mission_skills_mission_id (mission_id),
  INDEX idx_mission_skills_skill_id (skill_id)
);
```

### Skills

```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(100),
  
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  
  INDEX idx_skills_slug (slug),
  INDEX idx_skills_category (category)
);
```

### Skill Prerequisites

```sql
CREATE TABLE skill_prerequisites (
  id UUID PRIMARY KEY,
  skill_id UUID NOT NULL REFERENCES skills(id),
  prerequisite_skill_id UUID NOT NULL REFERENCES skills(id),
  
  UNIQUE(skill_id, prerequisite_skill_id),
  
  INDEX idx_prerequisites_skill_id (skill_id)
);
```

### Learner Knowledge State

```sql
CREATE TABLE learner_knowledge_state (
  id UUID PRIMARY KEY,
  learner_id UUID NOT NULL REFERENCES learners(id) UNIQUE,
  
  -- Serialized competencies
  competencies JSONB,  -- { skillId: { level, confidence, lastAssessedAt } }
  
  -- Serialized gaps
  gaps JSONB,  -- [ { skillId, priority, detectedBy } ]
  
  -- Velocity
  avg_hours_per_mission NUMERIC(10, 2),
  avg_missions_per_week NUMERIC(10, 2),
  
  last_updated_at TIMESTAMP NOT NULL,
  
  INDEX idx_knowledge_learner_id (learner_id)
);
```

### Learning Paths

```sql
CREATE TABLE learning_paths (
  id UUID PRIMARY KEY,
  learner_id UUID NOT NULL REFERENCES learners(id),
  goal_id UUID NOT NULL REFERENCES goals(id),
  
  path_name VARCHAR(255),
  description TEXT,
  
  -- Missions in order
  missions_json JSONB,  -- [ { missionId, sequence, unlocked, completed } ]
  
  status VARCHAR(50),  -- active, completed, abandoned
  progress_percentage NUMERIC(5, 2),
  
  estimated_completion_date TIMESTAMP,
  efficiency NUMERIC(5, 2),  -- 0-100
  
  generated_at TIMESTAMP NOT NULL,
  regeneration_reason VARCHAR(255),
  
  INDEX idx_paths_learner_id (learner_id),
  INDEX idx_paths_goal_id (goal_id),
  INDEX idx_paths_status (status)
);
```

### Mission Progress

```sql
CREATE TABLE mission_progress (
  id UUID PRIMARY KEY,
  learner_id UUID NOT NULL REFERENCES learners(id),
  mission_id UUID NOT NULL REFERENCES missions(id),
  
  status VARCHAR(50),  -- not-started, in-progress, completed, abandoned
  lessons_completed INTEGER DEFAULT 0,
  lessons_total INTEGER,
  comprehension_score NUMERIC(5, 2),  -- 0-100
  time_spent_hours NUMERIC(10, 2),
  
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  UNIQUE(learner_id, mission_id),
  
  INDEX idx_mission_progress_learner_id (learner_id),
  INDEX idx_mission_progress_mission_id (mission_id),
  INDEX idx_mission_progress_status (status)
);
```

### Assessments

```sql
CREATE TABLE assessments (
  id UUID PRIMARY KEY,
  mission_id UUID NOT NULL REFERENCES missions(id),
  
  title VARCHAR(255) NOT NULL,
  assessment_type VARCHAR(50),  -- quiz, project, challenge
  objective TEXT,
  
  passing_score INTEGER,
  max_score INTEGER,
  
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  
  INDEX idx_assessments_mission_id (mission_id)
);
```

### Assessment Results

```sql
CREATE TABLE assessment_results (
  id UUID PRIMARY KEY,
  learner_id UUID NOT NULL REFERENCES learners(id),
  assessment_id UUID NOT NULL REFERENCES assessments(id),
  mission_id UUID NOT NULL REFERENCES missions(id),
  
  score INTEGER,
  passed BOOLEAN,
  completed_at TIMESTAMP NOT NULL,
  feedback TEXT,
  
  INDEX idx_results_learner_id (learner_id),
  INDEX idx_results_assessment_id (assessment_id),
  INDEX idx_results_completed_at (completed_at)
);
```

### Achievements

```sql
CREATE TABLE achievements (
  id UUID PRIMARY KEY,
  learner_id UUID NOT NULL REFERENCES learners(id),
  
  title VARCHAR(255) NOT NULL,
  achievement_type VARCHAR(50),  -- badge, certificate, milestone
  rarity_tier VARCHAR(50),  -- common, uncommon, rare, epic, legendary
  
  credits_awarded INTEGER,
  
  unlocked_at TIMESTAMP NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP NOT NULL,
  
  INDEX idx_achievements_learner_id (learner_id),
  INDEX idx_achievements_rarity_tier (rarity_tier)
);
```

### Events (Event Log)

```sql
CREATE TABLE domain_events (
  id UUID PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100),
  
  -- Causality
  caused_by_user_id UUID,
  action VARCHAR(100),
  
  -- Payload
  data JSONB NOT NULL,
  
  -- Tracking
  timestamp TIMESTAMP NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  correlation_id UUID,
  
  version INTEGER DEFAULT 1,
  
  INDEX idx_events_event_type (event_type),
  INDEX idx_events_aggregate_id (aggregate_id),
  INDEX idx_events_timestamp (timestamp),
  INDEX idx_events_tenant_id (tenant_id),
  INDEX idx_events_correlation_id (correlation_id)
);
```

---

## Caching Layer (Redis)

Not primary data, but working sets:

```
// Learner sessions
sessions:{learnerId} -> Serialized session
  TTL: 30 days

// Knowledge state (frequently queried)
knowledge:{learnerId} -> Serialized KnowledgeState
  TTL: 5 minutes (invalidated on CompetencyUpdated)

// Learning paths (frequently accessed)
path:{learnerPath Id} -> Serialized LearningPath
  TTL: 1 hour (invalidated on MissionCompleted)

// Achievement state (frequently checked)
achievements:{learnerId} -> List of achievement IDs
  TTL: 24 hours

// Feature flags
features:{tenantId}:{featureName} -> boolean
  TTL: 1 hour

// Recommendation cache
recommendations:{learnerId} -> [ RecommendedMission ]
  TTL: 6 hours (invalidated on significant events)
```

---

## Partitioning Strategy

For millions of learners, consider:

### 1. Time-Based Partitioning (Events)

```sql
-- Events table partitioned by month
CREATE TABLE domain_events_2024_07 PARTITION OF domain_events
  FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');

CREATE TABLE domain_events_2024_08 PARTITION OF domain_events
  FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');

-- Allows archival of old events to cold storage
```

### 2. Tenant Partitioning (Multi-Tenant)

```sql
-- If supporting multiple tenants, partition by tenant
CREATE TABLE learners_tenant_A PARTITION OF learners
  WHERE tenant_id = 'tenant-a';

CREATE TABLE learners_tenant_B PARTITION OF learners
  WHERE tenant_id = 'tenant-b';
```

### 3. Range Partitioning (Large Tables)

```sql
-- For very large tables, consider range partitioning
CREATE TABLE assessment_results_2024 PARTITION OF assessment_results
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

---

## Read Replicas

For high-read scenarios:

```
Primary DB (writes, transactions)
  ├─ Read Replica 1 (reporting queries)
  ├─ Read Replica 2 (recommendation engine)
  └─ Read Replica 3 (analytics)
```

Connection routing:
- Writes → Primary
- Strong consistency reads → Primary
- Eventual consistency reads → Replicas

---

## Analytics Data Warehouse

For analytics and reporting, separate warehouse:

```
OLTP (PostgreSQL) - Operational data
  ↓ (nightly batch)
OLAP (Data Warehouse) - Aggregated data
  ↓
Reports and dashboards
```

Schema design:
```sql
-- Fact table (learning events)
CREATE TABLE fact_learning_events (
  event_id UUID,
  learner_id UUID,
  mission_id UUID,
  timestamp DATE,
  
  hours_spent NUMERIC,
  score INTEGER,
  passed BOOLEAN,
  
  PRIMARY KEY (event_id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Dimension tables
CREATE TABLE dim_learners (
  learner_id UUID PRIMARY KEY,
  cohort VARCHAR(50),
  registration_date DATE,
  -- slowly changing dimension
);

CREATE TABLE dim_missions (
  mission_id UUID PRIMARY KEY,
  title VARCHAR(255),
  difficulty VARCHAR(50),
  category VARCHAR(100)
);
```

---

## Migration Strategy

As the schema evolves:

### Phase 1 (0-100k learners)
- Single database
- Basic indexes
- All data in one schema

### Phase 2 (100k-1M learners)
- Read replicas
- Partition events by month
- Archive old events to cold storage
- Separate analytics warehouse

### Phase 3 (1M-10M learners)
- Database sharding by learner_id
- Tenant-specific databases (if multi-tenant)
- Advanced caching strategy
- Event sourcing for audit trail

### Phase 4 (10M+ learners)
- Globally distributed databases
- CQRS (Command Query Responsibility Segregation)
- Event streaming (Kafka, etc.)
- Specialized stores (time-series for metrics, etc.)

---

## Backward Compatibility

Ensure schema changes don't break existing code:

```sql
-- Add new column with default
ALTER TABLE learners ADD COLUMN phone_number VARCHAR(20) DEFAULT NULL;

-- Drop column only after code stopped using it (2+ releases)
-- Use soft deletes where possible

-- Rename with function alias
ALTER TABLE goals RENAME COLUMN old_name TO new_name;
-- Also support old_name as computed column temporarily
```

---

## Testing

Database schema should be tested:

```typescript
describe('Database Schema', () => {
  it('should enforce learner email uniqueness', async () => {
    const learner1 = await db.learners.create({...});
    
    expect(async () => {
      await db.learners.create({ email: learner1.email, ... });
    }).rejects.toThrow();
  });
  
  it('should cascade delete on learner deletion', async () => {
    const learner = await db.learners.create({...});
    const goal = await db.goals.create({ learnerId: learner.id, ... });
    
    await db.learners.delete(learner.id);
    
    const deletedGoal = await db.goals.findById(goal.id);
    expect(deletedGoal).toBeNull();
  });
  
  it('should maintain referential integrity', async () => {
    expect(async () => {
      await db.goals.create({ learnerId: 'invalid-id', ... });
    }).rejects.toThrow();
  });
});
```

---

## Key Principles

1. **Normalize for flexibility, denormalize for performance**
   - Separate tables for relationships
   - JSONB columns for flexible structured data
   - Redis for working sets

2. **Events are first-class data**
   - Event log is the audit trail
   - Can rebuild state from events
   - Enables compliance and debugging

3. **Index strategically**
   - Index query paths, not all columns
   - Composite indexes for common queries
   - Monitor index usage

4. **Plan for scale**
   - Design assumes millions of learners
   - Partitioning strategy ready
   - Can split into shards later

5. **Maintain data quality**
   - Foreign key constraints
   - Check constraints for status enums
   - Timestamps for audit

---

**Next Document**: ENGINE_ARCHITECTURE.md  
**Status**: Ready for review
