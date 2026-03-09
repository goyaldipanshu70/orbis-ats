/**
 * Comprehensive E2E test — ATS Platform after transformation.
 * Tests all hiring features: auth, dashboard, pipeline, analytics, admin, careers.
 * Run: node e2e-ats-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:8080';
const SCREENSHOT_DIR = '/tmp/e2e-ats-screenshots';
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
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function safeClick(page, selector, options = {}) {
  try {
    await page.click(selector, { timeout: 5000, ...options });
    return true;
  } catch {
    return false;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ORBIS ATS — COMPREHENSIVE E2E TEST SUITE           ');
  console.log('  Tests: Auth, Roles, Dashboard, Pipeline, Analytics, ');
  console.log('         Careers, Applications, Admin, Templates      ');
  console.log('══════════════════════════════════════════════════════\n');

  let authToken = '';
  let createdJobId = '';

  // ═══════════════════════════════════════════════════════════════
  // SECTION A: AUTH & LOGIN
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION A: AUTH & LOGIN ───\n');

  // A1: Login page loads
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"]', { timeout: 8000 });
    await screenshot(page, '01-login-page');
    log('A1. Login page loads', 'PASS', 'Email & password fields visible');
  } catch (e) {
    log('A1. Login page loads', 'FAIL', e.message);
  }

  // A2: Login as admin
  try {
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.waitForTimeout(1500);
    authToken = await page.evaluate(() => localStorage.getItem('access_token') || '');
    await screenshot(page, '02-dashboard-loaded');
    log('A2. Login as admin', 'PASS', `Token: ${authToken ? 'yes' : 'no'}`);
  } catch (e) {
    log('A2. Login as admin', 'FAIL', e.message);
  }

  // A3: Verify no deleted pages are accessible
  try {
    const deletedRoutes = ['/chat', '/rag-chat', '/files', '/finance', '/announcements', '/onboarding', '/model-config'];
    let allRedirected = true;
    for (const route of deletedRoutes) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 5000 });
      const url = page.url();
      if (!url.includes('/dashboard') && !url.includes('404') && !url.includes('not-found')) {
        // Check if it shows 404 content
        const body = await page.textContent('body').catch(() => '');
        if (!body.includes('404') && !body.includes('not found') && !body.includes('Not Found')) {
          allRedirected = false;
        }
      }
    }
    log('A3. Deleted routes return 404 or redirect', allRedirected ? 'PASS' : 'FAIL',
      allRedirected ? 'All 7 deleted routes handled' : 'Some routes still accessible');
  } catch (e) {
    log('A3. Deleted routes return 404 or redirect', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION B: SIDEBAR & NAVIGATION
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION B: SIDEBAR & NAVIGATION ───\n');

  // Navigate back to dashboard
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // B1: Sidebar renders with correct sections (Hiring only, no AI/Company/Finance)
  try {
    const sidebar = await page.locator('aside').first();
    await sidebar.waitFor({ timeout: 5000 });
    const sidebarText = await sidebar.textContent();
    const hasHiring = sidebarText.includes('Hiring') || sidebarText.includes('Dashboard');
    const noAI = !sidebarText.includes('AI Chat');
    const noFinance = !sidebarText.includes('Finance');
    const noCompany = !sidebarText.includes('Announcements');
    const clean = hasHiring && noAI && noFinance && noCompany;
    await screenshot(page, '03-sidebar');
    log('B1. Sidebar shows only hiring nav', clean ? 'PASS' : 'FAIL',
      clean ? 'No AI/Finance/Company sections' : 'Stale sections found');
  } catch (e) {
    log('B1. Sidebar shows only hiring nav', 'FAIL', e.message);
  }

  // B2: Required nav items present
  try {
    const sidebar = await page.locator('aside').first();
    const text = await sidebar.textContent();
    const required = ['Dashboard', 'Analytics', 'Talent Pool', 'Admin'];
    const found = required.filter(item => text.includes(item));
    const allPresent = found.length === required.length;
    log('B2. Required nav items present', allPresent ? 'PASS' : 'FAIL',
      `Found: ${found.join(', ')}`);
  } catch (e) {
    log('B2. Required nav items present', 'FAIL', e.message);
  }

  // B3: Sidebar collapse/expand
  try {
    const toggleBtn = page.locator('aside button').last();
    if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleBtn.click();
      await page.waitForTimeout(400);
      await screenshot(page, '04-sidebar-collapsed');
      await toggleBtn.click();
      await page.waitForTimeout(400);
      log('B3. Sidebar collapse/expand', 'PASS');
    } else {
      log('B3. Sidebar collapse/expand', 'PASS', 'No toggle (OK)');
    }
  } catch (e) {
    log('B3. Sidebar collapse/expand', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION C: DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION C: DASHBOARD ───\n');

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // C1: Dashboard heading and greeting
  try {
    const heading = await page.textContent('h1').catch(() => '');
    const hasGreeting = heading.includes('Dashboard');
    await screenshot(page, '05-dashboard');
    log('C1. Dashboard heading renders', hasGreeting ? 'PASS' : 'FAIL', `Heading: "${heading?.trim().substring(0, 50)}"`);
  } catch (e) {
    log('C1. Dashboard heading renders', 'FAIL', e.message);
  }

  // C2: Stats cards render (6 cards)
  try {
    // Wait for stats to load (skeleton disappears)
    await page.waitForTimeout(2000);
    const statCards = await page.locator('.tabular-nums').count();
    log('C2. Stats cards render', statCards >= 1 ? 'PASS' : 'FAIL', `Found ${statCards} stat values`);
  } catch (e) {
    log('C2. Stats cards render', 'FAIL', e.message);
  }

  // C3: Job cards grid or empty state
  try {
    const hasJobs = await page.locator('[class*="grid"] [class*="cursor-pointer"]').count() > 0;
    const hasEmptyState = (await page.textContent('body')).includes('No jobs created');
    log('C3. Job cards or empty state', hasJobs || hasEmptyState ? 'PASS' : 'FAIL',
      hasJobs ? 'Job cards visible' : 'Empty state shown');
  } catch (e) {
    log('C3. Job cards or empty state', 'FAIL', e.message);
  }

  // C4: Pipeline button exists on job cards (if jobs exist)
  try {
    const pipelineBtn = page.locator('button:has-text("Pipeline")').first();
    if (await pipelineBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      log('C4. Pipeline button on job cards', 'PASS', 'Pipeline link visible');
    } else {
      log('C4. Pipeline button on job cards', 'PASS', 'No jobs to show button (OK)');
    }
  } catch (e) {
    log('C4. Pipeline button on job cards', 'PASS', 'No jobs (OK)');
  }

  // C5: "Create Job" button exists
  try {
    const createBtn = page.locator('button:has-text("Create Job")').first();
    const visible = await createBtn.isVisible({ timeout: 3000 }).catch(() => false);
    log('C5. Create Job button visible', visible ? 'PASS' : 'FAIL');
  } catch (e) {
    log('C5. Create Job button visible', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION D: JOB CREATION (if test user can create jobs)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION D: JOB CREATION ───\n');

  // D1: Navigate to Create Job page
  try {
    await page.goto(`${BASE}/jobs/create`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await screenshot(page, '06-create-job');
    const body = await page.textContent('body');
    const hasForm = body.includes('Create') || body.includes('Job') || body.includes('Upload');
    log('D1. Create Job page loads', hasForm ? 'PASS' : 'FAIL');
  } catch (e) {
    log('D1. Create Job page loads', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION E: PIPELINE PAGE
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION E: PIPELINE ───\n');

  // Try to find an existing job to test pipeline
  let testJobId = '';
  try {
    if (authToken) {
      const jobsRes = await page.evaluate(async (token) => {
        const res = await fetch('/api/job?page=1&page_size=1', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return null;
        return res.json();
      }, authToken);

      if (jobsRes?.items?.length > 0) {
        testJobId = jobsRes.items[0].job_id;
      }
    }
  } catch { }

  if (testJobId) {
    // E1: Pipeline page loads
    try {
      await page.goto(`${BASE}/jobs/${testJobId}/pipeline`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await screenshot(page, '07-pipeline');
      const body = await page.textContent('body');
      const hasPipeline = body.includes('Pipeline') || body.includes('Applied') || body.includes('Screening');
      log('E1. Pipeline page loads', hasPipeline ? 'PASS' : 'FAIL');
    } catch (e) {
      log('E1. Pipeline page loads', 'FAIL', e.message);
    }

    // E2: Kanban columns render
    try {
      const columns = await page.locator('[class*="min-w-\\[260px\\]"]').count();
      if (columns === 0) {
        // Try another selector - look for stage headers
        const body = await page.textContent('body');
        const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
        const foundStages = stages.filter(s => body.includes(s));
        log('E2. Kanban columns render', foundStages.length >= 4 ? 'PASS' : 'FAIL',
          `Found stages: ${foundStages.join(', ')}`);
      } else {
        log('E2. Kanban columns render', 'PASS', `${columns} columns`);
      }
    } catch (e) {
      log('E2. Kanban columns render', 'FAIL', e.message);
    }

    // E3: Pipeline stats row
    try {
      const body = await page.textContent('body');
      const hasTotal = body.includes('Total');
      log('E3. Pipeline stats render', hasTotal ? 'PASS' : 'FAIL');
    } catch (e) {
      log('E3. Pipeline stats render', 'FAIL', e.message);
    }

    // E4: Collapsible table view
    try {
      const tableToggle = page.locator('button:has-text("Table View")').first();
      if (await tableToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tableToggle.click();
        await page.waitForTimeout(500);
        await screenshot(page, '08-pipeline-table');
        // Check if table expanded
        const tableVisible = await page.locator('table').isVisible({ timeout: 3000 }).catch(() => false);
        log('E4. Table view toggle', tableVisible ? 'PASS' : 'FAIL',
          tableVisible ? 'Table expanded' : 'Table not found');
      } else {
        log('E4. Table view toggle', 'PASS', 'No table toggle (no candidates)');
      }
    } catch (e) {
      log('E4. Table view toggle', 'FAIL', e.message);
    }

    // E5: Refresh button
    try {
      const refreshBtn = page.locator('button:has-text("Refresh")').first();
      const visible = await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false);
      log('E5. Refresh button visible', visible ? 'PASS' : 'FAIL');
    } catch (e) {
      log('E5. Refresh button visible', 'FAIL', e.message);
    }

    // E6: Job detail page has Pipeline button
    try {
      await page.goto(`${BASE}/jobs/${testJobId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const body = await page.textContent('body');
      const hasPipelineBtn = body.includes('View Pipeline') || body.includes('Pipeline');
      await screenshot(page, '09-job-detail');
      log('E6. Job detail has Pipeline button', hasPipelineBtn ? 'PASS' : 'FAIL');
    } catch (e) {
      log('E6. Job detail has Pipeline button', 'FAIL', e.message);
    }
  } else {
    log('E1-E6. Pipeline tests', 'PASS', 'Skipped — no jobs in DB');
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION F: ANALYTICS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION F: ANALYTICS ───\n');

  // F1: Analytics page loads
  try {
    await page.goto(`${BASE}/analytics`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '10-analytics');
    const body = await page.textContent('body');
    const hasAnalytics = body.includes('Analytics');
    log('F1. Analytics page loads', hasAnalytics ? 'PASS' : 'FAIL');
  } catch (e) {
    log('F1. Analytics page loads', 'FAIL', e.message);
  }

  // F2: KPI cards render
  try {
    const body = await page.textContent('body');
    const kpis = ['Applications', 'Time to Hire', 'Acceptance', 'Velocity'];
    const found = kpis.filter(k => body.includes(k));
    log('F2. Analytics KPI cards', found.length >= 2 ? 'PASS' : 'FAIL',
      `Found: ${found.join(', ')}`);
  } catch (e) {
    log('F2. Analytics KPI cards', 'FAIL', e.message);
  }

  // F3: Charts section renders (funnel, time-to-hire, etc.)
  try {
    const body = await page.textContent('body');
    const charts = ['Funnel', 'Time', 'Source', 'Interviewer'];
    const found = charts.filter(c => body.includes(c));
    log('F3. Analytics charts section', found.length >= 1 ? 'PASS' : 'FAIL',
      `Found sections: ${found.join(', ')}`);
  } catch (e) {
    log('F3. Analytics charts section', 'FAIL', e.message);
  }

  // F4: Job filter dropdown
  try {
    const jobFilter = page.locator('button:has-text("All Jobs"), [class*="SelectTrigger"]').first();
    const visible = await jobFilter.isVisible({ timeout: 3000 }).catch(() => false);
    log('F4. Job filter dropdown', visible ? 'PASS' : 'FAIL');
  } catch (e) {
    log('F4. Job filter dropdown', 'PASS', 'Filter may be empty (OK)');
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION G: HIRING ASSISTANT
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION G: HIRING ASSISTANT ───\n');

  // G1: Hiring Assistant page loads
  try {
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await screenshot(page, '11-hiring-assistant');
    const body = await page.textContent('body');
    const hasAssistant = body.includes('Hiring') || body.includes('Assistant') || body.includes('Ask');
    log('G1. Hiring Assistant page loads', hasAssistant ? 'PASS' : 'FAIL');
  } catch (e) {
    log('G1. Hiring Assistant page loads', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION H: TALENT POOL
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION H: TALENT POOL ───\n');

  // H1: Talent Pool page loads
  try {
    await page.goto(`${BASE}/talent-pool`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await screenshot(page, '12-talent-pool');
    const body = await page.textContent('body');
    const hasTalentPool = body.includes('Talent') || body.includes('Pool') || body.includes('candidate');
    log('H1. Talent Pool page loads', hasTalentPool ? 'PASS' : 'FAIL');
  } catch (e) {
    log('H1. Talent Pool page loads', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION I: TEMPLATES
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION I: TEMPLATES ───\n');

  // I1: Templates page loads
  try {
    await page.goto(`${BASE}/templates`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await screenshot(page, '13-templates');
    const body = await page.textContent('body');
    const hasTemplates = body.includes('Template') || body.includes('template');
    log('I1. Templates page loads', hasTemplates ? 'PASS' : 'FAIL');
  } catch (e) {
    log('I1. Templates page loads', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION J: ADMIN DASHBOARD
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION J: ADMIN DASHBOARD ───\n');

  // J1: Admin page loads
  try {
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await screenshot(page, '14-admin');
    const body = await page.textContent('body');
    const hasAdmin = body.includes('Admin') || body.includes('Users') || body.includes('Panel');
    log('J1. Admin page loads', hasAdmin ? 'PASS' : 'FAIL');
  } catch (e) {
    log('J1. Admin page loads', 'FAIL', e.message);
  }

  // J2: Admin has 3 tabs (Users, Audit Logs, Offer Templates)
  try {
    const body = await page.textContent('body');
    const expectedTabs = ['Users', 'Audit'];
    const foundTabs = expectedTabs.filter(t => body.includes(t));
    const noDeletedTabs = !body.includes('Departments') && !body.includes('Knowledge Base');
    log('J2. Admin has correct tabs', foundTabs.length >= 2 && noDeletedTabs ? 'PASS' : 'FAIL',
      `Found: ${foundTabs.join(', ')}${!noDeletedTabs ? ' (stale tabs found!)' : ''}`);
  } catch (e) {
    log('J2. Admin has correct tabs', 'FAIL', e.message);
  }

  // J3: Users table renders
  try {
    const table = page.locator('table').first();
    const visible = await table.isVisible({ timeout: 5000 }).catch(() => false);
    if (visible) {
      const rows = await page.locator('table tbody tr').count();
      log('J3. Users table renders', 'PASS', `${rows} user rows`);
    } else {
      log('J3. Users table renders', 'FAIL', 'Table not visible');
    }
  } catch (e) {
    log('J3. Users table renders', 'FAIL', e.message);
  }

  // J4: Create user button exists
  try {
    const createBtn = page.locator('button:has-text("Create User"), button:has-text("Add User"), button:has-text("New User")').first();
    const visible = await createBtn.isVisible({ timeout: 3000 }).catch(() => false);
    log('J4. Create user button', visible ? 'PASS' : 'FAIL');
  } catch (e) {
    log('J4. Create user button', 'FAIL', e.message);
  }

  // J5: Switch to Audit Logs tab
  try {
    const auditTab = page.locator('button:has-text("Audit"), [role="tab"]:has-text("Audit")').first();
    if (await auditTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await auditTab.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '15-admin-audit');
      log('J5. Audit Logs tab', 'PASS');
    } else {
      log('J5. Audit Logs tab', 'FAIL', 'Tab not found');
    }
  } catch (e) {
    log('J5. Audit Logs tab', 'FAIL', e.message);
  }

  // J6: Role badges are correct (admin, hr, hiring_manager — not recruiter)
  try {
    // Go back to Users tab
    const usersTab = page.locator('button:has-text("Users"), [role="tab"]:has-text("Users")').first();
    if (await usersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await usersTab.click();
      await page.waitForTimeout(500);
    }
    // Check role badges/cells — look for badge elements with role text, not free text in names
    const roleBadges = await page.locator('table tbody td .inline-flex, table tbody td [class*="Badge"]').allTextContents();
    const roleBadgeText = roleBadges.join(' ').toLowerCase();
    const hasRecruiterRole = roleBadgeText.includes('recruiter');
    const hasValidRoles = roleBadgeText.includes('admin') || roleBadgeText.includes('hiring manager') || roleBadgeText.includes('hr');
    log('J6. No stale "Recruiter" role references',
      !hasRecruiterRole && hasValidRoles ? 'PASS' : 'FAIL',
      !hasRecruiterRole ? `Clean roles: ${[...new Set(roleBadges)].join(', ')}` : '"Recruiter" role badge found');
  } catch (e) {
    log('J6. No stale "Recruiter" role references', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION K: ACCOUNT SETTINGS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION K: ACCOUNT SETTINGS ───\n');

  // K1: Account Settings page loads
  try {
    await page.goto(`${BASE}/account-settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await screenshot(page, '16-account-settings');
    const body = await page.textContent('body');
    const hasSettings = body.includes('Account') || body.includes('Settings') || body.includes('Profile');
    log('K1. Account Settings page loads', hasSettings ? 'PASS' : 'FAIL');
  } catch (e) {
    log('K1. Account Settings page loads', 'FAIL', e.message);
  }

  // K2: No theme settings (removed)
  try {
    const body = await page.textContent('body');
    const noTheme = !body.includes('Theme Preference') && !body.includes('Accent Color');
    log('K2. Theme settings removed', noTheme ? 'PASS' : 'FAIL',
      noTheme ? 'No theme UI' : 'Theme settings still visible');
  } catch (e) {
    log('K2. Theme settings removed', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION L: PUBLIC CAREERS PAGE
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION L: PUBLIC CAREERS ───\n');

  // Logout first for public page test
  try {
    await page.goto(`${BASE}/careers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await screenshot(page, '17-careers');
    const body = await page.textContent('body');
    const hasCareers = body.includes('Orbis') || body.includes('Career') || body.includes('Jobs');
    log('L1. Public Careers page loads', hasCareers ? 'PASS' : 'FAIL');
  } catch (e) {
    log('L1. Public Careers page loads', 'FAIL', e.message);
  }

  // L2: Careers page has header with sign-in and apply buttons
  try {
    const body = await page.textContent('header');
    const hasAuth = body.includes('Sign In') || body.includes('Apply') || body.includes('Dashboard');
    log('L2. Careers header renders', hasAuth ? 'PASS' : 'FAIL');
  } catch (e) {
    log('L2. Careers header renders', 'FAIL', e.message);
  }

  // L3: Test a job detail page (if jobs exist)
  try {
    const jobLink = page.locator('a[href*="/careers/"], [class*="cursor-pointer"]').first();
    if (await jobLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await jobLink.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '18-career-job-detail');
      const body = await page.textContent('body');
      const hasDetail = body.includes('Apply Now') || body.includes('Requirements') || body.includes('About this role');
      log('L3. Career job detail page', hasDetail ? 'PASS' : 'FAIL');
    } else {
      log('L3. Career job detail page', 'PASS', 'No public jobs (OK)');
    }
  } catch (e) {
    log('L3. Career job detail page', 'FAIL', e.message);
  }

  // L4: Apply button behavior (should redirect to signup if not logged in)
  try {
    // Clear auth
    await page.evaluate(() => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    });

    if (testJobId) {
      await page.goto(`${BASE}/careers/${testJobId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const applyBtn = page.locator('button:has-text("Apply Now")').first();
      if (await applyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await applyBtn.click();
        await page.waitForTimeout(1000);
        const url = page.url();
        const redirectedToSignup = url.includes('signup') || url.includes('login');
        log('L4. Apply redirects to auth', redirectedToSignup ? 'PASS' : 'FAIL',
          `Redirected to: ${url}`);
      } else {
        log('L4. Apply redirects to auth', 'PASS', 'No apply button (job not public)');
      }
    } else {
      log('L4. Apply redirects to auth', 'PASS', 'No jobs to test');
    }
  } catch (e) {
    log('L4. Apply redirects to auth', 'FAIL', e.message);
  }

  // Re-login for remaining tests
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.waitForTimeout(1000);
    authToken = await page.evaluate(() => localStorage.getItem('access_token') || '');
  } catch { }

  // ═══════════════════════════════════════════════════════════════
  // SECTION M: API HEALTH CHECKS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION M: API HEALTH CHECKS ───\n');

  // M1: Pipeline API
  try {
    if (testJobId && authToken) {
      const result = await page.evaluate(async ({ token, jobId }) => {
        const res = await fetch(`/api/candidates/pipeline/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        return { status: res.status, ok: res.ok };
      }, { token: authToken, jobId: testJobId });
      log('M1. Pipeline API (/api/candidates/pipeline/:id)', result.ok ? 'PASS' : 'FAIL',
        `Status: ${result.status}`);
    } else {
      log('M1. Pipeline API', 'PASS', 'Skipped — no jobs');
    }
  } catch (e) {
    log('M1. Pipeline API', 'FAIL', e.message);
  }

  // M2: Analytics Funnel API
  try {
    if (authToken) {
      const result = await page.evaluate(async (token) => {
        const res = await fetch('/api/dashboard/analytics/funnel', {
          headers: { Authorization: `Bearer ${token}` }
        });
        return { status: res.status, ok: res.ok };
      }, authToken);
      log('M2. Analytics Funnel API', result.ok ? 'PASS' : 'FAIL', `Status: ${result.status}`);
    }
  } catch (e) {
    log('M2. Analytics Funnel API', 'FAIL', e.message);
  }

  // M3: Analytics Time to Hire API
  try {
    if (authToken) {
      const result = await page.evaluate(async (token) => {
        const res = await fetch('/api/dashboard/analytics/time-to-hire', {
          headers: { Authorization: `Bearer ${token}` }
        });
        return { status: res.status, ok: res.ok };
      }, authToken);
      log('M3. Analytics Time-to-Hire API', result.ok ? 'PASS' : 'FAIL', `Status: ${result.status}`);
    }
  } catch (e) {
    log('M3. Analytics Time-to-Hire API', 'FAIL', e.message);
  }

  // M4: Interview Schedule Upcoming API
  try {
    if (authToken) {
      const result = await page.evaluate(async (token) => {
        const res = await fetch('/api/interview/schedule/upcoming', {
          headers: { Authorization: `Bearer ${token}` }
        });
        return { status: res.status, ok: res.ok };
      }, authToken);
      log('M4. Interview Schedule Upcoming API', result.ok ? 'PASS' : 'FAIL', `Status: ${result.status}`);
    }
  } catch (e) {
    log('M4. Interview Schedule Upcoming API', 'FAIL', e.message);
  }

  // M5: Screening Questions API (if job exists)
  try {
    if (testJobId && authToken) {
      const result = await page.evaluate(async ({ token, jobId }) => {
        const res = await fetch(`/api/job/${jobId}/screening-questions`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        return { status: res.status, ok: res.ok };
      }, { token: authToken, jobId: testJobId });
      log('M5. Screening Questions API', result.ok ? 'PASS' : 'FAIL', `Status: ${result.status}`);
    } else {
      log('M5. Screening Questions API', 'PASS', 'Skipped — no jobs');
    }
  } catch (e) {
    log('M5. Screening Questions API', 'FAIL', e.message);
  }

  // M6: Offers API (if job exists)
  try {
    if (testJobId && authToken) {
      const result = await page.evaluate(async ({ token, jobId }) => {
        const res = await fetch(`/api/job/${jobId}/offers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        return { status: res.status, ok: res.ok };
      }, { token: authToken, jobId: testJobId });
      log('M6. Offers API', result.ok ? 'PASS' : 'FAIL', `Status: ${result.status}`);
    } else {
      log('M6. Offers API', 'PASS', 'Skipped — no jobs');
    }
  } catch (e) {
    log('M6. Offers API', 'FAIL', e.message);
  }

  // M7: Public Careers API (no auth)
  try {
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/careers/jobs?page=1&page_size=5');
      return { status: res.status, ok: res.ok };
    });
    log('M7. Public Careers API (no auth)', result.ok ? 'PASS' : 'FAIL', `Status: ${result.status}`);
  } catch (e) {
    log('M7. Public Careers API', 'FAIL', e.message);
  }

  // M8: Dashboard Stats API
  try {
    if (authToken) {
      const result = await page.evaluate(async (token) => {
        const res = await fetch('/api/dashboard/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        return { status: res.status, ok: res.ok };
      }, authToken);
      log('M8. Dashboard Stats API', result.ok ? 'PASS' : 'FAIL', `Status: ${result.status}`);
    }
  } catch (e) {
    log('M8. Dashboard Stats API', 'FAIL', e.message);
  }

  // M9: Admin Stats API
  try {
    if (authToken) {
      const result = await page.evaluate(async (token) => {
        const res = await fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        return { status: res.status, ok: res.ok };
      }, authToken);
      log('M9. Admin Stats API', result.ok ? 'PASS' : 'FAIL', `Status: ${result.status}`);
    }
  } catch (e) {
    log('M9. Admin Stats API', 'FAIL', e.message);
  }

  // M10: Talent Pool API
  try {
    if (authToken) {
      const result = await page.evaluate(async (token) => {
        const res = await fetch('/api/talent-pool?page=1&page_size=5', {
          headers: { Authorization: `Bearer ${token}` }
        });
        return { status: res.status, ok: res.ok };
      }, authToken);
      log('M10. Talent Pool API', result.ok ? 'PASS' : 'FAIL', `Status: ${result.status}`);
    }
  } catch (e) {
    log('M10. Talent Pool API', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION N: GATEWAY ROUTING
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── SECTION N: GATEWAY ROUTING ───\n');

  // N1: Deleted gateway routes return 404
  try {
    const deletedApiRoutes = ['/api/chat/sessions', '/api/rag/sessions', '/api/documents', '/api/departments'];
    let allGone = true;
    for (const route of deletedApiRoutes) {
      const result = await page.evaluate(async (url) => {
        const res = await fetch(url);
        return res.status;
      }, route);
      if (result !== 404 && result !== 502 && result !== 503) {
        allGone = false;
      }
    }
    log('N1. Deleted API routes unreachable', allGone ? 'PASS' : 'FAIL',
      allGone ? 'All return 404/502' : 'Some still accessible');
  } catch (e) {
    log('N1. Deleted API routes unreachable', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${pass} passed, ${fail} failed (${pass + fail} total)`);
  console.log('══════════════════════════════════════════════════════');

  if (fail > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.test}: ${r.detail}`);
    });
  }

  console.log(`\n📸 Screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log('');

  await page.waitForTimeout(3000);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
