#!/usr/bin/env ts-node
/**
 * QA Bot Detection Bypass Test Script
 *
 * Tests the full payment flow using the QA bypass mechanism
 * without triggering Paystack fraud detection.
 *
 * Usage:
 *   npm run test:qa
 *   Or: npx ts-node scripts/test-qa-bypass.ts
 *
 * Environment Variables Required:
 *   - ENABLE_QA_BYPASS=true
 *   - QA_BYPASS_TOKEN=test-bypass-token-2026
 *   - API_BASE_URL=http://localhost:3001
 */

import axios from 'axios';

const API_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const QA_BYPASS_TOKEN = process.env.QA_BYPASS_TOKEN || 'test-bypass-token-2026';

interface TestUser {
  email: string;
  password: string;
  tenantId?: string;
  accessToken?: string;
}

const testUser: TestUser = {
  email: `qa-test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
};

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const color = {
    info: colors.blue,
    success: colors.green,
    error: colors.red,
    warning: colors.yellow,
  }[type];
  console.log(`${color}${message}${colors.reset}`);
}

async function runTests() {
  log('🧪 Starting QA Bypass Tests\n', 'info');

  const results = {
    passed: 0,
    failed: 0,
    tests: [] as { name: string; passed: boolean; error?: string }[],
  };

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, passed: true });
      log(`  ✅ ${name}`, 'success');
    } catch (error: any) {
      results.failed++;
      results.tests.push({ name, passed: false, error: error.message });
      log(`  ❌ ${name}: ${error.message}`, 'error');
    }
  }

  // Test 1: Register test user
  await test('Register test user', async () => {
    const response = await axios.post(`${API_URL}/api/auth/register`, {
      email: testUser.email,
      password: testUser.password,
      firstName: 'QA',
      lastName: 'Test',
      businessName: `QA Test Business ${Date.now()}`,
    });

    if (response.data.accessToken) {
      testUser.accessToken = response.data.accessToken;
      testUser.tenantId = response.data.user?.tenantId;
    } else {
      throw new Error('No access token received');
    }
  });

  // Test 2: Initialize QA payment with bypass token
  let mockReference: string;
  await test('Initialize QA payment with bypass token', async () => {
    if (!testUser.accessToken) throw new Error('No access token');

    const response = await axios.post(
      `${API_URL}/api/billing/initialize-qa`,
      { plan: 'SMS' },
      {
        headers: {
          Authorization: `Bearer ${testUser.accessToken}`,
          'x-qa-bypass': QA_BYPASS_TOKEN,
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.error || 'QA payment initialization failed');
    }

    if (!response.data.qaBypass) {
      throw new Error('Response not marked as QA bypass');
    }

    mockReference = response.data.reference;

    if (!mockReference?.startsWith('qa_')) {
      throw new Error('Invalid mock reference format');
    }

    log(`     Reference: ${mockReference}`, 'info');
  });

  // Test 3: Verify QA transaction
  await test('Verify QA transaction', async () => {
    if (!testUser.accessToken) throw new Error('No access token');
    if (!mockReference) throw new Error('No mock reference');

    const response = await axios.post(
      `${API_URL}/api/billing/verify`,
      { reference: mockReference },
      {
        headers: {
          Authorization: `Bearer ${testUser.accessToken}`,
        },
      }
    );

    if (!response.data.verified) {
      throw new Error('Transaction not verified');
    }

    if (!response.data.qaBypass) {
      throw new Error('Verification not marked as QA bypass');
    }
  });

  // Test 4: Check billing info reflects subscription
  await test('Check billing info reflects subscription', async () => {
    if (!testUser.accessToken) throw new Error('No access token');

    const response = await axios.get(`${API_URL}/api/billing`, {
      headers: {
        Authorization: `Bearer ${testUser.accessToken}`,
      },
    });

    if (response.data.status !== 'TRIALING') {
      throw new Error(`Expected status TRIALING, got ${response.data.status}`);
    }
  });

  // Test 5: Reject QA bypass without token
  await test('Reject QA bypass without token', async () => {
    if (!testUser.accessToken) throw new Error('No access token');

    try {
      await axios.post(
        `${API_URL}/api/billing/initialize-qa`,
        { plan: 'SMS' },
        {
          headers: {
            Authorization: `Bearer ${testUser.accessToken}`,
            // No x-qa-bypass header
          },
        }
      );
      throw new Error('Should have failed without bypass token');
    } catch (error: any) {
      if (error.response?.status === 400 || error.response?.data?.success === false) {
        // Expected - test passes
        return;
      }
      throw error;
    }
  });

  // Test 6: Reject invalid bypass token
  await test('Reject invalid bypass token', async () => {
    if (!testUser.accessToken) throw new Error('No access token');

    try {
      await axios.post(
        `${API_URL}/api/billing/initialize-qa`,
        { plan: 'SMS' },
        {
          headers: {
            Authorization: `Bearer ${testUser.accessToken}`,
            'x-qa-bypass': 'invalid-token',
          },
        }
      );
      throw new Error('Should have failed with invalid token');
    } catch (error: any) {
      if (error.response?.data?.success === false || error.response?.status === 400) {
        // Expected - test passes
        return;
      }
      throw error;
    }
  });

  // Summary
  log('\n📊 Test Results:', 'info');
  log(`  ✅ Passed: ${results.passed}`, 'success');
  log(`  ❌ Failed: ${results.failed}`, results.failed > 0 ? 'error' : 'success');

  if (results.failed > 0) {
    log('\nFailed Tests:', 'error');
    results.tests
      .filter(t => !t.passed)
      .forEach(t => log(`  - ${t.name}: ${t.error}`, 'error'));
    process.exit(1);
  } else {
    log('\n✨ All QA bypass tests passed!', 'success');
    process.exit(0);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export { runTests };
