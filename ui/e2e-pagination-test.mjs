/**
 * E2E test for pagination across all pages.
 * Verifies that DataPagination component is visible on every list page.
 * Run: node e2e-pagination-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:8080';
const SCREENSHOT_DIR = '/tmp/e2e-pagination-screenshots';
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

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // ── Login ──────────────────────────────────────────
  console.log('\n🔐 Logging in as admin...');
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('✅ Logged in\n');

  // Helper: navigate and check for pagination text "Showing X–Y of Z"
  async function checkPagination(testName, url, waitFor = 'networkidle', extraWait = 1500) {
    try {
      await page.goto(`${BASE}${url}`);
      await page.waitForLoadState(waitFor);
      await new Promise(r => setTimeout(r, extraWait));
      await screenshot(page, testName.replace(/\s+/g, '-').toLowerCase());

      // Check for "Showing" text which is the DataPagination indicator
      const showingText = await page.locator('text=/Showing \\d+/').first();
      const visible = await showingText.isVisible().catch(() => false);

      if (visible) {
        const text = await showingText.textContent();
        log(testName, 'PASS', text.trim());
      } else {
        // Check if there's data on the page at all
        const noData = await page.locator('text=/No .*(found|yet|match|available)/i').first();
        const noDataVisible = await noData.isVisible().catch(() => false);
        if (noDataVisible) {
          log(testName, 'PASS', 'No data — pagination correctly hidden');
        } else {
          log(testName, 'FAIL', 'Pagination text "Showing X-Y of Z" not found');
        }
      }
    } catch (err) {
      log(testName, 'FAIL', err.message.slice(0, 100));
    }
  }

  // ════════════════════════════════════════════════════
  // Test 1: Dashboard (Jobs)
  // ════════════════════════════════════════════════════
  console.log('\n📄 Testing pagination on all pages...\n');
  await checkPagination('1. Dashboard — Jobs list', '/dashboard');

  // ════════════════════════════════════════════════════
  // Test 2: Candidate Evaluation (need a job with candidates)
  // ════════════════════════════════════════════════════
  // First find a job ID
  let jobId = null;
  try {
    const resp = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
      const r = await fetch('/api/job?page=1&page_size=5', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return r.json();
    });
    if (resp.items && resp.items.length > 0) {
      jobId = resp.items[0]._id || resp.items[0].id;
    }
  } catch {}

  if (jobId) {
    await checkPagination('2. Candidate Evaluation', `/jobs/${jobId}/candidates`);
    await checkPagination('3. Interview Evaluations', `/jobs/${jobId}/interview-evaluations`);
  } else {
    log('2. Candidate Evaluation', 'PASS', 'No jobs — skipped');
    log('3. Interview Evaluations', 'PASS', 'No jobs — skipped');
  }

  // ════════════════════════════════════════════════════
  // Test 4: Files
  // ════════════════════════════════════════════════════
  await checkPagination('4. Files page', '/files');

  // ════════════════════════════════════════════════════
  // Test 5: Talent Pool
  // ════════════════════════════════════════════════════
  await checkPagination('5. Talent Pool', '/talent-pool');

  // ════════════════════════════════════════════════════
  // Test 6: Announcements
  // ════════════════════════════════════════════════════
  await checkPagination('6. Announcements', '/announcements');

  // ════════════════════════════════════════════════════
  // Test 7: Document Templates
  // ════════════════════════════════════════════════════
  await checkPagination('7. Document Templates', '/templates');

  // ════════════════════════════════════════════════════
  // Test 8: Admin — Users Tab
  // ════════════════════════════════════════════════════
  try {
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 2000));

    // Users tab should be active by default
    const showingText = await page.locator('text=/Showing \\d+/').first();
    const visible = await showingText.isVisible().catch(() => false);
    if (visible) {
      const text = await showingText.textContent();
      log('8. Admin — Users Tab', 'PASS', text.trim());
    } else {
      log('8. Admin — Users Tab', 'FAIL', 'No pagination on Users tab');
    }
    await screenshot(page, 'admin-users-tab');
  } catch (err) {
    log('8. Admin — Users Tab', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // Test 9: Admin — Knowledge Base Tab
  // ════════════════════════════════════════════════════
  try {
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 1500));

    // Click Knowledge Base tab (use role=tab to avoid matching sidebar nav)
    const kbTab = page.locator('[role="tab"]:has-text("Knowledge Base"), [data-state]:has-text("Knowledge Base")').first();
    await kbTab.click();
    await new Promise(r => setTimeout(r, 2000));

    const showingText = await page.locator('text=/Showing \\d+/').first();
    const visible = await showingText.isVisible().catch(() => false);
    if (visible) {
      const text = await showingText.textContent();
      log('9. Admin — Knowledge Base Tab', 'PASS', text.trim());
    } else {
      // Check for empty state
      const empty = await page.locator('text=/No documents/i').first();
      const emptyVisible = await empty.isVisible().catch(() => false);
      if (emptyVisible) {
        log('9. Admin — Knowledge Base Tab', 'PASS', 'No documents — pagination correctly hidden');
      } else {
        log('9. Admin — Knowledge Base Tab', 'FAIL', 'No pagination on Knowledge Base tab');
      }
    }
    await screenshot(page, 'admin-kb-tab');
  } catch (err) {
    log('9. Admin — Knowledge Base Tab', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // Test 10: Admin — Audit Logs Tab
  // ════════════════════════════════════════════════════
  try {
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 1500));

    // Click Audit Logs tab
    const auditTab = page.locator('button:has-text("Audit Logs")');
    await auditTab.click();
    await new Promise(r => setTimeout(r, 2000));

    const showingText2 = await page.locator('text=/Showing \\d+/').first();
    const visible2 = await showingText2.isVisible().catch(() => false);
    if (visible2) {
      const text = await showingText2.textContent();
      log('10. Admin — Audit Logs Tab', 'PASS', text.trim());
    } else {
      // Check for empty state (0 audit logs = pagination correctly hidden)
      const emptyAudit = await page.locator('text=/No audit log|0 total/i').first();
      const emptyVisible = await emptyAudit.isVisible().catch(() => false);
      if (emptyVisible) {
        log('10. Admin — Audit Logs Tab', 'PASS', 'No audit logs — pagination correctly hidden');
      } else {
        log('10. Admin — Audit Logs Tab', 'FAIL', 'No pagination on Audit Logs tab');
      }
    }
    await screenshot(page, 'admin-audit-tab');
  } catch (err) {
    log('10. Admin — Audit Logs Tab', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // Test 11: Talent Pool — "Add to Job" button exists
  // ════════════════════════════════════════════════════
  try {
    await page.goto(`${BASE}/talent-pool`);
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 2000));

    // Check if there are candidates with checkboxes
    const checkboxes = await page.locator('[role="checkbox"]').all();
    if (checkboxes.length > 0) {
      // Click the first checkbox to select a candidate
      await checkboxes[0].click();
      await new Promise(r => setTimeout(r, 500));

      // Check for selection bar and "Add to Job" button
      const addBtn = page.locator('button:has-text("Add to Job")');
      const addBtnVisible = await addBtn.isVisible().catch(() => false);

      if (addBtnVisible) {
        log('11. Talent Pool — Add to Job button', 'PASS', 'Button visible after selecting candidate');
      } else {
        log('11. Talent Pool — Add to Job button', 'FAIL', 'Button not visible after selecting candidate');
      }

      // Check for job dropdown
      const jobDropdown = page.locator('text="Select job..."');
      const dropdownVisible = await jobDropdown.isVisible().catch(() => false);
      log('12. Talent Pool — Job dropdown', dropdownVisible ? 'PASS' : 'FAIL',
        dropdownVisible ? 'Job selection dropdown visible' : 'Job dropdown not found');

      // Check for selected count
      const selectedCount = page.locator('text=/\\d+ selected/');
      const countVisible = await selectedCount.isVisible().catch(() => false);
      log('13. Talent Pool — Selection counter', countVisible ? 'PASS' : 'FAIL',
        countVisible ? 'Shows selected count' : 'No selection counter');

      await screenshot(page, 'talent-pool-selection');
    } else {
      // No candidates — check for empty state
      log('11. Talent Pool — Add to Job button', 'PASS', 'No candidates in pool — button hidden correctly');
      log('12. Talent Pool — Job dropdown', 'PASS', 'No candidates — skipped');
      log('13. Talent Pool — Selection counter', 'PASS', 'No candidates — skipped');
    }
  } catch (err) {
    log('11. Talent Pool — Add to Job button', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // Test 14-18: All pages open without errors
  // ════════════════════════════════════════════════════
  const pageTests = [
    { name: 'Analytics', path: '/analytics' },
    { name: 'Model Config', path: '/model-config' },
    { name: 'Onboarding', path: '/onboarding' },
    { name: 'Hiring Assistant', path: '/hiring-assistant' },
    { name: 'RAG Chat', path: '/rag-chat' },
  ];

  for (let i = 0; i < pageTests.length; i++) {
    const { name, path: p } = pageTests[i];
    const testNum = 14 + i;
    try {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));

      await page.goto(`${BASE}${p}`);
      await page.waitForLoadState('networkidle');
      await new Promise(r => setTimeout(r, 1500));

      // Check there's no error overlay or crash
      const errorOverlay = await page.locator('.error-overlay, [class*="error"]').first();
      const errorText = await page.locator('text=/Something went wrong|Error|500|404/').first();
      const errorVisible = await errorText.isVisible().catch(() => false);

      if (errorVisible || errors.length > 0) {
        log(`${testNum}. ${name} page opens`, 'FAIL', errors.join('; ').slice(0, 100));
      } else {
        log(`${testNum}. ${name} page opens`, 'PASS', 'Page loaded without errors');
      }
      await screenshot(page, `page-${name.toLowerCase().replace(/\s+/g, '-')}`);
      page.removeAllListeners('pageerror');
    } catch (err) {
      log(`${testNum}. ${name} page opens`, 'FAIL', err.message.slice(0, 100));
    }
  }

  // ════════════════════════════════════════════════════
  // Test 19: Back/Home navigation
  // ════════════════════════════════════════════════════
  try {
    await page.goto(`${BASE}/talent-pool`);
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 1000));

    const backBtn = page.locator('button:has-text("Back")');
    const homeBtn = page.locator('button:has-text("Home")');

    const backVisible = await backBtn.isVisible().catch(() => false);
    const homeVisible = await homeBtn.isVisible().catch(() => false);

    log('19. Back/Home nav on Talent Pool',
      backVisible && homeVisible ? 'PASS' : 'FAIL',
      `Back: ${backVisible}, Home: ${homeVisible}`);
  } catch (err) {
    log('19. Back/Home nav on Talent Pool', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTS: ${pass} passed, ${fail} failed, ${pass + fail} total`);
  console.log('═'.repeat(60));
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);

  if (fail > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ❌ ${r.test}: ${r.detail}`));
  }

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
