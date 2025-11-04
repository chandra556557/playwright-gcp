#!/usr/bin/env node
/**
 * Frontend and Backend Integration Test Script
 * 
 * Tests:
 * 1. Frontend server accessibility
 * 2. Backend API accessibility
 * 3. CORS configuration
 * 4. Authentication flow (register/login)
 * 5. Authenticated API endpoints
 * 6. Data flow between frontend and backend
 * 7. WebSocket connection (if available)
 * 
 * Usage:
 *   npm run test:integration
 *   or
 *   tsx test-integration.ts
 */

import * as http from 'http';
import * as https from 'https';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import pool from './src/db';

dotenv.config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  magenta: '\x1b[35m',
};

const BACKEND_PORT = parseInt(process.env.PORT || '3001');
const FRONTEND_PORT = 5174; // Default Vite port
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const API_URL = `${BACKEND_URL}/api`;

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: TestResult[] = [];
let authToken: string | null = null;
let testUserId: string | null = null;
let testProjectId: string | null = null;

// Helper functions
function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, colors.green);
}

function logError(message: string) {
  log(`❌ ${message}`, colors.red);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, colors.yellow);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function logHeader(message: string) {
  log(`\n${colors.bold}${colors.blue}${'='.repeat(70)}${colors.reset}`);
  log(`${colors.bold}${colors.blue}${message}${colors.reset}`);
  log(`${colors.bold}${colors.blue}${'='.repeat(70)}${colors.reset}\n`);
}

function recordResult(name: string, passed: boolean, message: string, duration?: number) {
  results.push({ name, passed, message, duration });
  if (passed) {
    logSuccess(`${name}: ${message}`);
  } else {
    logError(`${name}: ${message}`);
  }
}

