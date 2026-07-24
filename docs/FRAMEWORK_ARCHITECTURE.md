# Framework Architecture

## Overview

The Framework Architecture defines how LAO AI OS integrates external agent frameworks while maintaining absolute control over the orchestration layer. External frameworks are execution engines that operate beneath the complete security and governance stack.

## Control Plane Stack

```
┌─────────────────────────────────────────────┐
│ Alpha Orchestration (Control Plane)         │ ← User request initiates
├─────────────────────────────────────────────┤
│ Guardian Framework (Security Evaluation)    │ ← Security policy check
├─────────────────────────────────────────────┤
│ Sierra Authorization (User Authorization)   │ ← User capability check
├─────────────────────────────────────────────┤
│ Uniform Governance (Organization Policy)    │ ← Org policy enforcement
├─────────────────────────────────────────────┤
│ Agent SDK (Capability Routing)               │ ← Route to framework
├─────────────────────────────────────────────┤
│ Framework Adapter (Thin Wrapper)            │ ← Execution context
├─────────────────────────────────────────────┤
│ External Framework (Execution Engine)       │ ← Do the work
├─────────────────────────────────────────────┤
│ Provider (AI Model / Service)               │ ← Final execution
└─────────────────────────────────────────────┘
```

**Key Principle**: Every request passes through all layers. No layer can bypass upper layers.

## Framework Adapter Pattern

Adapters provide thin wrappers around external frameworks. They:

1. **Do NOT** duplicate core functionality (Alpha, Guardian, Sierra, Uniform)
2. **Do** translate LAO context to framework context
3. **Do** wrap execution results in FrameworkResult
4. **Do** enforce timeout and resource constraints
5. **Do** capture metrics and errors for audit

```javascript
class FrameworkAdapter extends FrameworkBase {
  // Translate LAO context to framework context
  async execute(context) {
    // 1. Validate context
    // 2. Create safe context
    const safeContext = this.createSafeContext(context);
    
    // 3. Execute framework
    const frameworkResult = await this._callFramework(safeContext);
    
    // 4. Transform result
    const result = new FrameworkResult({
      execution_id: context.execution_id,
      framework_id: this.framework_id,
      result: frameworkResult
    });
    
    // 5. Record metrics
    this.recordMetrics(result, {
      tokens_used: frameworkResult.tokens,
      duration_ms: frameworkResult.duration
    });
    
    return result;
  }
}
```

## Framework Lifecycle

```
┌─────────────────┐
│    Registered   │  ← Framework catalogued
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Discovered    │  ← Framework found in registry
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Enabled      │  ← Framework activated
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Initialized   │  ← Framework setup complete
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Available    │  ← Ready for selection
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Executing     │  ← Running user request
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Completed     │  ← Execution finished
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Monitored     │  ← Health checks ongoing
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Disabled      │  ← Deactivated when needed
└─────────────────┘
```

## Policy-Driven Selection

The Framework Policy engine selects which framework to use based on:

1. **Capability Requirements**: Does framework support needed capability?
2. **Security Requirements**: Does framework meet Sierra/Uniform/Guardian?
3. **Resource Constraints**: Can framework handle timeout/memory/tokens?
4. **Availability**: Is framework healthy and enabled?
5. **Policy Rules**: Does it match the selected policy?

```javascript
// Example: Select LangGraph for multi-agent capability under high-security policy
const context = new FrameworkContext({
  execution_id: 'exec-123',
  sierra_reference: 'sierra-abc',
  uniform_reference: 'uniform-xyz',
  guardian_reference: 'guardian-def'
});

const selectedFramework = policy.selectFramework(
  'multi_agent',    // capability needed
  context,          // security context
  'high-security'   // policy to enforce
);

// Result: LangGraph adapter if it's:
// - Enabled
// - Healthy
// - Supports multi_agent
// - Has sierra_required satisfied
// - Has uniform_required satisfied
```

## Health Monitoring

Health monitoring is continuous and event-driven:

```javascript
// Start monitoring
health.startMonitoring();

// Periodic checks every 60 seconds by default
// For each framework:
//   1. Call adapter.healthCheck()
//   2. Record result in history
//   3. Update registry health_status
//   4. Emit event
//   5. If unhealthy for N consecutive times, emit alert

// Stop monitoring
health.stopMonitoring();
```

Health metrics:

- **healthy**: Framework responding normally
- **degraded**: Intermittent issues, still functional
- **unhealthy**: Repeated failures, marked unavailable
- **unknown**: Health check not yet performed

## Execution Context

FrameworkContext carries all information needed for execution:

```javascript
const context = new FrameworkContext({
  // Identifiers
  execution_id: 'exec-123',
  correlation_id: 'corr-456',
  session_id: 'sess-789',
  
  // Framework routing
  framework_id: 'langgraph',
  capability: 'multi_agent',
  
  // Security references (MANDATORY)
  guardian_reference: 'guardian-abc123',
  sierra_reference: 'sierra-def456',
  uniform_reference: 'uniform-ghi789',
  audit_reference: 'audit-jkl012',
  
  // Resource limits
  timeout_ms: 300000,
  max_tokens: 10000,
  memory_limit_mb: 512,
  
  // Execution parameters
  objective_description: 'Coordinate multi-agent task',
  tool_references: ['tool-1', 'tool-2'],
  
  // Metadata
  privacy_classification: 'internal',
  risk_classification: 'high',
  metadata: { custom_field: 'value' }
});
```

