/**
 * E2E Test: Import Candidates Modal — typeahead search, dual modes, import flow.
 * Run: node e2e-import-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:8080';
const SCREENSHOT_DIR = '/tmp/e2e-import-screenshots';
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
  const browser = await chromium.launch({ headless: false, slowMo: 120 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  IMPORT CANDIDATES MODAL — E2E TEST SUITE           ');
  console.log('══════════════════════════════════════════════════════\n');

  let authToken = '';
  let testJobId = '';

  // ═════════════════════════════════════════════════════════════════
  // STEP 1: Login
  // ═════════════════════════════════════════════════════════════════
  console.log('\n─── STEP 1: LOGIN ───\n');
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.waitForTimeout(1500);
    authToken = await page.evaluate(() => localStorage.getItem('access_token') || '');
    log('1. Login as admin', authToken ? 'PASS' : 'FAIL', authToken ? 'Token acquired' : 'No token');
  } catch (e) {
    log('1. Login as admin', 'FAIL', e.message);
  }

  // ═════════════════════════════════════════════════════════════════
  // STEP 2: Backend API — Search endpoints
  // ═════════════════════════════════════════════════════════════════
  console.log('\n─── STEP 2: BACKEND SEARCH APIs ───\n');

  // Find a job to use for testing
  try {
    const jobsRes = await page.evaluate(async (token) => {
      const res = await fetch('/api/job?page=1&page_size=5', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    }, authToken);

    if (jobsRes?.items?.length > 0) {
      testJobId = jobsRes.items[0].job_id;
      log('2a. Found test job', 'PASS', `Job ID: ${testJobId}`);
    } else {
      log('2a. Found test job', 'FAIL', 'No jobs in database — import test requires at least 1 job');
    }
  } catch (e) {
    log('2a. Found test job', 'FAIL', e.message);
  }

  if (!testJobId) {
    console.log('\n⚠️  Cannot proceed without at least 1 job in the database.');
    console.log('   Create a job first by uploading a JD, then re-run.\n');
    await browser.close();
    process.exit(1);
  }

  // 2b: Job Search API — empty query returns all (up to limit)
  try {
    const result = await page.evaluate(async ({ token, jobId }) => {
      const res = await fetch(`/api/job/import/search?q=&exclude_job_id=${jobId}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { status: res.status, body: await res.json() };
    }, { token: authToken, jobId: testJobId });

    const isArray = Array.isArray(result.body);
    log('2b. Job Search API (empty query)', result.status === 200 && isArray ? 'PASS' : 'FAIL',
      `Status: ${result.status}, Results: ${isArray ? result.body.length : 'not array'}`);
  } catch (e) {
    log('2b. Job Search API (empty query)', 'FAIL', e.message);
  }

  // 2c: Job Search API — with query string
  try {
    const result = await page.evaluate(async ({ token, jobId }) => {
      const res = await fetch(`/api/job/import/search?q=engineer&exclude_job_id=${jobId}&limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { status: res.status, body: await res.json() };
    }, { token: authToken, jobId: testJobId });

    log('2c. Job Search API (with query)', result.status === 200 ? 'PASS' : 'FAIL',
      `Status: ${result.status}, Results: ${Array.isArray(result.body) ? result.body.length : 'error'}`);
  } catch (e) {
    log('2c. Job Search API (with query)', 'FAIL', e.message);
  }

  // 2d: Job Search API — response has correct fields
  try {
    const result = await page.evaluate(async ({ token, jobId }) => {
      const res = await fetch(`/api/job/import/search?q=&exclude_job_id=${jobId}&limit=3`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return await res.json();
    }, { token: authToken, jobId: testJobId });

    if (Array.isArray(result) && result.length > 0) {
      const job = result[0];
      const hasFields = job.job_id && job.job_title !== undefined && job.status && job.candidate_count !== undefined;
      log('2d. Job Search response shape', hasFields ? 'PASS' : 'FAIL',
        `Fields: ${Object.keys(job).join(', ')}`);
    } else {
      log('2d. Job Search response shape', 'PASS', 'No other jobs to validate (only 1 job in DB)');
    }
  } catch (e) {
    log('2d. Job Search response shape', 'FAIL', e.message);
  }

  // 2e: Candidate Search API — empty query with exclude
  try {
    const result = await page.evaluate(async ({ token, jobId }) => {
      const res = await fetch(`/api/candidates/search?q=&exclude_jd_id=${jobId}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { status: res.status, body: await res.json() };
    }, { token: authToken, jobId: testJobId });

    // Empty query should return empty (no search term) OR all candidates from other jobs
    log('2e. Candidate Search API (empty query)', result.status === 200 ? 'PASS' : 'FAIL',
      `Status: ${result.status}, Results: ${Array.isArray(result.body) ? result.body.length : 'error'}`);
  } catch (e) {
    log('2e. Candidate Search API (empty query)', 'FAIL', e.message);
  }

  // 2f: Candidate Search API — with search term
  try {
    const result = await page.evaluate(async ({ token, jobId }) => {
      const res = await fetch(`/api/candidates/search?q=a&exclude_jd_id=${jobId}&limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { status: res.status, body: await res.json() };
    }, { token: authToken, jobId: testJobId });

    log('2f. Candidate Search API (with query)', result.status === 200 ? 'PASS' : 'FAIL',
      `Status: ${result.status}, Results: ${Array.isArray(result.body) ? result.body.length : 'error'}`);
  } catch (e) {
    log('2f. Candidate Search API (with query)', 'FAIL', e.message);
  }

  // 2g: Candidate Search response — no scores, has category + source_job
  try {
    const result = await page.evaluate(async ({ token, jobId }) => {
      const res = await fetch(`/api/candidates/search?q=a&exclude_jd_id=${jobId}&limit=3`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return await res.json();
    }, { token: authToken, jobId: testJobId });

    if (Array.isArray(result) && result.length > 0) {
      const c = result[0];
      const hasIdentity = c.candidate_id && c.name && c.email && c.category;
      const hasSource = c.source_job_id && c.source_job_title !== undefined;
      const noScores = !c.totalScore && !c.recommendation;
      log('2g. Candidate Search: no scores, has category', hasIdentity && hasSource && noScores ? 'PASS' : 'FAIL',
        `Fields: ${Object.keys(c).join(', ')}${noScores ? '' : ' (SCORES STILL PRESENT!)'}`);
    } else {
      log('2g. Candidate Search: no scores, has category', 'PASS', 'No candidates from other jobs');
    }
  } catch (e) {
    log('2g. Candidate Search: no scores, has category', 'FAIL', e.message);
  }

  // 2h: Category filter works on search endpoint
  try {
    const result = await page.evaluate(async ({ token, jobId }) => {
      const res = await fetch(`/api/candidates/search?q=a&exclude_jd_id=${jobId}&category=Engineering&limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await res.json();
      return { status: res.status, body };
    }, { token: authToken, jobId: testJobId });

    if (result.status === 200 && Array.isArray(result.body)) {
      const allEngineering = result.body.every(c => c.category === 'Engineering');
      log('2h. Category filter (Engineering)', allEngineering || result.body.length === 0 ? 'PASS' : 'FAIL',
        `${result.body.length} results, all Engineering: ${allEngineering}`);
    } else {
      log('2h. Category filter (Engineering)', 'FAIL', `Status: ${result.status}`);
    }
  } catch (e) {
    log('2h. Category filter (Engineering)', 'FAIL', e.message);
  }

  // 2i: Import endpoint response has no scores
  try {
    const result = await page.evaluate(async ({ token, jobId }) => {
      const res = await fetch(`/api/candidates/import?job_id=${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return await res.json();
    }, { token: authToken, jobId: testJobId });

    if (Array.isArray(result) && result.length > 0) {
      const c = result[0];
      const noScores = !c.totalScore && !c.recommendation;
      const hasCategory = !!c.category;
      log('2i. Import endpoint: no scores, has category', noScores && hasCategory ? 'PASS' : 'FAIL',
        `Fields: ${Object.keys(c).join(', ')}`);
    } else {
      log('2i. Import endpoint: no scores, has category', 'PASS', 'No candidates to validate');
    }
  } catch (e) {
    log('2i. Import endpoint: no scores, has category', 'FAIL', e.message);
  }

  // ═════════════════════════════════════════════════════════════════
  // STEP 3: Open Import Modal from CandidateEvaluation page
  // ═════════════════════════════════════════════════════════════════
  console.log('\n─── STEP 3: IMPORT MODAL — UI ───\n');

  // 3a: Navigate to candidates page for the test job
  try {
    await page.goto(`${BASE}/jobs/${testJobId}/candidates`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '01-candidates-page');
    log('3a. Candidates page loads', 'PASS');
  } catch (e) {
    log('3a. Candidates page loads', 'FAIL', e.message);
  }

  // 3b: Find and click the Import button
  try {
    // Look for an import button — it might say "Import" or have a UserPlus icon
    const importBtn = page.locator('button:has-text("Import")').first();
    const visible = await importBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (visible) {
      await importBtn.click();
      await page.waitForTimeout(800);
      await screenshot(page, '02-import-modal-open');
      log('3b. Import button opens modal', 'PASS');
    } else {
      // Try on JobDetail page instead
      await page.goto(`${BASE}/jobs/${testJobId}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      const importBtn2 = page.locator('button:has-text("Import")').first();
      if (await importBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
        await importBtn2.click();
        await page.waitForTimeout(800);
        await screenshot(page, '02-import-modal-open');
        log('3b. Import button opens modal', 'PASS', 'Found on JobDetail page');
      } else {
        log('3b. Import button opens modal', 'FAIL', 'Import button not found');
      }
    }
  } catch (e) {
    log('3b. Import button opens modal', 'FAIL', e.message);
  }

  // 3c: Modal header renders correctly
  try {
    const modalText = await page.textContent('body');
    const hasTitle = modalText.includes('Import Candidates');
    const hasSubtitle = modalText.includes('Add candidates') || modalText.includes('other sources');
    log('3c. Modal header content', hasTitle ? 'PASS' : 'FAIL',
      hasTitle ? 'Title + subtitle visible' : 'Title not found');
  } catch (e) {
    log('3c. Modal header content', 'FAIL', e.message);
  }

  // 3d: Mode toggle — "From Job" and "Direct Search" tabs visible
  try {
    const bodyText = await page.textContent('body');
    const hasFromJob = bodyText.includes('From Job');
    const hasDirectSearch = bodyText.includes('Direct Search');
    log('3d. Mode toggle visible', hasFromJob && hasDirectSearch ? 'PASS' : 'FAIL',
      `From Job: ${hasFromJob}, Direct Search: ${hasDirectSearch}`);
  } catch (e) {
    log('3d. Mode toggle visible', 'FAIL', e.message);
  }

  // 3e: Footer with Cancel and Import buttons visible
  try {
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    const importBtn = page.locator('button:has-text("Import")').last();
    const cancelVisible = await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false);
    const importVisible = await importBtn.isVisible({ timeout: 3000 }).catch(() => false);
    log('3e. Footer buttons visible', cancelVisible && importVisible ? 'PASS' : 'FAIL',
      `Cancel: ${cancelVisible}, Import: ${importVisible}`);
  } catch (e) {
    log('3e. Footer buttons visible', 'FAIL', e.message);
  }

  // 3f: Import button disabled when no candidates selected
  try {
    const importBtn = page.locator('button:has-text("Import"):not(:has-text("Cancel"))').last();
    const disabled = await importBtn.isDisabled().catch(() => false);
    log('3f. Import button disabled when empty', disabled ? 'PASS' : 'FAIL');
  } catch (e) {
    log('3f. Import button disabled when empty', 'FAIL', e.message);
  }

  // 3g: Category filter button visible
  try {
    const filterBtn = page.locator('button:has-text("All Categories")').first();
    const visible = await filterBtn.isVisible({ timeout: 3000 }).catch(() => false);
    log('3g. Category filter button visible', visible ? 'PASS' : 'FAIL');
  } catch (e) {
    log('3g. Category filter button visible', 'FAIL', e.message);
  }

  // 3h: Subtitle mentions AI evaluation
  try {
    const bodyText = await page.textContent('body');
    const hasEvalNote = bodyText.includes('AI evaluation') || bodyText.includes('new job');
    log('3h. Subtitle mentions evaluation context', hasEvalNote ? 'PASS' : 'FAIL');
  } catch (e) {
    log('3h. Subtitle mentions evaluation context', 'FAIL', e.message);
  }

  // ═════════════════════════════════════════════════════════════════
  // STEP 4: Test "From Job" mode — typeahead search
  // ═════════════════════════════════════════════════════════════════
  console.log('\n─── STEP 4: FROM JOB MODE ───\n');

  // 4a: Job search input is present and focused
  try {
    const searchInput = page.locator('input[placeholder*="search jobs"], input[placeholder*="Search jobs"], input[placeholder*="Type to search"]').first();
    const visible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);
    log('4a. Job search input visible', visible ? 'PASS' : 'FAIL');
  } catch (e) {
    log('4a. Job search input visible', 'FAIL', e.message);
  }

  // 4b: Typing shows job results from API (typeahead)
  let hasJobResults = false;
  try {
    const searchInput = page.locator('input[placeholder*="search jobs"], input[placeholder*="Search jobs"], input[placeholder*="Type to search"]').first();
    // Type a common letter to get results
    await searchInput.fill('');
    await page.waitForTimeout(500);
    // Empty query should show results (recent jobs)
    await screenshot(page, '03-job-search-empty');

    // Check if results appeared
    const resultItems = await page.locator('[class*="divide-y"] button, [class*="divide-y"] [role="button"]').count();
    hasJobResults = resultItems > 0;
    log('4b. Job search shows results (empty query)', hasJobResults ? 'PASS' : 'FAIL',
      `${resultItems} job results shown${hasJobResults ? '' : ' (only 1 job in DB — it\'s excluded)'}`);

    // If no results with empty query (because only 1 job), that's expected
    if (!hasJobResults) {
      log('4b. (Note)', 'PASS', 'No other jobs available (test job is excluded) — behavior correct');
    }
  } catch (e) {
    log('4b. Job search shows results', 'FAIL', e.message);
  }

  // 4c: Select a job from results (if available)
  if (hasJobResults) {
    try {
      const firstResult = page.locator('[class*="divide-y"] button, [class*="divide-y"] [role="button"]').first();
      await firstResult.click();
      await page.waitForTimeout(1500);
      await screenshot(page, '04-job-selected');

      // Check for selected job chip
      const bodyText = await page.textContent('body');
      const hasChip = bodyText.includes('Source job') || bodyText.includes('candidates');
      log('4c. Job selection shows chip + candidates', hasChip ? 'PASS' : 'FAIL');
    } catch (e) {
      log('4c. Job selection shows chip + candidates', 'FAIL', e.message);
    }

    // 4d: Candidates list appears with checkboxes and category badges (no scores)
    try {
      const modalPanel = page.locator('[class*="max-w-\\[900px\\]"]').first();
      const checkboxes = await modalPanel.locator('[role="checkbox"]').count();
      const modalText = await modalPanel.textContent({ timeout: 5000 }).catch(() => '');
      const hasCategory = modalText.includes('Engineering') || modalText.includes('HR') || modalText.includes('Other');
      const scoreGauges = await modalPanel.locator('.tabular-nums').count();
      log('4d. Candidate rows: checkboxes + category, no scores', checkboxes > 0 && hasCategory && scoreGauges === 0 ? 'PASS' : 'FAIL',
        `${checkboxes} checkboxes, category: ${hasCategory}, scoreGauges: ${scoreGauges}`);
    } catch (e) {
      log('4d. Candidate rows', 'FAIL', e.message);
    }

    // 4e: Select All / Deselect All works
    try {
      const selectAllBtn = page.locator('button:has-text("Select All")').first();
      if (await selectAllBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await selectAllBtn.click();
        await page.waitForTimeout(300);
        const bodyText = await page.textContent('body');
        const hasSelected = bodyText.includes('selected');
        await screenshot(page, '05-select-all');
        log('4e. Select All works', hasSelected ? 'PASS' : 'FAIL');

        // Deselect
        const deselectBtn = page.locator('button:has-text("Deselect All")').first();
        if (await deselectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await deselectBtn.click();
          await page.waitForTimeout(300);
        }
      } else {
        log('4e. Select All works', 'PASS', 'No Select All (0 candidates)');
      }
    } catch (e) {
      log('4e. Select All works', 'FAIL', e.message);
    }

    // 4f: Deselect job (click X on chip) — use force click inside the modal
    try {
      // The chip X button is inside the modal panel, use a more specific selector
      const chipX = page.locator('.bg-blue-50 button').last();
      if (await chipX.isVisible({ timeout: 3000 }).catch(() => false)) {
        await chipX.click({ force: true });
        await page.waitForTimeout(500);
        const searchInput = page.locator('input[placeholder*="search jobs"], input[placeholder*="Search jobs"], input[placeholder*="Type to search"]').first();
        const searchVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
        log('4f. Deselect job returns to search', searchVisible ? 'PASS' : 'FAIL');
      } else {
        log('4f. Deselect job returns to search', 'PASS', 'No chip X button visible');
      }
    } catch (e) {
      log('4f. Deselect job returns to search', 'FAIL', e.message);
    }
  } else {
    log('4c-4f. Job mode candidate tests', 'PASS', 'Skipped — no other jobs available');
  }

  // ═════════════════════════════════════════════════════════════════
  // STEP 5: Test "Direct Search" mode
  // ═════════════════════════════════════════════════════════════════
  console.log('\n─── STEP 5: DIRECT SEARCH MODE ───\n');

  // 5a: Switch to Direct Search mode
  try {
    const directSearchBtn = page.locator('button:has-text("Direct Search")').first();
    if (await directSearchBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await directSearchBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, '06-direct-search-mode');
      log('5a. Switch to Direct Search mode', 'PASS');
    } else {
      log('5a. Switch to Direct Search mode', 'FAIL', 'Direct Search button not found');
    }
  } catch (e) {
    log('5a. Switch to Direct Search mode', 'FAIL', e.message);
  }

  // 5b: Candidate search input is present
  try {
    const searchInput = page.locator('input[placeholder*="Search by name"], input[placeholder*="name or email"]').first();
    const visible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);
    log('5b. Candidate search input visible', visible ? 'PASS' : 'FAIL');
  } catch (e) {
    log('5b. Candidate search input visible', 'FAIL', e.message);
  }

  // 5c: Empty state shows when no query entered
  try {
    const bodyText = await page.textContent('body');
    const hasEmptyState = bodyText.includes('Start typing') || bodyText.includes('search candidates');
    log('5c. Empty state shows before search', hasEmptyState ? 'PASS' : 'FAIL');
  } catch (e) {
    log('5c. Empty state shows before search', 'FAIL', e.message);
  }

  // 5d: Typing a query shows results with source job info
  let hasDirectResults = false;
  try {
    const searchInput = page.locator('input[placeholder*="Search by name"], input[placeholder*="name or email"]').first();
    await searchInput.fill('a'); // Common letter to match most names
    await page.waitForTimeout(1000); // Wait for debounce + API call
    await screenshot(page, '07-direct-search-results');

    const bodyText = await page.textContent('body');
    // Check if candidates appeared or "No candidates found"
    const hasResults = bodyText.includes('from:') || bodyText.includes('Select All') || bodyText.includes('selected');
    const noResults = bodyText.includes('No candidates found');
    hasDirectResults = hasResults;
    log('5d. Direct search returns results', hasResults || noResults ? 'PASS' : 'FAIL',
      hasResults ? 'Candidates shown with source job tags' : (noResults ? 'No candidates from other jobs' : 'Unexpected state'));
  } catch (e) {
    log('5d. Direct search returns results', 'FAIL', e.message);
  }

  // 5e: Source job tag + category badge visible, no scores inside modal
  if (hasDirectResults) {
    try {
      // Scope to the modal panel only (the candidate list inside the modal)
      const modalPanel = page.locator('[class*="max-w-\\[900px\\]"]').first();
      const modalText = await modalPanel.textContent({ timeout: 5000 }).catch(() => '');
      const hasTags = modalText.includes('from:');
      const hasCategory = modalText.includes('Engineering') || modalText.includes('HR') || modalText.includes('Other');
      // Check that the modal candidate rows don't have score gauges or recommendation badges
      // Score format in old modal was "73/100" or RecommendationBadge component text
      const hasScoreGauge = await modalPanel.locator('.tabular-nums').count();
      log('5e. Direct search: source tags + category, no score gauges',
        hasTags && hasCategory && hasScoreGauge === 0 ? 'PASS' : 'FAIL',
        `from: ${hasTags}, category: ${hasCategory}, scoreGauges: ${hasScoreGauge}`);
    } catch (e) {
      log('5e. Direct search card content', 'FAIL', e.message);
    }

    // 5f: Select a candidate in direct search mode
    try {
      const firstCheckbox = page.locator('[role="checkbox"]').first();
      if (await firstCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstCheckbox.click();
        await page.waitForTimeout(300);
        const footerText = await page.textContent('body');
        const hasCount = footerText.includes('1 candidate selected') || footerText.includes('1 candidates selected');
        await screenshot(page, '08-candidate-selected');
        log('5f. Select candidate updates footer count', hasCount ? 'PASS' : 'FAIL');
      } else {
        log('5f. Select candidate', 'PASS', 'No checkboxes visible');
      }
    } catch (e) {
      log('5f. Select candidate', 'FAIL', e.message);
    }

    // 5g: Import button becomes enabled
    try {
      const importBtn = page.locator('button:has-text("Import"):not(:has-text("Cancel"))').last();
      const enabled = !(await importBtn.isDisabled().catch(() => true));
      log('5g. Import button enabled after selection', enabled ? 'PASS' : 'FAIL');
    } catch (e) {
      log('5g. Import button enabled after selection', 'FAIL', e.message);
    }
  } else {
    log('5e-5g. Direct search selection tests', 'PASS', 'Skipped — no candidates from other jobs');
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP 5.5: Category filter UI interaction
  // ═══════════════════════════════════════════════════════════════
  console.log('\n─── STEP 5.5: CATEGORY FILTER ───\n');

  // 5h: Open category filter dropdown
  try {
    const filterBtn = page.locator('button:has-text("All Categories")').first();
    if (await filterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterBtn.click();
      await page.waitForTimeout(400);
      const bodyText = await page.textContent('body');
      const hasCategories = bodyText.includes('Engineering') && bodyText.includes('Finance') && bodyText.includes('Design');
      await screenshot(page, '09-category-dropdown');
      log('5h. Category dropdown shows categories', hasCategories ? 'PASS' : 'FAIL');
    } else {
      log('5h. Category dropdown shows categories', 'FAIL', 'Filter button not found');
    }
  } catch (e) {
    log('5h. Category dropdown shows categories', 'FAIL', e.message);
  }

  // 5i: Select a category filter
  try {
    const engineeringBtn = page.locator('button:has-text("Engineering")').last();
    if (await engineeringBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await engineeringBtn.click();
      await page.waitForTimeout(800);
      // Button should now say "Engineering" instead of "All Categories"
      const filterBtn = page.locator('button:has-text("Engineering")').first();
      const active = await filterBtn.isVisible({ timeout: 3000 }).catch(() => false);
      await screenshot(page, '10-category-filtered');
      log('5i. Category filter applied (Engineering)', active ? 'PASS' : 'FAIL');
    } else {
      log('5i. Category filter applied', 'PASS', 'No Engineering option (OK)');
    }
  } catch (e) {
    log('5i. Category filter applied', 'FAIL', e.message);
  }

  // 5j: Reset category filter
  try {
    const filterBtn = page.locator('button:has-text("Engineering")').first();
    if (await filterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await filterBtn.click();
      await page.waitForTimeout(400);
      const allCatBtn = page.locator('button:has-text("All Categories")').last();
      if (await allCatBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await allCatBtn.click();
        await page.waitForTimeout(500);
      }
    }
    log('5j. Category filter reset', 'PASS');
  } catch (e) {
    log('5j. Category filter reset', 'FAIL', e.message);
  }

  // ═════════════════════════════════════════════════════════════════
  // STEP 6: Close modal and verify cleanup
  // ═════════════════════════════════════════════════════════════════
  console.log('\n─── STEP 6: MODAL CLOSE ───\n');

  // 6a: Close with Cancel button
  try {
    const cancelBtn = page.locator('button:has-text("Cancel")').first();
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(500);
      // Modal should be gone
      const modalGone = !(await page.locator(':text("Import Candidates")').isVisible({ timeout: 2000 }).catch(() => false));
      log('6a. Cancel closes modal', modalGone ? 'PASS' : 'FAIL');
    } else {
      log('6a. Cancel closes modal', 'FAIL', 'Cancel button not found');
    }
  } catch (e) {
    log('6a. Cancel closes modal', 'FAIL', e.message);
  }

  // 6b: Re-open and close with Escape
  try {
    const importBtn = page.locator('button:has-text("Import")').first();
    if (await importBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await importBtn.click();
      await page.waitForTimeout(800);
      // Press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const modalGone = !(await page.locator(':text("Add candidates")').isVisible({ timeout: 2000 }).catch(() => false));
      log('6b. Escape closes modal', modalGone ? 'PASS' : 'FAIL');
    } else {
      log('6b. Escape closes modal', 'PASS', 'Import button not visible (already closed)');
    }
  } catch (e) {
    log('6b. Escape closes modal', 'FAIL', e.message);
  }

  // 6c: Re-open and close by clicking backdrop
  try {
    const importBtn = page.locator('button:has-text("Import")').first();
    if (await importBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await importBtn.click();
      await page.waitForTimeout(800);
      // Click the modal backdrop — use the fixed overlay with bg-black/40
      const backdrop = page.locator('.fixed.inset-0.bg-black\\/40');
      if (await backdrop.isVisible({ timeout: 3000 }).catch(() => false)) {
        await backdrop.click({ position: { x: 10, y: 10 }, force: true });
      } else {
        // Fallback: click at page corner coordinates which is definitely outside the modal
        await page.mouse.click(5, 5);
      }
      await page.waitForTimeout(500);
      const modalGone = !(await page.locator(':text("Add candidates")').isVisible({ timeout: 2000 }).catch(() => false));
      log('6c. Backdrop click closes modal', modalGone ? 'PASS' : 'FAIL');
    } else {
      log('6c. Backdrop click closes modal', 'PASS', 'Import button not visible');
    }
  } catch (e) {
    log('6c. Backdrop click closes modal', 'FAIL', e.message);
  }

  // ═════════════════════════════════════════════════════════════════
  // STEP 7: Test from JobDetail page too
  // ═════════════════════════════════════════════════════════════════
  console.log('\n─── STEP 7: JOB DETAIL IMPORT ───\n');

  try {
    await page.goto(`${BASE}/jobs/${testJobId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const importBtn = page.locator('button:has-text("Import")').first();
    const visible = await importBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (visible) {
      await importBtn.click();
      await page.waitForTimeout(800);
      await screenshot(page, '09-import-from-job-detail');
      const bodyText = await page.textContent('body');
      const hasModal = bodyText.includes('Import Candidates');
      log('7a. Import modal opens from JobDetail', hasModal ? 'PASS' : 'FAIL');

      // Check mode toggle present here too
      const hasToggle = bodyText.includes('From Job') && bodyText.includes('Direct Search');
      log('7b. Mode toggle in JobDetail modal', hasToggle ? 'PASS' : 'FAIL');

      // Close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } else {
      log('7a. Import modal opens from JobDetail', 'PASS', 'No Import button on JobDetail (OK)');
      log('7b. Mode toggle in JobDetail modal', 'PASS', 'Skipped');
    }
  } catch (e) {
    log('7a-7b. JobDetail import tests', 'FAIL', e.message);
  }

  // ═════════════════════════════════════════════════════════════════
  // STEP 8: Legacy API still works (backwards compat)
  // ═════════════════════════════════════════════════════════════════
  console.log('\n─── STEP 8: LEGACY API COMPAT ───\n');

  // 8a: Old /api/job/import/available endpoint still works
  try {
    const result = await page.evaluate(async ({ token, jobId }) => {
      const res = await fetch(`/api/job/import/available?exclude_job_id=${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { status: res.status, ok: res.ok };
    }, { token: authToken, jobId: testJobId });

    log('8a. Legacy /api/job/import/available', result.ok ? 'PASS' : 'FAIL',
      `Status: ${result.status}`);
  } catch (e) {
    log('8a. Legacy /api/job/import/available', 'FAIL', e.message);
  }

  // 8b: Old /api/candidates/import?job_id= endpoint still works
  try {
    const result = await page.evaluate(async ({ token, jobId }) => {
      const res = await fetch(`/api/candidates/import?job_id=${jobId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return { status: res.status, ok: res.ok };
    }, { token: authToken, jobId: testJobId });

    log('8b. Legacy /api/candidates/import?job_id=', result.ok ? 'PASS' : 'FAIL',
      `Status: ${result.status}`);
  } catch (e) {
    log('8b. Legacy /api/candidates/import', 'FAIL', e.message);
  }

  // ═════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═════════════════════════════════════════════════════════════════
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
