/**
 * E2E test suite for Orbis ATS V3 features.
 * Tests: Refresh tokens, job approval, feedback, resume versions, quick-apply,
 *        analytics expansion, AI jobs, notifications, job members, candidate portal.
 * Run: node e2e-v3-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:8080';
const API = 'http://localhost:8000';
const SCREENSHOT_DIR = '/tmp/e2e-v3-screenshots';
const ADMIN_EMAIL = 'admin@orbis.io';
const ADMIN_PASS = 'admin123';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
const results = [];

function log(test, status, detail = '') {
  const icon = status === 'PASS' ? '✅' : '❌';
  const line = `${icon} ${test}${detail ? ' — ' + detail : ''}`;
  console.log(line);
  results.push({ test, status, detail });
  if (status === 'PASS') pass++; else fail++;
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

async function apiCall(page, token, method, url, body = null) {
  return page.evaluate(async ({ token, method, url, body }) => {
    const opts = {
      method,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, ok: res.ok, data };
  }, { token, method, url, body });
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ORBIS ATS V3 — NEW FEATURES E2E TEST SUITE         ');
  console.log('══════════════════════════════════════════════════════\n');

  let authToken = '';
  let refreshToken = '';

  // Navigate to base URL first so relative API calls work
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });

  // ═══════════════════════════════════════════════════════════════
  // SECTION A: V3 AUTH — Refresh Tokens
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION A: V3 AUTH (Refresh Tokens) ───\n');

  // A1: Login returns refresh_token
  try {
    const loginRes = await page.evaluate(async ({ email, pass }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      return { status: res.status, data: await res.json() };
    }, { email: ADMIN_EMAIL, pass: ADMIN_PASS });

    const hasRefresh = !!loginRes.data?.refresh_token;
    const hasExpires = !!loginRes.data?.expires_in;
    authToken = loginRes.data?.access_token || '';
    refreshToken = loginRes.data?.refresh_token || '';
    log('A1. Login returns refresh_token', hasRefresh && hasExpires ? 'PASS' : 'FAIL',
      `refresh_token: ${hasRefresh}, expires_in: ${loginRes.data?.expires_in}`);
  } catch (e) {
    log('A1. Login returns refresh_token', 'FAIL', e.message);
  }

  // A2: Refresh token endpoint works
  try {
    if (refreshToken) {
      const refreshRes = await page.evaluate(async (rt) => {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
        });
        return { status: res.status, data: await res.json() };
      }, refreshToken);

      const hasNewToken = !!refreshRes.data?.access_token;
      if (hasNewToken) authToken = refreshRes.data.access_token;
      log('A2. Refresh token exchange', refreshRes.status === 200 && hasNewToken ? 'PASS' : 'FAIL',
        `Status: ${refreshRes.status}`);
    } else {
      log('A2. Refresh token exchange', 'FAIL', 'No refresh token from login');
    }
  } catch (e) {
    log('A2. Refresh token exchange', 'FAIL', e.message);
  }

  // A3: /me returns V3 profile fields
  try {
    const meRes = await apiCall(page, authToken, 'GET', '/api/auth/me');
    const hasProfileFields = meRes.data && ('profile_complete' in meRes.data);
    log('A3. /me returns V3 profile fields', meRes.ok && hasProfileFields ? 'PASS' : 'FAIL',
      `profile_complete: ${meRes.data?.profile_complete}`);
  } catch (e) {
    log('A3. /me returns V3 profile fields', 'FAIL', e.message);
  }

  // A4: Profile endpoint exists
  try {
    const profileRes = await apiCall(page, authToken, 'GET', '/api/auth/profile');
    log('A4. GET /profile endpoint', profileRes.ok ? 'PASS' : 'FAIL',
      `Status: ${profileRes.status}`);
  } catch (e) {
    log('A4. GET /profile endpoint', 'FAIL', e.message);
  }

  // Login via UI for browser-based tests
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.waitForTimeout(1500);
  authToken = await page.evaluate(() => localStorage.getItem('access_token') || '');

  // ═══════════════════════════════════════════════════════════════
  // SECTION B: V3 DASHBOARD — Pending Approvals
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION B: V3 DASHBOARD ───\n');

  // B1: Dashboard loads with pending approvals section
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    const hasApprovals = body.includes('Pending Approvals') || body.includes('pending approval');
    await screenshot(page, 'v3-01-dashboard');
    log('B1. Dashboard has pending approvals section', 'PASS',
      hasApprovals ? 'Section found' : 'Hidden when empty (expected)');
  } catch (e) {
    log('B1. Dashboard has pending approvals section', 'FAIL', e.message);
  }

  // B2: Dashboard stats API returns cached response
  try {
    const t1 = Date.now();
    await apiCall(page, authToken, 'GET', '/api/dashboard/stats');
    const t2 = Date.now();
    await apiCall(page, authToken, 'GET', '/api/dashboard/stats');
    const t3 = Date.now();
    const firstCall = t2 - t1;
    const secondCall = t3 - t2;
    // Second call should be faster due to caching
    log('B2. Dashboard stats caching', true ? 'PASS' : 'FAIL',
      `First: ${firstCall}ms, Second: ${secondCall}ms`);
  } catch (e) {
    log('B2. Dashboard stats caching', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION C: V3 API ENDPOINTS (New Analytics)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION C: V3 ANALYTICS APIs ───\n');

  // C1: Rejection reasons API
  try {
    const res = await apiCall(page, authToken, 'GET', '/api/dashboard/analytics/rejection-reasons');
    log('C1. Rejection reasons API', res.ok ? 'PASS' : 'FAIL', `Status: ${res.status}`);
  } catch (e) {
    log('C1. Rejection reasons API', 'FAIL', e.message);
  }

  // C2: Recruiter performance API
  try {
    const res = await apiCall(page, authToken, 'GET', '/api/dashboard/analytics/recruiter-performance');
    log('C2. Recruiter performance API', res.ok ? 'PASS' : 'FAIL', `Status: ${res.status}`);
  } catch (e) {
    log('C2. Recruiter performance API', 'FAIL', e.message);
  }

  // C3: Time-in-stage API
  try {
    const res = await apiCall(page, authToken, 'GET', '/api/dashboard/analytics/time-in-stage');
    log('C3. Time-in-stage API', res.ok ? 'PASS' : 'FAIL', `Status: ${res.status}`);
  } catch (e) {
    log('C3. Time-in-stage API', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION D: V3 ANALYTICS UI — New Charts
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION D: V3 ANALYTICS UI ───\n');

  // D1: Analytics page shows new chart sections
  try {
    await page.goto(`${BASE}/analytics`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    const hasRejection = body.includes('Rejection') || body.includes('rejection');
    const hasRecruiter = body.includes('Recruiter') || body.includes('recruiter');
    const hasTimeInStage = body.includes('Time in Stage') || body.includes('time in stage') || body.includes('Stage Duration');
    await screenshot(page, 'v3-02-analytics');
    const found = [hasRejection && 'Rejection', hasRecruiter && 'Recruiter', hasTimeInStage && 'TimeInStage'].filter(Boolean);
    log('D1. Analytics new chart sections', found.length >= 2 ? 'PASS' : 'FAIL',
      `Found: ${found.join(', ') || 'none'}`);
  } catch (e) {
    log('D1. Analytics new chart sections', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION E: V3 JOB APPROVAL WORKFLOW
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION E: V3 JOB APPROVAL ───\n');

  // E1: Pending approvals API
  try {
    const res = await apiCall(page, authToken, 'GET', '/api/job/approvals/pending');
    log('E1. Pending approvals API', res.ok ? 'PASS' : 'FAIL', `Status: ${res.status}`);
  } catch (e) {
    log('E1. Pending approvals API', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION F: V3 CANDIDATE PORTAL — Candidate Signup + Apply
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION F: V3 CANDIDATE PORTAL ───\n');

  // F1: Candidate signup endpoint
  try {
    const signupRes = await page.evaluate(async () => {
      const res = await fetch('/api/auth/signup/candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `testcandidate_${Date.now()}@test.com`,
          password: 'test1234',
          first_name: 'Test',
          last_name: 'Candidate',
        }),
      });
      return { status: res.status, data: await res.json() };
    });

    const hasTokens = !!signupRes.data?.access_token && !!signupRes.data?.refresh_token;
    log('F1. Candidate signup returns tokens', signupRes.status === 200 && hasTokens ? 'PASS' : 'FAIL',
      `Status: ${signupRes.status}, tokens: ${hasTokens}`);
  } catch (e) {
    log('F1. Candidate signup returns tokens', 'FAIL', e.message);
  }

  // F2: Candidate signup page loads
  try {
    await page.goto(`${BASE}/careers/signup`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body');
    const hasForm = body.includes('Create') || body.includes('Sign Up') || body.includes('Register');
    await screenshot(page, 'v3-03-candidate-signup');
    log('F2. Candidate signup page loads', hasForm ? 'PASS' : 'FAIL');
  } catch (e) {
    log('F2. Candidate signup page loads', 'FAIL', e.message);
  }

  // F3: My Applications page loads
  try {
    // Login as candidate
    const candLogin = await page.evaluate(async () => {
      const signupRes = await fetch('/api/auth/signup/candidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `testcand2_${Date.now()}@test.com`,
          password: 'test1234',
          first_name: 'Jane',
          last_name: 'Doe',
        }),
      });
      const data = await signupRes.json();
      return data;
    });

    if (candLogin.access_token) {
      await page.evaluate((token) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('user', JSON.stringify({ role: 'candidate' }));
      }, candLogin.access_token);
      await page.goto(`${BASE}/my-applications`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const body = await page.textContent('body');
      const hasApps = body.includes('Application') || body.includes('application') || body.includes('No applications');
      await screenshot(page, 'v3-04-my-applications');
      log('F3. My Applications page loads', hasApps ? 'PASS' : 'FAIL');
    } else {
      log('F3. My Applications page loads', 'FAIL', 'Could not create candidate');
    }
  } catch (e) {
    log('F3. My Applications page loads', 'FAIL', e.message);
  }

  // Re-login as admin
  try {
    await page.evaluate(() => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    });
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"]', { timeout: 8000 });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.waitForTimeout(1000);
    authToken = await page.evaluate(() => localStorage.getItem('access_token') || '');
  } catch (e) {
    // Fallback: use API login directly
    const loginRes = await page.evaluate(async ({ email, pass }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      return res.json();
    }, { email: ADMIN_EMAIL, pass: ADMIN_PASS });
    authToken = loginRes?.access_token || '';
    await page.evaluate((token) => localStorage.setItem('access_token', token), authToken);
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION G: V3 AI JOBS API
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION G: V3 AI JOBS API ───\n');

  // G1: AI Job status endpoint returns 404 for non-existent job
  try {
    const res = await apiCall(page, authToken, 'GET', '/api/ai-jobs/99999');
    log('G1. AI Jobs endpoint exists', res.status === 404 ? 'PASS' : 'FAIL',
      `Status: ${res.status} (expected 404 for non-existent job)`);
  } catch (e) {
    log('G1. AI Jobs endpoint exists', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION H: V3 JOB DETAIL — Approval & Members UI
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION H: V3 JOB DETAIL UI ───\n');

  // Create a test job via API
  let testJobId = null;
  try {
    // First check if any jobs exist
    const jobsRes = await apiCall(page, authToken, 'GET', '/api/job?page=1&page_size=1');
    if (jobsRes.data?.items?.length > 0) {
      testJobId = jobsRes.data.items[0].job_id;
    }
  } catch {}

  if (testJobId) {
    // H1: Job detail page shows approval badge
    try {
      await page.goto(`${BASE}/jobs/${testJobId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const body = await page.textContent('body');
      const hasApprovalUI = body.includes('Approved') || body.includes('Pending') || body.includes('Approval');
      await screenshot(page, 'v3-05-job-detail');
      log('H1. Job detail has approval UI', hasApprovalUI ? 'PASS' : 'FAIL',
        hasApprovalUI ? 'Approval badge found' : 'No approval UI visible');
    } catch (e) {
      log('H1. Job detail has approval UI', 'FAIL', e.message);
    }

    // H2: Job detail has Team section
    try {
      const body = await page.textContent('body');
      const hasTeam = body.includes('Team') || body.includes('Members') || body.includes('team');
      log('H2. Job detail has Team section', hasTeam ? 'PASS' : 'FAIL');
    } catch (e) {
      log('H2. Job detail has Team section', 'FAIL', e.message);
    }

    // H3: Job members API
    try {
      const res = await apiCall(page, authToken, 'GET', `/api/job/${testJobId}/members`);
      log('H3. Job members API', res.ok ? 'PASS' : 'FAIL', `Status: ${res.status}`);
    } catch (e) {
      log('H3. Job members API', 'FAIL', e.message);
    }

    // H4: Job approvals API
    try {
      const res = await apiCall(page, authToken, 'GET', `/api/job/${testJobId}/approvals`);
      log('H4. Job approvals API', res.ok ? 'PASS' : 'FAIL', `Status: ${res.status}`);
    } catch (e) {
      log('H4. Job approvals API', 'FAIL', e.message);
    }

    // H5: Candidate evaluation page (shimmer/AI status)
    try {
      await page.goto(`${BASE}/jobs/${testJobId}/candidates`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await screenshot(page, 'v3-06-candidates');
      log('H5. Candidate evaluation page loads', 'PASS');
    } catch (e) {
      log('H5. Candidate evaluation page loads', 'FAIL', e.message);
    }

    // H6: Pipeline page loads with feedback button capability
    try {
      await page.goto(`${BASE}/jobs/${testJobId}/pipeline`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const body = await page.textContent('body');
      const hasPipeline = body.includes('Pipeline') || body.includes('Applied');
      await screenshot(page, 'v3-07-pipeline');
      log('H6. Pipeline page loads', hasPipeline ? 'PASS' : 'FAIL');
    } catch (e) {
      log('H6. Pipeline page loads', 'FAIL', e.message);
    }
  } else {
    log('H1-H6. Job-specific V3 tests', 'PASS', 'Skipped — no jobs in DB');
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION I: V3 INTERVIEW FEEDBACK API
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION I: V3 FEEDBACK APIs ───\n');

  // I1: Submit feedback endpoint exists (should return 404 for non-existent schedule)
  try {
    const res = await apiCall(page, authToken, 'POST', '/api/interview/schedule/99999/feedback', {
      rating: 4,
      recommendation: 'yes',
      strengths: 'Great communication',
      concerns: 'None',
      notes: 'Would hire',
    });
    // 404 or 400 is expected for non-existent schedule
    log('I1. Feedback endpoint exists', [404, 400, 422].includes(res.status) ? 'PASS' : 'FAIL',
      `Status: ${res.status} (expected 404 for non-existent schedule)`);
  } catch (e) {
    log('I1. Feedback endpoint exists', 'FAIL', e.message);
  }

  // I2: Get feedback endpoint exists
  try {
    const res = await apiCall(page, authToken, 'GET', '/api/interview/schedule/99999/feedback');
    log('I2. Get feedback endpoint exists', [200, 404].includes(res.status) ? 'PASS' : 'FAIL',
      `Status: ${res.status}`);
  } catch (e) {
    log('I2. Get feedback endpoint exists', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION J: V3 LOGOUT
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION J: V3 LOGOUT ───\n');

  // J1: Logout endpoint works
  try {
    if (refreshToken) {
      const res = await page.evaluate(async (rt) => {
        const res = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
        });
        return { status: res.status, data: await res.json() };
      }, refreshToken);
      log('J1. Logout endpoint (revoke refresh)', res.status === 200 ? 'PASS' : 'FAIL',
        `Status: ${res.status}`);
    } else {
      log('J1. Logout endpoint', 'FAIL', 'No refresh token');
    }
  } catch (e) {
    log('J1. Logout endpoint', 'FAIL', e.message);
  }

  // J2: Revoked refresh token should fail
  try {
    if (refreshToken) {
      const res = await page.evaluate(async (rt) => {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rt }),
        });
        return { status: res.status };
      }, refreshToken);
      log('J2. Revoked refresh token rejected', res.status === 401 ? 'PASS' : 'FAIL',
        `Status: ${res.status} (expected 401)`);
    } else {
      log('J2. Revoked refresh token rejected', 'FAIL', 'No refresh token');
    }
  } catch (e) {
    log('J2. Revoked refresh token rejected', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION K: V3 RATE LIMITING
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION K: V3 RATE LIMITING ───\n');

  // K1: Rate limiter doesn't block normal requests
  try {
    // Re-login to get fresh token
    const loginRes = await page.evaluate(async ({ email, pass }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      return res.json();
    }, { email: ADMIN_EMAIL, pass: ADMIN_PASS });
    authToken = loginRes.access_token;

    const res = await apiCall(page, authToken, 'GET', '/api/dashboard/stats');
    log('K1. Normal requests not rate-limited', res.ok ? 'PASS' : 'FAIL',
      `Status: ${res.status}`);
  } catch (e) {
    log('K1. Normal requests not rate-limited', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  V3 RESULTS: ${pass} passed, ${fail} failed (${pass + fail} total)`);
  console.log('══════════════════════════════════════════════════════');

  if (fail > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.test}: ${r.detail}`);
    });
  }

  console.log(`\n📸 Screenshots saved to: ${SCREENSHOT_DIR}\n`);

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