## Execution Result

FrameworkResult captures complete execution information:

```javascript
const result = new FrameworkResult({
  execution_id: 'exec-123',
  framework_id: 'langgraph',
  status: 'completed', // pending, running, completed, failed, cancelled, timeout
  success: true
});

// Populate with execution data
result.complete({ output: 'agent response' });

// Or record error
result.fail(new Error('Execution failed'));

// Record tool calls
result.recordToolCall({
  tool_name: 'search',
  input: { query: 'climate change' },
  output: 'Results...'
});

// Record provider calls
result.recordProviderCall({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet',
  tokens_used: 1500,
  cost: 0.0045
});

// Result contains audit trail
{
  execution_id: 'exec-123',
  framework_id: 'langgraph',
  status: 'completed',
  success: true,
  result: { output: 'response' },
  duration_ms: 5234,
  tokens_used: 1500,
  cost: 0.0045,
  tool_calls: [{ tool_name: 'search', ... }],
  provider_calls: [{ provider: 'anthropic', ... }],
  errors: [],
  warnings: [],
  guardian_reference: 'guardian-abc123',
  audit_reference: 'audit-jkl012'
}
```

## Framework Categories

Frameworks are organized by primary purpose:

1. **Multi-Agent Frameworks** - Agent orchestration and coordination
   - LangGraph, AutoGen, CrewAI

2. **Coding Agents** - Code generation and maintenance
   - OpenHands, Aider, Atomic Agents, SmolAgents

3. **Research Agents** - Information gathering and synthesis
   - GPT Researcher

4. **Workflow Agents** - Process automation
   - n8n, Windmill, Activepieces, Mastra

5. **Browser Agents** - Web automation
   - Skyvern

6. **General Agents** - Multi-purpose
   - Agent-E, PydanticAI

## Capability Matrix

Each framework declares supported capabilities:

| Capability | Native | LangGraph | AutoGen | CrewAI | OpenHands |
|-----------|--------|-----------|---------|--------|-----------|
| multi_agent | ✓ | ✓ | ✓ | ✓ | ✗ |
| tool_calling | ✓ | ✓ | ✓ | ✓ | ✓ |
| rag | ✓ | ✓ | ✗ | ✓ | ✗ |
| streaming | ✓ | ✓ | ✗ | ✓ | ✓ |
| human_approval | ✓ | ✗ | ✓ | ✗ | ✓ |
| browser | ✗ | ✗ | ✗ | ✗ | ✗ |
| vision | ✗ | ✗ | ✗ | ✗ | ✗ |
| mcp | ✓ | ✗ | ✗ | ✗ | ✗ |
| workflow | ✓ | ✓ | ✓ | ✓ | ✗ |

## Error Propagation

Errors flow through adapter to result:

```javascript
try {
  // Framework execution
  const output = await externalFramework.execute(input);
  result.complete(output);
} catch (err) {
  // Record error in result
  result.fail(err);
  
  // Error includes:
  // - message: Human-readable error
  // - stack: Execution stack trace
  // - timestamp: When error occurred
  
  // FrameworkResult captures:
  result.errors = [
    {
      message: 'Framework execution failed',
      stack: '...',
      timestamp: 1234567890
    }
  ];
}
```

## Framework vs Alpha

| Aspect | Framework | Alpha |
|--------|-----------|-------|
| **Role** | Execution engine | Orchestration control plane |
| **Authority** | None - executes only | Complete - makes all decisions |
| **Security Bypass** | Cannot bypass Alpha/Guardian/Sierra/Uniform | Never bypassed |
| **Capability** | Single capability | Routes all capabilities |
| **Context** | Receives sanitized context | Owns complete context |
| **Audit** | Recorded as framework event | Owns audit log |
| **Policy** | Evaluated by framework policy | Enforces via Guardian |
| **Timeout** | Adapter enforces | Guardian enforces |

## Future Extensibility

Framework architecture supports future:

1. **New Framework Categories**: Extend with new deployment models
2. **Composite Frameworks**: Frameworks that combine other frameworks
3. **Framework Chains**: Routing output from one framework to another
4. **Capability Auto-Discovery**: Frameworks self-describe capabilities
5. **Dynamic Loading**: Load frameworks at runtime
6. **Provider Routing**: Different frameworks for different providers
7. **Cost Optimization**: Select cheapest framework for capability
8. **Performance Optimization**: Select fastest framework for latency

## Invariants

Framework architecture maintains these invariants:

1. **Alpha Always Decides**: Framework selection made by policy, never by framework
2. **No Cascade Escalation**: Framework cannot request additional permissions
3. **Complete Audit Trail**: Every operation recorded with full context
4. **Timeout Enforcement**: Adapter enforces timeout, Alpha enforces deadline
5. **Result Integrity**: Framework result validated before use
6. **No Direct Framework Access**: Only through adapter interface
7. **Security Layer Integrity**: Each layer checks previous layers' work
8. **Graceful Degradation**: Framework failure doesn't cascade to other frameworks
