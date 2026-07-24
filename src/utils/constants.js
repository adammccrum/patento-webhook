/**
 * System-wide constants
 */

// Agent states (9 required)
const AGENT_STATES = {
  IDLE: 'idle',
  ANALYSING: 'analysing',
  AWAITING_AUTHORISATION: 'awaiting_authorisation',
  QUEUED: 'queued',
  WORKING: 'working',
  COMPLETED: 'completed',
  BLOCKED: 'blocked',
  FAILED: 'failed',
  OFFLINE: 'offline'
};

// Provider health states
const PROVIDER_HEALTH = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
  UNKNOWN: 'unknown'
};

// Provider execution modes
const EXECUTION_MODES = {
  LOCAL: 'local',
  CLOUD: 'cloud',
  HYBRID: 'hybrid'
};

// Cost classifications
const COST_CLASSIFICATIONS = {
  FREE: 'free',
  FREEMIUM: 'freemium',
  USAGE_BASED: 'usage-based',
  SUBSCRIPTION: 'subscription',
  COMMERCIAL: 'commercial'
};

// Authorization levels
const AUTHORIZATION_LEVELS = {
  PUBLIC: 'public',
  AUTHENTICATED: 'authenticated',
  AUTHORIZED: 'authorized',
  ADMIN: 'admin'
};

// Audit event types
const AUDIT_EVENT_TYPES = {
  AGENT_CREATED: 'agent_created',
  AGENT_EXECUTED: 'agent_executed',
  AGENT_FAILED: 'agent_failed',
  PROVIDER_REGISTERED: 'provider_registered',
  PROVIDER_HEALTH_CHECK: 'provider_health_check',
  AUTHORIZATION_GRANTED: 'authorization_granted',
  AUTHORIZATION_DENIED: 'authorization_denied',
  COST_TRACKED: 'cost_tracked'
};

// NATO Phonetic Codes (26 agents)
const NATO_CODES = {
  AA: 'Alpha',    // Executive Orchestrator
  BB: 'Bravo',    // Software Engineering
  CC: 'Charlie',  // Research & Intelligence
  DD: 'Delta',    // Documents & Reports
  EE: 'Echo',     // Voice & Audio
  FF: 'Foxtrot',  // Image & Video Generation
  GG: 'Golf',     // Marketing & Social Media
  HH: 'Hotel',    // Website & Front-End
  II: 'India',    // Automation & Workflows
  JJ: 'Juliet',   // Customer Support
  KK: 'Kilo',     // Sales & CRM
  LL: 'Lima',     // Finance, Grants & Funding
  MM: 'Mike',     // Cybersecurity
  NN: 'November', // DevOps & Infrastructure
  OO: 'Oscar',    // Data & Analytics
  PP: 'Papa',     // Testing & Quality Assurance
  QQ: 'Quebec',   // Knowledge Base & Memory
  RR: 'Romeo',    // APIs & Integrations
  SS: 'Sierra',   // IrisKey Biometrics & Identity
  TT: 'Tango',    // LAO Academy Training
  UU: 'Uniform',  // Compliance & Governance
  VV: 'Victor',   // Computer Vision
  WW: 'Whiskey',  // Hardware & IoT
  XX: 'X-ray',    // Experimental Projects
  YY: 'Yankee',   // Communications
  ZZ: 'Zulu'      // Monitoring & System Health
};

// Provider categories
const PROVIDER_CATEGORIES = {
  VOICE: 'voice',
  MEDIA: 'media',
  AGENTS: 'agents',
  DOCUMENTS: 'documents',
  VISION: 'vision',
  DATABASE: 'database',
  LLM: 'llm',
  INFRASTRUCTURE: 'infrastructure'
};

module.exports = {
  AGENT_STATES,
  PROVIDER_HEALTH,
  EXECUTION_MODES,
  COST_CLASSIFICATIONS,
  AUTHORIZATION_LEVELS,
  AUDIT_EVENT_TYPES,
  NATO_CODES,
  PROVIDER_CATEGORIES
};
