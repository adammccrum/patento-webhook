# Framework Registry

## Overview

The Framework Registry is a vendor-neutral integration layer that catalogues, validates, and manages external agent frameworks. It enables LAO AI OS to evaluate and optionally integrate external frameworks while maintaining the core security architecture: Alpha → Guardian → Sierra → Uniform → Agent SDK → Framework Adapter → External Framework → Provider.

## Key Design Principles

1. **Control Plane Preservation**: LAO AI OS remains the orchestration authority
2. **Security Layer Enforcement**: No framework bypasses Alpha, Guardian, Sierra, or Uniform
3. **Vendor Neutrality**: Framework integrations are pluggable and optional
4. **Execution Engine Model**: External frameworks are execution engines, not orchestrators
5. **Tamper-Evident**: All framework operations are audited and traceable

## Architecture

### Components

#### 1. FrameworkRegistry
Central repository for framework registrations and metadata.

```javascript
const registry = new FrameworkRegistry();

// Register framework
registry.register(adapter, {
  framework_id: 'langgraph',
  display_name: 'LangGraph',
  category: 'multi-agent',
  sierra_required: true,
  uniform_required: true
});

// Query frameworks
const framework = registry.get('langgraph');
const allFrameworks = registry.getAll();
const byCategory = registry.getByCategory('multi-agent');
const enabled = registry.getEnabled();

// Control
registry.enable('langgraph');
registry.disable('langgraph');
registry.unregister('langgraph');

// Health tracking
registry.updateHealth('langgraph', { status: 'healthy' });
const stats = registry.getStats();
```

#### 2. FrameworkPolicy
Policy-driven framework selection based on capabilities and constraints.

```javascript
const policy = new FrameworkPolicy(registry);

// Select framework by capability
const framework = policy.selectFramework('multi_agent', context, 'default');

// Multiple frameworks
const frameworks = policy.selectFrameworks('multi_agent', context, 'default', 5);

// Validate framework meets requirements
const result = policy.validateFramework('langgraph', context);

// Available capabilities
const capabilities = policy.getAvailableCapabilities();
const implementations = policy.getFrameworksByCapability('multi_agent');
```

**Built-in Policies:**

- **default**: Enable status and health required
- **high-security**: Requires Sierra, Uniform, and audit references
- **sandbox-only**: No filesystem or network access
- **streaming-required**: Streaming support mandatory

#### 3. FrameworkHealth
Health monitoring and availability tracking.

```javascript
const health = new FrameworkHealth(registry);

// Start monitoring
health.startMonitoring();

// Check single framework
const status = await health.checkFrameworkHealth('langgraph');

// Get health information
const currentHealth = health.getHealth('langgraph');
const systemHealth = health.getSystemHealth();
const unhealthy = health.getUnhealthyFrameworks();
const history = health.getHealthHistory('langgraph', 50);

// Stop monitoring
health.stopMonitoring();
```

#### 4. FrameworkManager
Central orchestrator managing registry, policy, health, and execution.

```javascript
const manager = new FrameworkManager();

// Lifecycle
await manager.start();
await manager.stop();

// Register frameworks
manager.registerFramework(nativeAdapter);
manager.registerFramework(langgraphAdapter);

// Query
const fw = manager.getFramework('langgraph');
const all = manager.getFrameworks();
const byCategory = manager.getFrameworksByCategory('multi-agent');
const enabled = manager.getEnabledFrameworks();

// Control
manager.enableFramework('langgraph');
manager.disableFramework('langgraph');

// Execute with capability requirement
const context = new FrameworkContext({
  execution_id: 'exec-123',
  framework_id: 'langgraph',
  sierra_reference: 'sierra-123',
  uniform_reference: 'uniform-123'
});

const result = await manager.execute('multi_agent', context, {
  policy: 'high-security'
});

// Execution management
const status = manager.getExecutionStatus('exec-123');
const active = manager.getActiveExecutions();
await manager.cancelExecution('exec-123');
manager.cleanupExecutions(86400000); // 24 hours old

// Statistics
const stats = manager.getStats();
```

#### 5. FrameworkBase
Abstract base class defining the adapter interface.

```javascript
class MyFrameworkAdapter extends FrameworkBase {
  constructor() {
    super({
      framework_id: 'my-framework',
      display_name: 'My Framework',
      version: '1.0.0'
    });
  }

  async initialize() {
    // Framework-specific initialization
  }

  getCapabilities() {
    return {
      multi_agent: true,
      tool_calling: true,
      rag: false,
      streaming: true,
      human_approval: false,
      browser: false,
      vision: false,
      voice: false,
      mcp: false,
      memory: true,
      workflow: true,
      database: false
    };
  }

  async healthCheck() {
    return { status: 'healthy', message: 'OK' };
  }

  supports(capability) {
    const caps = this.getCapabilities();
    return caps[capability] === true;
  }

  async execute(context) {
    // Framework execution logic
    const result = new FrameworkResult({
      execution_id: context.execution_id,
      framework_id: this.framework_id
    });
    result.complete({ output: 'result' });
    return result;
  }

  async cancel(execution_id) {
    // Cancel running execution
  }

  async cleanup() {
    // Clean up resources
  }
}
```

## Supported Frameworks

### Integrated (Verified)
- **native** - LAO AI OS native multi-agent orchestration (integrated, verified)