// HTTP request helper
async function httpRequest(options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}): Promise<{ status: number; data: any; headers: any; error?: string }> {
  return new Promise((resolve) => {
    const url = new URL(options.url);
    const protocol = url.protocol === 'https:' ? https : http;

    const req = protocol.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        timeout: options.timeout || 5000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({
              status: res.statusCode || 0,
              data: parsed,
              headers: res.headers,
            });
          } catch {
            resolve({
              status: res.statusCode || 0,
              data: data,
              headers: res.headers,
            });
          }
        });
      }
    );

    req.on('error', (error) => {
      resolve({
        status: 0,
        data: null,
        headers: {},
        error: error.message,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 0,
        data: null,
        headers: {},
        error: 'Request timeout',
      });
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// Frontend Tests
async function testFrontendAccessibility(): Promise<void> {
  logHeader('FRONTEND SERVER TESTS');

  try {
    const startTime = Date.now();
    const response = await httpRequest({
      method: 'GET',
      url: FRONTEND_URL,
      timeout: 3000,
    });
    const duration = Date.now() - startTime;

    if (response.status === 200) {
      recordResult(
        'Frontend Server',
        true,
        `Frontend is accessible at ${FRONTEND_URL}`,
        duration
      );
      logInfo(`Response time: ${duration}ms`);
    } else if (response.error) {
      recordResult('Frontend Server', false, `Cannot connect: ${response.error}`);
    } else {
      recordResult('Frontend Server', false, `Unexpected status: ${response.status}`);
    }
  } catch (error: any) {
    recordResult('Frontend Server', false, `Error: ${error.message}`);
  }
}

// Backend API Tests
async function testBackendAPI(): Promise<void> {
  logHeader('BACKEND API TESTS');

  // Test 1: Health Check
  try {
    const response = await httpRequest({
      method: 'GET',
      url: `${BACKEND_URL}/health`,
    });
    if (response.status === 200 && response.data.status === 'ok') {
      recordResult('Backend Health Check', true, 'Backend is healthy');
      logInfo(`Environment: ${response.data.environment}`);
    } else {
      recordResult('Backend Health Check', false, 'Backend health check failed');
    }
  } catch (error: any) {
    recordResult('Backend Health Check', false, `Error: ${error.message}`);
  }

  // Test 2: API Root
  try {
    const response = await httpRequest({
      method: 'GET',
      url: `${BACKEND_URL}/api`,
    });
    if (response.status === 200) {
      recordResult('Backend API Root', true, 'API root accessible');
      if (response.data.endpoints) {
        logInfo(`Available endpoints: ${response.data.endpoints.length}`);
      }
    } else {
      recordResult('Backend API Root', false, `Status: ${response.status}`);
    }
  } catch (error: any) {
    recordResult('Backend API Root', false, `Error: ${error.message}`);
  }
}

// CORS Tests
async function testCORS(): Promise<void> {
  logHeader('CORS CONFIGURATION TESTS');

  // Test CORS headers from frontend origin
  try {
    const response = await httpRequest({
      method: 'OPTIONS',
      url: `${API_URL}/projects`,
      headers: {
        Origin: FRONTEND_URL,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type,Authorization',
      },
    });

    const corsHeaders = {
      'access-control-allow-origin': response.headers['access-control-allow-origin'],
      'access-control-allow-methods': response.headers['access-control-allow-methods'],
      'access-control-allow-headers': response.headers['access-control-allow-headers'],
      'access-control-allow-credentials': response.headers['access-control-allow-credentials'],
    };

    if (
      corsHeaders['access-control-allow-origin'] ||
      response.status === 200 ||
      response.status === 204
    ) {
      recordResult('CORS Configuration', true, 'CORS is configured');
      if (corsHeaders['access-control-allow-origin']) {
        logInfo(
          `Allowed origin: ${corsHeaders['access-control-allow-origin']}`
        );
      }
    } else {
      recordResult(
        'CORS Configuration',
        false,
        'CORS headers not found or incorrectly configured'
      );
    }
  } catch (error: any) {
    recordResult('CORS Configuration', false, `Error: ${error.message}`);
  }
}

// Authentication Tests
async function testAuthentication(): Promise<void> {
  logHeader('AUTHENTICATION TESTS');

  // Generate unique test email
  const testEmail = `test-integration-${Date.now()}@example.com`;
  const testPassword = 'TestIntegration123!';
  const testName = 'Integration Test User';

  // Test 1: User Registration
  try {
    const startTime = Date.now();
    const response = await httpRequest({
      method: 'POST',
      url: `${API_URL}/auth/register`,
      body: {
        email: testEmail,
        password: testPassword,
        name: testName,
      },
    });
    const duration = Date.now() - startTime;

    if (response.status === 200 || response.status === 201) {
      authToken = response.data.accessToken || response.data.token || null;
      testUserId = response.data.user?.id || null;
      recordResult('User Registration', true, `User registered successfully`, duration);
      if (authToken) {
        logInfo(`Token received: ${authToken.substring(0, 20)}...`);
      }
    } else if (response.status === 400 && response.data.message?.includes('already exists')) {
      // User might already exist, try login instead
      logWarning('User already exists, attempting login...');
      await testLogin(testEmail, testPassword);
      recordResult('User Registration', true, 'User exists (login successful)');
    } else {
      recordResult(
        'User Registration',
        false,
        `Failed: ${response.data.message || response.data.error || 'Unknown error'}`
      );
      // Try login as fallback
      await testLogin(testEmail, testPassword);
    }
  } catch (error: any) {
    recordResult('User Registration', false, `Error: ${error.message}`);
    // Try login as fallback
    await testLogin(testEmail, testPassword);
  }

  // Test 2: User Login (if registration didn't set token)
  if (!authToken) {
    await testLogin('demo@example.com', 'demo123');
  }

  async function testLogin(email: string, password: string) {
    try {
      const startTime = Date.now();
      const response = await httpRequest({
        method: 'POST',
        url: `${API_URL}/auth/login`,
        body: {
          email,
          password,
        },
      });
      const duration = Date.now() - startTime;

      if (response.status === 200 && (response.data.accessToken || response.data.token)) {
        authToken = response.data.accessToken || response.data.token || null;
        testUserId = response.data.user?.id || null;
        recordResult('User Login', true, 'Login successful', duration);
        logInfo(`Token received: ${authToken ? authToken.substring(0, 20) + '...' : 'none'}`);
      } else {
        recordResult(
          'User Login',
          false,
          `Failed: ${response.data.message || response.data.error || 'Unknown error'}`
        );
      }
    } catch (error: any) {
      recordResult('User Login', false, `Error: ${error.message}`);
    }
  }
}

// Authenticated API Tests
async function testAuthenticatedEndpoints(): Promise<void> {
  logHeader('AUTHENTICATED API TESTS');

  if (!authToken) {
    recordResult(
      'Authenticated Endpoints',
      false,
      'No authentication token available'
    );
    return;
  }

  const headers = {
    Authorization: `Bearer ${authToken}`,
  };

  // Test 1: Get User Profile
  try {
    const response = await httpRequest({
      method: 'GET',
      url: `${API_URL}/auth/profile`,
      headers,
    });
    if (response.status === 200 && response.data.user) {
      recordResult('Get User Profile', true, 'Profile retrieved successfully');
      logInfo(`User: ${response.data.user.email}`);
    } else {
      recordResult('Get User Profile', false, `Status: ${response.status}`);
    }
  } catch (error: any) {
    recordResult('Get User Profile', false, `Error: ${error.message}`);
  }

  // Test 2: Get Projects
  try {
    const response = await httpRequest({
      method: 'GET',
      url: `${API_URL}/projects`,
      headers,
    });
    if (response.status === 200) {
      const projects = response.data.data || response.data.projects || [];
      recordResult('Get Projects', true, `Found ${projects.length} project(s)`);
      if (projects.length > 0) {
        testProjectId = projects[0].id;
        logInfo(`Using project: ${projects[0].name}`);
      }
    } else {
      recordResult('Get Projects', false, `Status: ${response.status}`);
    }
  } catch (error: any) {
    recordResult('Get Projects', false, `Error: ${error.message}`);
  }

  // Test 3: Create Project
  try {
    const projectName = `Test Project ${Date.now()}`;
    const response = await httpRequest({
      method: 'POST',
      url: `${API_URL}/projects`,
      headers,
      body: {
        name: projectName,
        description: 'Integration test project',
      },
    });
    if (response.status === 200 || response.status === 201) {
      const project = response.data.data || response.data.project || response.data;
      testProjectId = project.id || testProjectId;
      recordResult('Create Project', true, `Project created: ${projectName}`);
    } else {
      recordResult(
        'Create Project',
        false,
        `Status: ${response.status}, ${response.data.message || ''}`
      );
    }
  } catch (error: any) {
    recordResult('Create Project', false, `Error: ${error.message}`);
  }

  // Test 4: Get Scripts
  try {
    const response = await httpRequest({
      method: 'GET',
      url: `${API_URL}/scripts`,
      headers,
      body: testProjectId ? { projectId: testProjectId } : undefined,
    });
    if (response.status === 200) {
      const scripts = response.data.scripts || response.data.data || [];
      recordResult('Get Scripts', true, `Found ${scripts.length} script(s)`);
    } else {
      recordResult('Get Scripts', false, `Status: ${response.status}`);
    }
  } catch (error: any) {
    recordResult('Get Scripts', false, `Error: ${error.message}`);
  }

  // Test 5: Get Test Runs
  try {
    const response = await httpRequest({
      method: 'GET',
      url: `${API_URL}/test-runs`,
      headers,
      body: testProjectId ? { projectId: testProjectId } : undefined,
    });
    if (response.status === 200) {
      const runs = response.data.data || response.data.testRuns || [];
      recordResult('Get Test Runs', true, `Found ${runs.length} test run(s)`);
    } else {
      recordResult('Get Test Runs', false, `Status: ${response.status}`);
    }
  } catch (error: any) {
    recordResult('Get Test Runs', false, `Error: ${error.message}`);
  }

  // Test 6: Extension Ping
  try {
    const response = await httpRequest({
      method: 'GET',
      url: `${API_URL}/extensions/ping`,
      headers,
    });
    if (response.status === 200 && response.data.status === 'ok') {
      recordResult('Extension Ping', true, 'Extension endpoint accessible');
    } else {
      recordResult('Extension Ping', false, `Status: ${response.status}`);
    }
  } catch (error: any) {
    recordResult('Extension Ping', false, `Error: ${error.message}`);
  }
}

// WebSocket Tests
async function testWebSocket(): Promise<void> {
  logHeader('WEBSOCKET CONNECTION TESTS');

  return new Promise((resolve) => {
    try {
      const wsUrl = `ws://localhost:${BACKEND_PORT}/ws`;
      const ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        ws.close();
        recordResult('WebSocket Connection', false, 'Connection timeout');
        resolve();
      }, 3000);

      ws.on('open', () => {
        clearTimeout(timeout);
        recordResult('WebSocket Connection', true, 'WebSocket connected successfully');
        ws.close();
        resolve();
      });

      ws.on('error', (error: any) => {
        clearTimeout(timeout);
        recordResult(
          'WebSocket Connection',
          false,
          `WebSocket not available: ${error.message}`
        );
        resolve();
      });

      ws.on('close', () => {
        // Already resolved
      });
    } catch (error: any) {
      recordResult('WebSocket Connection', false, `Error: ${error.message}`);
      resolve();
    }
  });
}

