/**
 * Main entry point for the multi-agent orchestration system
 * Phase 2 & 3: With Alpha orchestrator and Operation Centre
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const path = require('path');
const logger = require('./utils/logger');
const ConfigLoader = require('./config/config-loader');
const AgentRegistry = require('./agents/agent-registry');
const ProviderRegistry = require('./providers/provider-registry');
const AlphaOrchestratorV2 = require('./core/alpha-orchestrator-v2');
const OperationCentre = require('./operation-centre/operation-centre');
const { SystemError } = require('./utils/errors');

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('Multi-Agent Orchestration System - Phase 3 (Operation Centre)');
    logger.info('═══════════════════════════════════════════════════════════════');

    // Load configuration
    logger.info('Loading configuration...');
    const configLoader = new ConfigLoader('config');
    const config = configLoader.loadAll();

    // Initialize Agent Registry
    logger.info('Initializing agent registry...');
    const agentRegistry = new AgentRegistry();
    agentRegistry.registerAgents(config.agents);

    const agentValidation = agentRegistry.validate();
    if (!agentValidation.valid) {
      throw new Error(`Agent validation failed: ${JSON.stringify(agentValidation.errors)}`);
    }
    logger.info(`✓ Registered ${agentRegistry.agents.size} agents`);

    // Initialize Provider Registry
    logger.info('Initializing provider registry...');
    const providerRegistry = new ProviderRegistry();
    providerRegistry.registerProviders(config.providers);

    const providerValidation = providerRegistry.validate();
    if (!providerValidation.valid) {
      throw new Error(`Provider validation failed: ${JSON.stringify(providerValidation.errors)}`);
    }
    logger.info(`✓ Registered ${providerRegistry.definitions.size} provider definitions`);

    // Initialize Alpha Orchestrator V2
    logger.info('Initializing Alpha orchestrator v2...');
    const alpha = new AlphaOrchestratorV2(agentRegistry, providerRegistry);
    logger.info('✓ Alpha orchestrator ready');

    // Set up Express server
    const app = express();
    const server = http.createServer(app);

    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(bodyParser.json());

    // Serve static files (dashboard)
    app.use(express.static(path.join(__dirname, '../public')));

    // Request logging middleware
    app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });

    // Initialize Operation Centre
    logger.info('Initializing Operation Centre...');
    const operationCentre = new OperationCentre(
      server,
      alpha,
      agentRegistry,
      providerRegistry
    );
    operationCentre.initialize();
    logger.info('✓ Operation Centre ready');

    // Routes: Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
      });
    });

    // Routes: System status
    app.get('/status', async (req, res) => {
      try {
        const alphaStatus = alpha.getStatus();
        const systemHealth = operationCentre.getSystemHealth();

        res.json({
          timestamp: new Date().toISOString(),
          orchestrator: alphaStatus,
          system: systemHealth
        });
      } catch (error) {
        logger.error(`Error getting status: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Routes: Get all agents
    app.get('/agents', async (req, res) => {
      try {
        const agents = agentRegistry.getEnabledAgents().map(a => ({
          code: a.code,
          name: a.name,
          role: a.role,
          enabled: a.enabled
        }));
        res.json({
          timestamp: new Date().toISOString(),
          total: agents.length,
          agents
        });
      } catch (error) {
        logger.error(`Error getting agents: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Routes: Get specific agent
    app.get('/agents/:code', async (req, res) => {
      try {
        const agent = agentRegistry.getAgent(req.params.code);
        if (!agent) {
          return res.status(404).json({ error: `Agent ${req.params.code} not found` });
        }
        const status = agentRegistry.getStatus(req.params.code);
        res.json({
          agent: {
            code: agent.code,
            name: agent.name,
            role: agent.role,
            enabled: agent.enabled
          },
          status: {
            currentStatus: status?.currentStatus || 'idle',
            completedTasks: status?.completedTasks || 0,
            failedTasks: status?.failedTasks || 0
          }
        });
      } catch (error) {
        logger.error(`Error getting agent ${req.params.code}: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Routes: Get all providers
    app.get('/providers', async (req, res) => {
      try {
        const status = providerRegistry.getStatus();
        res.json(status);
      } catch (error) {
        logger.error(`Error getting providers: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Routes: Get specific provider
    app.get('/providers/:id', async (req, res) => {
      try {
        const provider = providerRegistry.getDefinition(req.params.id);
        if (!provider) {
          return res.status(404).json({ error: `Provider ${req.params.id} not found` });
        }
        res.json(provider);
      } catch (error) {
        logger.error(`Error getting provider ${req.params.id}: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Routes: Receive objective
    app.post('/objectives', async (req, res) => {
      try {
        const result = await alpha.receiveObjective(req.body);
        res.json(result);
      } catch (error) {
        logger.error(`Error receiving objective: ${error.message}`);
        res.status(400).json({ error: error.message });
      }
    });

    // Routes: Execute task
    app.post('/tasks/:taskId/execute', async (req, res) => {
      try {
        const result = await alpha.executeTask(req.params.taskId);
        res.json(result);
      } catch (error) {
        logger.error(`Error executing task: ${error.message}`);
        res.status(400).json({ error: error.message });
      }
    });

    // Dashboard API routes
    const dashboardRouter = require('./api/routes/dashboard')(
      operationCentre,
      agentRegistry,
      providerRegistry
    );
    app.use('/api/dashboard', dashboardRouter);

    // Serve dashboard HTML
    app.get('/dashboard', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // Catch-all for SPA routing
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // Error handler
    app.use((error, req, res, _next) => {
      logger.error(`Unhandled error: ${error.message}`);

      if (error instanceof SystemError) {
        return res.status(400).json(error.toJSON());
      }

      res.status(500).json({
        error: error.message,
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString()
      });
    });

    // Start server
    server.listen(PORT, () => {
      logger.info('═══════════════════════════════════════════════════════════════');
      logger.info(`Server listening on port ${PORT}`);
      logger.info(`Environment: ${config.env.NODE_ENV}`);
      logger.info(`Log Level: ${config.env.LOG_LEVEL}`);
      logger.info('═══════════════════════════════════════════════════════════════');
      logger.info('');
      logger.info('Available endpoints:');
      logger.info('  GET  /                         - Dashboard (HTML)');
      logger.info('  GET  /health                   - Health check');
      logger.info('  GET  /status                   - System status');
      logger.info('  GET  /agents                   - List all agents');
      logger.info('  GET  /agents/:code             - Get specific agent');
      logger.info('  GET  /providers                - List providers');
      logger.info('  POST /objectives               - Submit objective');
      logger.info('  POST /tasks/:taskId/execute    - Execute task');
      logger.info('');
      logger.info('Dashboard API:');
      logger.info('  GET  /api/dashboard            - Dashboard state');
      logger.info('  GET  /api/dashboard/agents     - Agents status');
      logger.info('  GET  /api/dashboard/events     - Recent events');
      logger.info('  GET  /api/dashboard/health     - System health');
      logger.info('');
      logger.info('WebSocket:');
      logger.info('  WS   /ws/events                - Real-time event stream');
      logger.info('');
    });

  } catch (error) {
    logger.error(`Failed to start application: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

main();
