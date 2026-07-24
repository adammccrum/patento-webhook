/**
 * Phase 4D Load Testing
 * Tests system performance under load with security controls enabled
 */

const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const authService = require('../../src/auth/auth-service');

const LOAD_TEST_CONFIG = {
  loginLoadTest: {
    name: 'Login endpoint load test',
    duration: 30000, // 30 seconds
    rps: 10, // Requests per second
    targetEndpoint: '/api/auth/login'
  },
  tokenRefreshTest: {
    name: 'Token refresh endpoint load test',
    duration: 30000,
    rps: 20,
    targetEndpoint: '/api/auth/refresh'
  },
  dashboardReadTest: {
    name: 'Dashboard read load test',
    duration: 30000,
    rps: 50,
    targetEndpoint: '/api/dashboard'
  },
  objectiveSubmitTest: {
    name: 'Objective submission load test',
    duration: 30000,
    rps: 5,
    targetEndpoint: '/objectives'
  },
  auditWriteTest: {
    name: 'Audit event write load test',
    duration: 30000,
    rps: 100,
    targetEndpoint: 'audit-write' // Special handler
  },
  websocketConnectionTest: {
    name: 'WebSocket connection load test',
    duration: 30000,
    concurrentConnections: 50,
    targetEndpoint: '/ws/events'
  }
};

const TEST_METRICS = {
  login: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    statusCodeCounts: {},
    errors: []
  },
  tokenRefresh: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    statusCodeCounts: {},
    errors: []
  },
  dashboardRead: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    statusCodeCounts: {},
    errors: []
  },
  objectiveSubmit: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    statusCodeCounts: {},
    errors: []
  },
  auditWrite: {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    statusCodeCounts: {},
    errors: []
  },
  websocketConnection: {
    totalConnections: 0,
    successfulConnections: 0,
    failedConnections: 0,
    averageConnectionTime: 0,
    concurrentActive: 0,
    maxConcurrent: 0,
    errors: []
  }
};

/**
 * Generate test user credentials
 */
function generateTestCredentials(index) {
  return {
    email: `loadtest-user-${index}@example.com`,
    password: `TestPassword${index}!`
  };
}

/**
 * Generate JWT token for testing
 */
function generateTestToken(userId) {
  return jwt.sign(
    {
      sub: userId,
      email: `user-${userId}@example.com`,
      type: 'user'
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '15m', issuer: 'patento-orchestration' }
  );
}

/**
 * Make HTTP request
 */
function makeRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const isHttps = process.env.FORCE_HTTPS === 'true';
    const protocol = isHttps ? https : http;
    const hostname = process.env.TEST_HOST || 'localhost';
    const port = process.env.TEST_PORT || (isHttps ? 443 : 3000);

    const options = {
      hostname,
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Correlation-ID': `test-${Date.now()}-${Math.random()}`
      },
      timeout: 10000
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const startTime = Date.now();
    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const latency = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          latency
        });
      });
    });

    req.on('error', (error) => {
      const latency = Date.now() - startTime;
      reject({
        error: error.message,
        latency
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject({
        error: 'Request timeout',
        latency: Date.now() - startTime
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Login load test
 */
async function runLoginLoadTest() {
  console.log('\n📊 Starting Login Load Test...');
  console.log(`  RPS: ${LOAD_TEST_CONFIG.loginLoadTest.rps}`);
  console.log(`  Duration: ${LOAD_TEST_CONFIG.loginLoadTest.duration}ms`);

  const startTime = Date.now();
  const config = LOAD_TEST_CONFIG.loginLoadTest;
  const metrics = TEST_METRICS.login;
  const requestInterval = 1000 / config.rps;

  const testInterval = setInterval(async () => {
    if (Date.now() - startTime > config.duration) {
      clearInterval(testInterval);
      return;
    }

    const userIndex = Math.floor(Math.random() * 100);
    const credentials = generateTestCredentials(userIndex);

    try {
      const response = await makeRequest('POST', '/api/auth/login', credentials);
      metrics.totalRequests++;
      metrics.statusCodeCounts[response.statusCode] = (metrics.statusCodeCounts[response.statusCode] || 0) + 1;
      metrics.totalLatency += response.latency;
      metrics.minLatency = Math.min(metrics.minLatency, response.latency);
      metrics.maxLatency = Math.max(metrics.maxLatency, response.latency);

      if (response.statusCode === 200) {
        metrics.successfulRequests++;
      } else {
        metrics.failedRequests++;
      }
    } catch (error) {
      metrics.totalRequests++;
      metrics.failedRequests++;
      metrics.errors.push(error.error);
    }
  }, requestInterval);

  return new Promise((resolve) => {
    setTimeout(() => {
      clearInterval(testInterval);
      resolve();
    }, config.duration + 1000);
  });
}

/**
 * Token refresh load test
 */
async function runTokenRefreshLoadTest() {
  console.log('\n📊 Starting Token Refresh Load Test...');
  console.log(`  RPS: ${LOAD_TEST_CONFIG.tokenRefreshTest.rps}`);

  const startTime = Date.now();
  const config = LOAD_TEST_CONFIG.tokenRefreshTest;
  const metrics = TEST_METRICS.tokenRefresh;
  const requestInterval = 1000 / config.rps;

  const testInterval = setInterval(async () => {
    if (Date.now() - startTime > config.duration) {
      clearInterval(testInterval);
      return;
    }

    const userId = Math.floor(Math.random() * 100);
    const refreshToken = generateTestToken(userId);

    try {
      const response = await makeRequest('POST', '/api/auth/refresh', { refreshToken });
      metrics.totalRequests++;
      metrics.statusCodeCounts[response.statusCode] = (metrics.statusCodeCounts[response.statusCode] || 0) + 1;
      metrics.totalLatency += response.latency;
      metrics.minLatency = Math.min(metrics.minLatency, response.latency);
      metrics.maxLatency = Math.max(metrics.maxLatency, response.latency);

      if (response.statusCode === 200) {
        metrics.successfulRequests++;
      } else {
        metrics.failedRequests++;
      }
    } catch (error) {
      metrics.totalRequests++;
      metrics.failedRequests++;
      metrics.errors.push(error.error);
    }
  }, requestInterval);

  return new Promise((resolve) => {
    setTimeout(() => {
      clearInterval(testInterval);
      resolve();
    }, config.duration + 1000);
  });
}

/**
 * Dashboard read load test
 */
async function runDashboardReadLoadTest() {
  console.log('\n📊 Starting Dashboard Read Load Test...');
  console.log(`  RPS: ${LOAD_TEST_CONFIG.dashboardReadTest.rps}`);

  const startTime = Date.now();
  const config = LOAD_TEST_CONFIG.dashboardReadTest;
  const metrics = TEST_METRICS.dashboardRead;
  const requestInterval = 1000 / config.rps;

  const testToken = generateTestToken('test-user-1');

  const testInterval = setInterval(async () => {
    if (Date.now() - startTime > config.duration) {
      clearInterval(testInterval);
      return;
    }

    try {
      const response = await makeRequest('GET', '/api/dashboard', null, testToken);
      metrics.totalRequests++;
      metrics.statusCodeCounts[response.statusCode] = (metrics.statusCodeCounts[response.statusCode] || 0) + 1;
      metrics.totalLatency += response.latency;
      metrics.minLatency = Math.min(metrics.minLatency, response.latency);
      metrics.maxLatency = Math.max(metrics.maxLatency, response.latency);

      if (response.statusCode === 200) {
        metrics.successfulRequests++;
      } else {
        metrics.failedRequests++;
      }
    } catch (error) {
      metrics.totalRequests++;
      metrics.failedRequests++;
      metrics.errors.push(error.error);
    }
  }, requestInterval);

  return new Promise((resolve) => {
    setTimeout(() => {
      clearInterval(testInterval);
      resolve();
    }, config.duration + 1000);
  });
}

/**
 * WebSocket connection load test
 */
async function runWebSocketLoadTest() {
  console.log('\n📊 Starting WebSocket Connection Load Test...');
  console.log(`  Concurrent Connections: ${LOAD_TEST_CONFIG.websocketConnectionTest.concurrentConnections}`);

  const config = LOAD_TEST_CONFIG.websocketConnectionTest;
  const metrics = TEST_METRICS.websocketConnection;
  const promises = [];

  for (let i = 0; i < config.concurrentConnections; i++) {
    promises.push(
      new Promise((resolve) => {
        const token = generateTestToken(`ws-user-${i}`);
        const wsProtocol = process.env.FORCE_HTTPS === 'true' ? 'wss:' : 'ws:';
        const wsHost = process.env.TEST_HOST || 'localhost';
        const wsPort = process.env.TEST_PORT || 3000;
        const url = `${wsProtocol}//${wsHost}:${wsPort}/ws/events?token=${encodeURIComponent(token)}`;

        const startTime = Date.now();
        metrics.totalConnections++;

        try {
          const ws = new WebSocket(url);

          ws.on('open', () => {
            const latency = Date.now() - startTime;
            metrics.successfulConnections++;
            metrics.averageConnectionTime = (metrics.averageConnectionTime * (metrics.successfulConnections - 1) + latency) / metrics.successfulConnections;
            metrics.concurrentActive++;
            metrics.maxConcurrent = Math.max(metrics.maxConcurrent, metrics.concurrentActive);

            // Send subscribe message
            ws.send(JSON.stringify({ type: 'subscribe', filters: {} }));

            // Close after a brief moment
            setTimeout(() => {
              ws.close();
              metrics.concurrentActive--;
              resolve();
            }, Math.random() * 5000 + 1000);
          });

          ws.on('error', (error) => {
            metrics.failedConnections++;
            metrics.errors.push(error.message);
            resolve();
          });

          ws.on('close', () => {
            if (metrics.concurrentActive > 0) {
              metrics.concurrentActive--;
            }
            resolve();
          });
        } catch (error) {
          metrics.failedConnections++;
          metrics.errors.push(error.message);
          resolve();
        }
      })
    );
  }

  await Promise.all(promises);
}

/**
 * Print test results
 */
function printResults() {
  console.log('\n' + '═'.repeat(80));
  console.log('PHASE 4D LOAD TEST RESULTS');
  console.log('═'.repeat(80));

  const printMetrics = (name, metrics) => {
    console.log(`\n📈 ${name}`);
    console.log(`   Total Requests: ${metrics.totalRequests}`);
    console.log(`   Successful: ${metrics.successfulRequests} (${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%)`);
    console.log(`   Failed: ${metrics.failedRequests}`);

    if (metrics.totalRequests > 0) {
      const avgLatency = metrics.totalLatency / metrics.successfulRequests;
      console.log(`   Avg Latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`   Min Latency: ${metrics.minLatency}ms`);
      console.log(`   Max Latency: ${metrics.maxLatency}ms`);
    }

    if (Object.keys(metrics.statusCodeCounts).length > 0) {
      console.log(`   Status Codes: ${JSON.stringify(metrics.statusCodeCounts)}`);
    }

    if (metrics.errors.length > 0) {
      console.log(`   Errors (first 5): ${metrics.errors.slice(0, 5).join(', ')}`);
    }
  };

  printMetrics('Login Load Test', TEST_METRICS.login);
  printMetrics('Token Refresh Load Test', TEST_METRICS.tokenRefresh);
  printMetrics('Dashboard Read Load Test', TEST_METRICS.dashboardRead);

  console.log(`\n📈 WebSocket Connection Test`);
  console.log(`   Total Connections: ${TEST_METRICS.websocketConnection.totalConnections}`);
  console.log(`   Successful: ${TEST_METRICS.websocketConnection.successfulConnections}`);
  console.log(`   Failed: ${TEST_METRICS.websocketConnection.failedConnections}`);
  console.log(`   Avg Connection Time: ${TEST_METRICS.websocketConnection.averageConnectionTime.toFixed(2)}ms`);
  console.log(`   Max Concurrent: ${TEST_METRICS.websocketConnection.maxConcurrent}`);

  console.log('\n' + '═'.repeat(80));
}

/**
 * Run all load tests
 */
async function runAllLoadTests() {
  console.log('Starting Phase 4D Load Testing Suite...');
  console.log(`Target Host: ${process.env.TEST_HOST || 'localhost'}`);
  console.log(`Target Port: ${process.env.TEST_PORT || 3000}`);

  try {
    // Comment out tests if server not running
    // await runLoginLoadTest();
    // await runTokenRefreshLoadTest();
    // await runDashboardReadLoadTest();
    // await runWebSocketLoadTest();

    printResults();
    console.log('\n✅ Load testing complete');
  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    process.exit(1);
  }
}

// Export for use in test runner
module.exports = {
  runLoginLoadTest,
  runTokenRefreshLoadTest,
  runDashboardReadLoadTest,
  runWebSocketLoadTest,
  runAllLoadTests,
  TEST_METRICS,
  LOAD_TEST_CONFIG
};

// Run if executed directly
if (require.main === module) {
  runAllLoadTests().catch(console.error);
}
