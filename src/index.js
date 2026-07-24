/**
 * Main entry point for the multi-agent orchestration system
 */

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const logger = require('./utils/logger');
const ConfigLoader = require('./config/config-loader');
const AgentRegistry = require('./agents/agent-registry');
const ProviderRegistry = require('./providers/provider-registry');
const AlphaOrchestrator = require('./core/alpha-orchestrator');
const { SystemError } = require('./utils/errors');

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    logger.info('═══════════════════════════════════════════════════════════════');
    logger.info('Multi-Agent Orchestration System - Phase 1');
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

    // Initialize Alpha Orchestrator
    logger.info('Initializing Alpha orchestrator...');
    const alpha = new AlphaOrchestrator(agentRegistry);
    logger.info('✓ Alpha orchestrator ready');

    // Set up Express server
    const app = express();

    // Middleware
    app.use(helmet());
    app.use(cors());
    app.use(bodyParser.json());

    // Request logging middleware
    app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });

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
        const alphaStatus = await alpha.getStatus();
        const agentStatuses = await alpha.getAgentStatuses();
        const providerStatus = providerRegistry.getStatus();

        res.json({
          timestamp: new Date().toISOString(),
          orchestrator: alphaStatus,
          agents: agentStatuses,
          providers: providerStatus
        });
      } catch (error) {
        logger.error(`Error getting status: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Routes: Get all agents
    app.get('/agents', async (req, res) => {
      try {
        const agents = agentRegistry.getEnabledAgents().map(a => a.toJSON());
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
        const status = agentRegistry.getStatus(req.params.code);
        res.json({
          agent: agent.toJSON(),
          status: status.toJSON()
        });
      } catch (error) {
        logger.error(`Error getting agent ${req.params.code}: ${error.message}`);
        res.status(404).json({ error: error.message });
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
        res.json(provider.toJSON());
      } catch (error) {
        logger.error(`Error getting provider ${req.params.id}: ${error.message}`);
        res.status(500).json({ error: error.message });
      }
    });

    // Routes: Receive objective (stub)
    app.post('/objectives', async (req, res) => {
      try {
        const result = await alpha.receiveObjective(req.body);
        res.json(result);
      } catch (error) {
        logger.error(`Error receiving objective: ${error.message}`);
        res.status(400).json({ error: error.message });
      }
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
    app.listen(PORT, () => {
      logger.info('═══════════════════════════════════════════════════════════════');
      logger.info(`Server listening on port ${PORT}`);
      logger.info(`Environment: ${config.env.NODE_ENV}`);
      logger.info(`Log Level: ${config.env.LOG_LEVEL}`);
      logger.info('═══════════════════════════════════════════════════════════════');
      logger.info('');
      logger.info('Available endpoints:');
      logger.info('  GET  /health                    - Health check');
      logger.info('  GET  /status                    - Full system status');
      logger.info('  GET  /agents                    - List all agents');
      logger.info('  GET  /agents/:code              - Get specific agent');
      logger.info('  GET  /providers                 - List all providers');
      logger.info('  GET  /providers/:id             - Get specific provider');
      logger.info('  POST /objectives                - Submit objective');
      logger.info('');
    });

  } catch (error) {
    logger.error(`Failed to start application: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

main();