### Proposed (Placeholders)
- LangGraph - Multi-agent framework (Python)
- AutoGen - Multi-agent framework (Microsoft)
- CrewAI - Multi-agent orchestration
- PydanticAI - Agent framework
- Atomic Agents - Lightweight agents
- SmolAgents - Hugging Face agents
- Mastra - Workflow orchestration
- OpenHands - Autonomous software development
- Aider - AI-assisted coding
- Skyvern - Browser automation
- Agent-E - General-purpose agents
- GPT Researcher - Autonomous research
- n8n - Workflow automation
- Windmill - Workflow orchestration
- Activepieces - Workflow automation

## Security Requirements

### Mandatory Authorization Layers

Every framework execution must pass through:

1. **Alpha Orchestration**: Request validated by Alpha control plane
2. **Guardian Evaluation**: Security and policy checks
3. **Sierra Authorization**: User authorization and capability verification
4. **Uniform Governance**: Organization policy enforcement
5. **Framework Adapter**: Execution context provided to framework
6. **External Framework**: Execution engine
7. **Provider Registry**: AI provider integration

### Audit Trail

All framework operations are recorded with:
- execution_id: Unique execution identifier
- framework_id: Which framework executed
- correlation_id: Link to request chain
- guardian_reference: Guardian evaluation result
- sierra_reference: Authorization proof
- uniform_reference: Governance decision
- audit_reference: Audit log reference
- status: execution status
- errors/warnings: Any issues encountered

### Constraint Enforcement

Frameworks declare resource constraints:

```yaml
frameworks:
  langgraph:
    sierra_required: true          # Must have Sierra auth
    uniform_required: true         # Must have Uniform approval
    network_required: true         # Needs network access
    filesystem_required: false     # No filesystem access
    sandbox_support: false         # Cannot run in sandbox
    streaming_support: true        # Supports streaming
    human_approval_support: false  # Cannot request approval
    memory_model: stateful         # Maintains state
    guardian_requirements: []      # Specific guardians required
```

## Status Definitions

### Adapter Status
- **stub**: Placeholder, no implementation
- **development**: In progress
- **adapter_stub**: Basic wrapper created
- **complete**: Full adapter implementation
- **deprecated**: No longer maintained

### Implementation Status
- **proposed**: Catalogued but not evaluated
- **researched**: Evaluated for compatibility
- **verified**: Guardian-verified and compatible
- **integrated**: Active integration in production
- **disabled**: Intentionally disabled
- **rejected**: Does not meet requirements
- **deprecated**: No longer supported

### Health Status
- **healthy**: Framework is operational
- **degraded**: Framework operational with issues
- **unhealthy**: Framework not operational
- **unknown**: Health status not checked

## Configuration

Framework metadata is defined in `config/frameworks.yaml`:

```yaml
frameworks:
  - framework_id: langgraph
    display_name: LangGraph
    category: multi-agent-framework
    official_repository: https://github.com/langchain-ai/langgraph
    official_website: https://langchain-ai.github.io/langgraph/
    maintainer: LangChain AI
    licence: MIT
    language: Python
    runtime: Python 3.9+
    latest_verified_version: 0.0.0
    verification_date: null
    maintenance_status: active
    community_size: large
    adapter_status: stub
    implementation_status: proposed
    sierra_required: true
    uniform_required: true
    network_required: true
    filesystem_required: false
    sandbox_support: false
    streaming_support: true
    human_approval_support: false
    multi_agent_support: true
    mcp_support: false
    enabled: false
    notes: Placeholder - framework integration pending Guardian evaluation
```

## Error Handling

Framework operations throw specific errors:

```javascript
const {
  FrameworkNotFoundError,        // Framework not in registry
  FrameworkNotAvailableError,    // Framework unavailable
  FrameworkAdapterError,         // Adapter execution error
  SierraRequiredError,           // Missing Sierra authorization
  UniformRequiredError,          // Missing Uniform governance
  GuardianRequiredError,         // Guardian requirement unmet
  FrameworkVersionError,         // Version incompatibility
  FrameworkIncompatibleError     // Compatibility check failed
} = require('./frameworks/framework-errors');

try {
  await manager.executeFramework('unknown-fw', context);
} catch (err) {
  if (err instanceof FrameworkNotFoundError) {
    // Handle missing framework
  } else if (err instanceof SierraRequiredError) {
    // Handle missing authorization
  }
}
```

## Events

Framework operations emit events for observability:

```javascript
manager.onEvent = (event) => {
  // framework.registered
  // framework.enabled
  // framework.disabled
  // framework.unregistered
  // framework.health_changed
  // framework.manager.execution_started
  // framework.manager.execution_completed
  // framework.manager.execution_failed
  // framework.manager.execution_cancelled
  // framework.health.monitoring_started
  // framework.health.monitoring_stopped
  // framework.health.health_check_completed
  // framework.policy.policy_registered
};
```

## Testing

Framework adapters include comprehensive test suites:

- `framework-base.test.js` - Base class and interface tests
- `framework-registry.test.js` - Registration and querying tests
- `framework-manager.test.js` - Manager orchestration tests
- `framework-policy.test.js` - Policy selection tests
- `framework-health.test.js` - Health monitoring tests
- `framework-adapters.test.js` - Adapter implementations
- `framework-integration.test.js` - End-to-end integration

## Future Development

### Phase 5.6 Complete
- Framework registry foundation
- Policy-driven selection
- Health monitoring
- Manager orchestration
- 7 framework adapters

### Phase 5.7 (Future)
- Full LangGraph adapter implementation
- AutoGen adapter implementation
- CrewAI adapter implementation
- Framework capability auto-discovery
- Provider registry integration

### Phase 5.8 (Future)
- Production Guardian verification
- Framework performance benchmarking
- Provider cost tracking
- Framework capability scoring
- Smart policy optimization