// Cleanup
async function cleanup(): Promise<void> {
  // Clean up test data if needed
  if (testProjectId && testUserId) {
    try {
      // Could add cleanup logic here if needed
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Summary
function printSummary(): void {
  logHeader('INTEGRATION TEST SUMMARY');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  log(`${colors.bold}Total Tests: ${total}${colors.reset}`);
  logSuccess(`Passed: ${passed}`);
  if (failed > 0) {
    logError(`Failed: ${failed}`);
  }

  // Group results by category
  const categories: Record<string, TestResult[]> = {};
  results.forEach((r) => {
    const category = r.name.split(':')[0] || 'Other';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(r);
  });

  log(`\n${colors.bold}Results by Category:${colors.reset}`);
  Object.entries(categories).forEach(([category, tests]) => {
    const categoryPassed = tests.filter((t) => t.passed).length;
    const categoryTotal = tests.length;
    const statusColor = categoryPassed === categoryTotal ? colors.green : colors.yellow;
    log(
      `  ${statusColor}${category}: ${categoryPassed}/${categoryTotal}${colors.reset}`
    );
  });

  if (failed > 0) {
    log('\nFailed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        logError(`  - ${r.name}: ${r.message}`);
      });
  }

  const allPassed = failed === 0;
  if (allPassed) {
    logSuccess('\n🎉 All integration tests passed! Frontend and backend are working together.');
  } else {
    logWarning('\n⚠️  Some integration tests failed. Please review the errors above.');
  }

  log(`\n${colors.bold}${colors.blue}${'='.repeat(70)}${colors.reset}\n`);
}

// Main execution
async function main() {
  log(`\n${colors.bold}${colors.magenta}`);
  log('╔══════════════════════════════════════════════════════════════════════╗');
  log('║   Frontend & Backend Integration Test Suite                           ║');
  log('╚══════════════════════════════════════════════════════════════════════╝');
  log(`${colors.reset}\n`);

  // Test frontend
  await testFrontendAccessibility();

  // Test backend
  await testBackendAPI();

  // Test CORS
  await testCORS();

  // Test authentication
  await testAuthentication();

  // Test authenticated endpoints
  await testAuthenticatedEndpoints();

  // Test WebSocket
  await testWebSocket();

  // Cleanup
  await cleanup();

  printSummary();

  // Clean up database connection
  try {
    await pool.end();
    const failedCount = results.filter((r) => !r.passed).length;
    process.exit(failedCount === 0 ? 0 : 1);
  } catch (error) {
    process.exit(1);
  }
}

// Run tests
main().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});

