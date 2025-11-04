#!/usr/bin/env node
/**
 * Comprehensive Backend and Database Connection Test Script
 * 
 * Tests:
 * 1. Database connection and basic queries
 * 2. Database schema (tables, columns)
 * 3. Backend API endpoints
 * 4. API authentication endpoints
 * 
 * Usage:
 *   npm run test:connection
 *   or
 *   tsx test-backend-db.ts
 */

import pool from './src/db';
import dotenv from 'dotenv';
import * as http from 'http';

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
};

const PORT = process.env.PORT || 3001;
const BASE_URL = `http://localhost:${PORT}`;

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  duration?: number;
}

const results: TestResult[] = [];

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
  log(`\n${colors.bold}${colors.blue}${'='.repeat(60)}${colors.reset}`);
  log(`${colors.bold}${colors.blue}${message}${colors.reset}`);
  log(`${colors.bold}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
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
  path: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ status: number; data: any; error?: string }> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: PORT,
        path: options.path,
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        timeout: 5000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode || 0, data: parsed });
          } catch {
            resolve({ status: res.statusCode || 0, data });
          }
        });
      }
    );

    req.on('error', (error) => {
      resolve({ status: 0, data: null, error: error.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, data: null, error: 'Request timeout' });
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

// Database Tests
async function testDatabaseConnection(): Promise<void> {
  logHeader('DATABASE CONNECTION TESTS');

  const startTime = Date.now();

  try {
    // Test 1: Basic connection
    const client = await pool.connect();
    recordResult('Database Connection', true, 'Successfully connected to database');
    client.release();

    // Test 2: Query database version
    const versionResult = await pool.query('SELECT version()');
    const version = versionResult.rows[0]?.version || 'Unknown';
    logInfo(`PostgreSQL Version: ${version.split(',')[0]}`);
    recordResult('Database Version Query', true, 'Retrieved PostgreSQL version');

    // Test 3: List all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    const tables = tablesResult.rows.map((r) => r.table_name);
    logInfo(`Found ${tables.length} tables in database`);
    if (tables.length > 0) {
      logInfo(`Tables: ${tables.join(', ')}`);
    }
    recordResult('List Tables', true, `Found ${tables.length} table(s)`);

    // Test 4: Check for expected tables
    const expectedTables = [
      'User',
      'Project',
      'Script',
      'TestRun',
      'TestStep',
      'RefreshToken',
    ];
    const missingTables = expectedTables.filter((t) => !tables.includes(t));
    if (missingTables.length === 0) {
      recordResult('Schema Check', true, 'All expected tables exist');
    } else {
      recordResult(
        'Schema Check',
        false,
        `Missing tables: ${missingTables.join(', ')}`
      );
    }

    // Test 5: Test a simple query on User table
    if (tables.includes('User')) {
      try {
        const userCountResult = await pool.query('SELECT COUNT(*) as count FROM "User"');
        const userCount = parseInt(userCountResult.rows[0]?.count || '0');
        recordResult('User Table Query', true, `Found ${userCount} user(s)`);
      } catch (error: any) {
        recordResult('User Table Query', false, `Error: ${error.message}`);
      }
    } else {
      recordResult('User Table Query', false, 'User table does not exist');
    }

    // Test 6: Connection pool stats
    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
    logInfo(`Pool Stats: ${JSON.stringify(poolStats)}`);
    recordResult('Connection Pool', true, 'Pool is operational');

    const duration = Date.now() - startTime;
    logInfo(`Database tests completed in ${duration}ms`);

  } catch (error: any) {
    recordResult('Database Connection', false, error.message);
    logError(`Database test failed: ${error.message}`);
  }
}

// Backend API Tests
async function testBackendAPI(): Promise<void> {
  logHeader('BACKEND API TESTS');

  const startTime = Date.now();

  // Test 1: Health Check
  try {
    const healthResponse = await httpRequest({ method: 'GET', path: '/health' });
    if (healthResponse.status === 200 && healthResponse.data.status === 'ok') {
      recordResult('Health Check', true, 'Backend is healthy');
      logInfo(`Environment: ${healthResponse.data.environment}`);
      logInfo(`Timestamp: ${healthResponse.data.timestamp}`);
    } else {
      recordResult(
        'Health Check',
        false,
        `Unexpected response: ${JSON.stringify(healthResponse.data)}`
      );
    }
  } catch (error: any) {
    recordResult('Health Check', false, `Error: ${error.message || error}`);
  }

  // Test 2: API Root
  try {
    const apiResponse = await httpRequest({ method: 'GET', path: '/api' });
    if (apiResponse.status === 200) {
      recordResult('API Root', true, 'API root endpoint accessible');
      if (apiResponse.data.endpoints) {
        logInfo(`Available endpoints: ${apiResponse.data.endpoints.length}`);
      }
    } else {
      recordResult('API Root', false, `Status: ${apiResponse.status}`);
    }
  } catch (error: any) {
    recordResult('API Root', false, `Error: ${error.message || error}`);
  }

  // Test 3: Extension Ping
  try {
    const pingResponse = await httpRequest({
      method: 'GET',
      path: '/api/extensions/ping',
    });
    if (pingResponse.status === 200 && pingResponse.data.status === 'ok') {
      recordResult('Extension Ping', true, 'Extension endpoint is accessible');
    } else {
      recordResult(
        'Extension Ping',
        false,
        `Unexpected response: ${JSON.stringify(pingResponse.data)}`
      );
    }
  } catch (error: any) {
    recordResult('Extension Ping', false, `Error: ${error.message || error}`);
  }

  // Test 4: Swagger JSON
  try {
    const swaggerResponse = await httpRequest({
      method: 'GET',
      path: '/api-docs.json',
    });
    if (swaggerResponse.status === 200 && swaggerResponse.data.openapi) {
      recordResult('Swagger Docs', true, 'API documentation accessible');
    } else {
      recordResult('Swagger Docs', false, `Status: ${swaggerResponse.status}`);
    }
  } catch (error: any) {
    recordResult('Swagger Docs', false, `Error: ${error.message || error}`);
  }

  // Test 5: Test Auth Registration (should fail without proper data, but endpoint should exist)
  try {
    const authResponse = await httpRequest({
      method: 'POST',
      path: '/api/auth/register',
      body: {},
    });
    // We expect a 400 or validation error, which means the endpoint exists
    if (authResponse.status > 0) {
      recordResult('Auth Endpoints', true, 'Authentication endpoints are accessible');
    } else {
      recordResult('Auth Endpoints', false, 'Cannot reach auth endpoints');
    }
  } catch (error: any) {
    recordResult('Auth Endpoints', false, `Error: ${error.message || error}`);
  }

  const duration = Date.now() - startTime;
  logInfo(`Backend API tests completed in ${duration}ms`);
}

// Environment Check
function checkEnvironment(): void {
  logHeader('ENVIRONMENT CONFIGURATION');

  const envVars = {
    'DB_HOST': process.env.DB_HOST || 'Not set',
    'DB_PORT': process.env.DB_PORT || 'Not set',
    'DB_NAME': process.env.DB_NAME || 'Not set',
    'DB_USER': process.env.DB_USER || 'Not set',
    'DATABASE_URL': process.env.DATABASE_URL
      ? 'Set (hidden for security)'
      : 'Not set',
    'PORT': process.env.PORT || 'Not set (default: 3001)',
    'NODE_ENV': process.env.NODE_ENV || 'Not set (default: development)',
  };

  Object.entries(envVars).forEach(([key, value]) => {
    if (value === 'Not set' && key !== 'DATABASE_URL') {
      logWarning(`${key}: ${value}`);
    } else {
      logInfo(`${key}: ${value}`);
    }
  });
}

// Summary
function printSummary(): void {
  logHeader('TEST SUMMARY');

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  log(`Total Tests: ${total}`);
  logSuccess(`Passed: ${passed}`);
  if (failed > 0) {
    logError(`Failed: ${failed}`);
  }

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
    logSuccess('\n🎉 All tests passed! System is operational.');
  } else {
    logWarning('\n⚠️  Some tests failed. Please review the errors above.');
  }

  log(`\n${colors.bold}${colors.blue}${'='.repeat(60)}${colors.reset}\n`);
}

// Main execution
async function main() {
  log(`\n${colors.bold}${colors.cyan}`);
  log('╔══════════════════════════════════════════════════════════════╗');
  log('║   Backend & Database Connection Test Suite                   ║');
  log('╚══════════════════════════════════════════════════════════════╝');
  log(`${colors.reset}\n`);

  checkEnvironment();

  try {
    await testDatabaseConnection();
  } catch (error: any) {
    logError(`Database tests crashed: ${error.message}`);
  }

  try {
    await testBackendAPI();
  } catch (error: any) {
    logError(`API tests crashed: ${error.message}`);
  }

  printSummary();

  // Clean up
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

