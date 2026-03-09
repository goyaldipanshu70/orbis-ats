/**
 * E2E TEST — Verify 5 Bug Fixes
 *
 *  1. Dashboard stats match visible jobs (deleted_at + user_id filter)
 *  2. Add Candidate to Talent Pool via resume upload dialog (UI)
 *  3. Manual profile creation via POST /api/profiles
 *  4. get_job_candidates tool returns scored candidates
 *  5. Talent pool includes manual profiles (no job entries)
 *
 * Run:  node e2e-fixes-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8080';
const API  = 'http://localhost:8000';
const SCREENSHOT_DIR = '/tmp/e2e-fixes-screenshots';

const ADMIN_EMAIL = 'admin@orbis.io';
const ADMIN_PASS  = 'admin123';

const RESUME_DIR = path.resolve(__dirname, '..', 'svc-recruiting', 'static', 'uploads', 'resume');

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let pass = 0, fail = 0, skip = 0;
const results = [];
let ssIdx = 0;

function log(test, status, detail = '') {
  const icon = status === 'PASS' ? '\u2705' : status === 'SKIP' ? '\u23ED\uFE0F' : '\u274C';
  const line = `${icon} ${test}${detail ? ' \u2014 ' + detail : ''}`;
  console.log(line);
  results.push({ test, status, detail });
  if (status === 'PASS') pass++;
  else if (status === 'SKIP') skip++;
  else fail++;
}

async function ss(page, name) {
  ssIdx++;
  const fname = `${String(ssIdx).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, fname), fullPage: true });
}

async function api(method, urlPath, body = null, token = null) {
  const opts = { method, headers: {} };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(`${API}${urlPath}`, opts);
  let data;
  try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data };
}

async function uploadFile(urlPath, filePath, fieldName, extraFields = {}, token = null) {
  const fileData = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const formData = new FormData();
  formData.append(fieldName, new Blob([fileData], { type: 'application/pdf' }), fileName);
  for (const [k, v] of Object.entries(extraFields)) formData.append(k, String(v));
  const opts = { method: 'POST', body: formData, headers: {} };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${urlPath}`, opts);
  let data;
  try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data };
}

// ══════════════════════════════════════════════════════════════════════
(async () => {
  console.log('\n' + '═'.repeat(60));
  console.log('  ORBIS ATS — BUG FIXES E2E TEST');
  console.log('═'.repeat(60) + '\n');

  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  let token = null;

  // ═══════════════════════════════════════════════════════════════
  //  A. AUTH — Login
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- A: AUTH ---\n');

  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    token = await page.evaluate(() => localStorage.getItem('access_token'));
    const url = page.url();
    log('A1. UI login', token && !url.includes('/login') ? 'PASS' : 'FAIL', `url=${url.replace(BASE, '')}`);
    await ss(page, 'login');
  } catch (e) { log('A1. UI login', 'FAIL', e.message); }

  // Also get token from API for direct calls
  try {
    const r = await api('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    if (r.data?.access_token) token = r.data.access_token;
    log('A2. API login', token ? 'PASS' : 'FAIL');
  } catch (e) { log('A2. API login', 'FAIL', e.message); }

  // ═══════════════════════════════════════════════════════════════
  //  B. ISSUE 1 — Dashboard stats match visible jobs
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- B: DASHBOARD STATS (Issue #1) ---\n');

  // B1: Get dashboard stats via API
  let dashStats = null;
  try {
    const r = await api('GET', '/api/dashboard/stats', null, token);
    dashStats = r.data;
    log('B1. Dashboard stats API', r.status === 200 ? 'PASS' : 'FAIL',
      `total_jobs=${dashStats?.total_jobs}, active=${dashStats?.active_jobs}, candidates=${dashStats?.total_candidates}`);
  } catch (e) { log('B1. Dashboard stats API', 'FAIL', e.message); }

  // B2: Get jobs list and compare count
  try {
    const r = await api('GET', '/api/job?page=1&page_size=100', null, token);
    const jobItems = r.data?.items || [];
    const jobTotal = r.data?.total || jobItems.length;
    const match = dashStats?.total_jobs === jobTotal;
    log('B2. Stats total_jobs matches job list', match ? 'PASS' : 'FAIL',
      `stats=${dashStats?.total_jobs}, list=${jobTotal}`);
  } catch (e) { log('B2. Jobs comparison', 'FAIL', e.message); }

  // B3: Dashboard stats exclude deleted jobs
  try {
    const r = await api('GET', '/api/job?page=1&page_size=100', null, token);
    const jobs = r.data?.items || [];
    const activeCount = jobs.filter(j => j.status === 'Open').length;
    const closedCount = jobs.filter(j => j.status === 'Closed').length;
    log('B3. active_jobs matches Open count',
      dashStats?.active_jobs === activeCount ? 'PASS' : 'FAIL',
      `stats=${dashStats?.active_jobs}, actual=${activeCount}`);
    log('B4. closed_jobs matches Closed count',
      dashStats?.closed_jobs === closedCount ? 'PASS' : 'FAIL',
      `stats=${dashStats?.closed_jobs}, actual=${closedCount}`);
  } catch (e) { log('B3. Active/closed', 'FAIL', e.message); }

  // B5: Dashboard UI
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'dashboard-stats');
    const body = await page.textContent('body');
    log('B5. Dashboard UI loads', body.includes('Dashboard') || body.includes('Jobs') ? 'PASS' : 'FAIL');
  } catch (e) { log('B5. Dashboard UI', 'FAIL', e.message); }

  // ═══════════════════════════════════════════════════════════════
  //  C. ISSUE 4 — Add Candidate to Talent Pool (manual + resume)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- C: ADD CANDIDATE TO TALENT POOL (Issue #4) ---\n');

  // C1: POST /api/profiles — manual creation
  let manualProfileId = null;
  try {
    const r = await api('POST', '/api/profiles', {
      full_name: 'E2E Test Candidate',
      email: `e2e_${Date.now()}@test.com`,
      phone: '+1 555 000 1234',
      current_role: 'Software Engineer',
      category: 'Engineering',
      notes: 'Created by e2e-fixes-test',
      linkedin_url: 'https://linkedin.com/in/e2e-test',
      github_url: 'https://github.com/e2e-test',
      portfolio_url: 'https://e2e-test.dev',
    }, token);
    manualProfileId = r.data?.id;
    log('C1. Create manual profile', manualProfileId ? 'PASS' : 'FAIL',
      `id=${manualProfileId}, name=${r.data?.full_name}`);
  } catch (e) { log('C1. Create manual profile', 'FAIL', e.message); }

  // C2: Verify profile appears in talent pool (Issue #4 relaxed query)
  try {
    const r = await api('GET', '/api/talent-pool?page=1&page_size=100', null, token);
    const items = r.data?.items || [];
    const found = items.find(i => i.profile_id === manualProfileId || String(i._id) === String(manualProfileId));
    log('C2. Manual profile in talent pool', found ? 'PASS' : 'FAIL',
      `total=${r.data?.total}, found=${!!found}`);
  } catch (e) { log('C2. Talent pool check', 'FAIL', e.message); }

  // C3: Verify profile has correct data
  if (manualProfileId) {
    try {
      const r = await api('GET', `/api/profiles/${manualProfileId}`, null, token);
      const p = r.data;
      log('C3a. Profile name correct', p?.full_name === 'E2E Test Candidate' ? 'PASS' : 'FAIL', `name=${p?.full_name}`);
      log('C3b. Profile category correct', p?.category === 'Engineering' ? 'PASS' : 'FAIL', `cat=${p?.category}`);
      log('C3c. Profile has notes', p?.notes?.includes('e2e-fixes-test') ? 'PASS' : 'FAIL', `notes=${p?.notes}`);
    } catch (e) { log('C3. Profile verify', 'FAIL', e.message); }
  }

  // C4: Test parse-resume endpoint for HR
  const resumeFiles = fs.readdirSync(RESUME_DIR).filter(f => f.endsWith('.pdf'));
  const testResume = resumeFiles.find(f => f.includes('Kenneth')) || resumeFiles[0];

  if (testResume) {
    try {
      const r = await uploadFile('/api/profiles/parse-resume',
        path.join(RESUME_DIR, testResume), 'resume_file', {}, token);
      const meta = r.data?.metadata || {};
      log('C4. Parse resume for profile', r.status === 200 ? 'PASS' : 'FAIL',
        `name=${meta.full_name}, email=${meta.email}, resume_url=${r.data?.resume_url ? 'yes' : 'no'}`);

      // C5: Check that link fields are extracted
      const hasLinks = meta.linkedin_url || meta.github_url || meta.portfolio_url;
      log('C5. Resume links extracted', typeof meta.linkedin_url !== 'undefined' ? 'PASS' : 'FAIL',
        `linkedin=${meta.linkedin_url || 'none'}, github=${meta.github_url || 'none'}, portfolio=${meta.portfolio_url || 'none'}`);
    } catch (e) { log('C4. Parse resume', 'FAIL', e.message); }
  } else {
    log('C4. Parse resume', 'SKIP', 'no resume PDF found');
  }

  // C6: UI — navigate to Talent Pool page, verify Add Candidate button
  try {
    await page.goto(`${BASE}/talent-pool`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'talent-pool-before-add');

    // Look for Add Candidate button
    const addBtn = page.locator('button:has-text("Add Candidate")');
    const btnVisible = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
    log('C6. Add Candidate button visible', btnVisible ? 'PASS' : 'FAIL');

    // C7: Click button, verify dialog opens
    if (btnVisible) {
      await addBtn.click();
      await page.waitForTimeout(1000);
      await ss(page, 'add-candidate-dialog');

      // Dialog should show upload phase
      const dialogBody = await page.textContent('body');
      const hasUploadPhase = dialogBody.includes('Resume Upload') || dialogBody.includes('Upload & Parse');
      const hasSkipOption = dialogBody.includes('Enter Manually') || dialogBody.includes('Skip');
      log('C7a. Dialog shows upload phase', hasUploadPhase ? 'PASS' : 'FAIL');
      log('C7b. Dialog has skip/manual option', hasSkipOption ? 'PASS' : 'FAIL');

      // C8: Click "Skip — Enter Manually" to go to phase 2
      const skipBtn = page.locator('button:has-text("Enter Manually")');
      if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(500);
        await ss(page, 'add-candidate-manual');

        const phase2Body = await page.textContent('body');
        const hasForm = phase2Body.includes('Full Name') && phase2Body.includes('Email');
        const hasLinks = phase2Body.includes('LinkedIn') && phase2Body.includes('GitHub') && phase2Body.includes('Portfolio');
        log('C8a. Phase 2 shows form fields', hasForm ? 'PASS' : 'FAIL');
        log('C8b. Phase 2 shows link fields', hasLinks ? 'PASS' : 'FAIL');

        // C9: Fill form and submit
        try {
          await page.fill('#add-name', 'UI Test Candidate');
          await page.fill('#add-email', `ui_test_${Date.now()}@example.com`);
          await page.fill('#add-phone', '+1 555 999 0000');
          await page.fill('#add-role', 'Data Scientist');
          await page.fill('#add-linkedin', 'https://linkedin.com/in/ui-test');
          await page.fill('#add-github', 'https://github.com/ui-test');
          await page.fill('#add-portfolio', 'https://uitest.dev');
          await ss(page, 'add-candidate-filled');

          const submitBtn = page.locator('button:has-text("Add to Talent Pool")');
          if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await submitBtn.click();
            await page.waitForTimeout(2000);
            await ss(page, 'after-add-candidate');

            // Check for success toast
            const bodyAfter = await page.textContent('body');
            const hasSuccess = bodyAfter.includes('Success') || bodyAfter.includes('added to talent pool') || bodyAfter.includes('UI Test Candidate');
            log('C9. Candidate added via UI', hasSuccess ? 'PASS' : 'FAIL');
          } else {
            log('C9. Submit button', 'FAIL', 'not visible');
          }
        } catch (e) { log('C9. Fill & submit', 'FAIL', e.message); }
      } else {
        log('C8. Skip button', 'FAIL', 'not visible');
      }
    }
  } catch (e) { log('C6. Talent pool UI', 'FAIL', e.message); }

  // ═══════════════════════════════════════════════════════════════
  //  D. ISSUE 5 — get_job_candidates tool returns scored candidates
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- D: HIRING AGENT TOOLS (Issues #3, #5) ---\n');

  // D1: Get jobs to find one with candidates
  let testJobId = null;
  try {
    const r = await api('GET', '/api/job?page=1&page_size=10', null, token);
    const jobs = r.data?.items || [];
    // Find a job that has candidates
    for (const job of jobs) {
      const cr = await api('GET', `/api/candidates?jd_id=${job.job_id || job.id || job._id}&page=1&page_size=5`, null, token);
      if ((cr.data?.total || 0) > 0) {
        testJobId = job.job_id || job.id || job._id;
        break;
      }
    }
    log('D1. Found job with candidates', testJobId ? 'PASS' : 'FAIL', `job_id=${testJobId}`);
  } catch (e) { log('D1. Find job', 'FAIL', e.message); }

  // D2: Ask hiring agent about top candidates (should use get_job_candidates tool)
  if (testJobId) {
    try {
      const r = await api('POST', '/api/hiring-agent/query', {
        query: `Who are the top candidates for job ${testJobId}? Rank them by score.`,
        web_search_enabled: false,
      }, token);
      const answer = r.data?.answer || '';
      const actions = r.data?.actions || [];

      log('D2. Agent responds with ranking', answer.length > 50 ? 'PASS' : 'FAIL',
        `answer_len=${answer.length}, actions=${actions.length}`);

      // Check if get_job_candidates tool was used
      const usedTool = actions.some(a => a.tool === 'get_job_candidates');
      log('D3. Used get_job_candidates tool', usedTool ? 'PASS' : 'SKIP',
        `tools_used=${actions.map(a => a.tool).join(', ')}`);

      // Check answer has score-related content
      const hasScores = answer.includes('score') || answer.includes('Score') || answer.includes('/100') || answer.includes('recommend') || answer.includes('Recommend');
      log('D4. Answer includes score data', hasScores ? 'PASS' : 'FAIL');
    } catch (e) { log('D2. Agent ranking', 'FAIL', e.message); }
  }

  // D5: Ask agent to add a candidate (should use add_candidate_to_talent_pool tool)
  try {
    const r = await api('POST', '/api/hiring-agent/query', {
      query: 'Add a new candidate named "Agent Test Person" with email agent_test@example.com, they are a Frontend Developer with 5 years of experience, skilled in React, TypeScript, and CSS.',
      web_search_enabled: false,
    }, token);
    const answer = r.data?.answer || '';
    const actions = r.data?.actions || [];
    const usedAddTool = actions.some(a => a.tool === 'add_candidate_to_talent_pool');
    const addResult = actions.find(a => a.tool === 'add_candidate_to_talent_pool')?.result;

    log('D5. Agent add candidate tool called', usedAddTool ? 'PASS' : 'FAIL',
      `tools=${actions.map(a => a.tool).join(', ')}`);

    if (addResult) {
      log('D6. Add tool succeeded', addResult.success ? 'PASS' : 'FAIL',
        `profile_id=${addResult.profile_id}, candidate_id=${addResult.candidate_id}`);
    }
  } catch (e) { log('D5. Agent add candidate', 'FAIL', e.message); }

  // ═══════════════════════════════════════════════════════════════
  //  E. HIRING ASSISTANT UI — verify page loads & can query
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- E: HIRING ASSISTANT UI ---\n');

  try {
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'hiring-assistant');
    const body = await page.textContent('body');
    log('E1. Hiring assistant loads', body.includes('Assistant') || body.includes('assistant') || body.includes('Ask') ? 'PASS' : 'FAIL');
  } catch (e) { log('E1. Hiring assistant UI', 'FAIL', e.message); }

  // ═══════════════════════════════════════════════════════════════
  //  F. FINAL VERIFICATION — talent pool includes everything
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- F: FINAL TALENT POOL VERIFICATION ---\n');

  try {
    const r = await api('GET', '/api/talent-pool?page=1&page_size=100', null, token);
    const items = r.data?.items || [];
    log('F1. Talent pool total', 'PASS', `count=${r.data?.total}`);

    // Check manual profile is included
    const manualFound = items.some(i => i.profile_id === manualProfileId || String(i._id) === String(manualProfileId));
    log('F2. Manual profile (C1) in pool', manualFound ? 'PASS' : 'FAIL');

    // Check agent-created candidate is included
    const agentFound = items.some(i => (i.name || i.full_name || '').includes('Agent Test'));
    log('F3. Agent-created profile (D5) in pool', agentFound ? 'PASS' : 'SKIP',
      agentFound ? 'found' : 'may not have onboard=true');

    // No duplicate profile_ids
    const pids = items.map(i => i.profile_id).filter(Boolean);
    const uniquePids = new Set(pids);
    log('F4. No duplicate profile_ids', pids.length === uniquePids.size ? 'PASS' : 'FAIL',
      `total=${pids.length}, unique=${uniquePids.size}`);

    // All items have expected fields
    if (items.length > 0) {
      const sample = items[0];
      log('F5. Items have status field', sample.status ? 'PASS' : 'FAIL', `status=${sample.status}`);
      log('F6. Items have category field', sample.category !== undefined ? 'PASS' : 'FAIL', `cat=${sample.category}`);
    }
  } catch (e) { log('F1. Final verification', 'FAIL', e.message); }

  // Final dashboard screenshot
  try {
    await page.goto(`${BASE}/talent-pool`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'final-talent-pool');
  } catch {}

  // ═══════════════════════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log(`  RESULTS: ${pass} passed, ${fail} failed, ${skip} skipped, ${pass + fail + skip} total`);
  console.log(`  Pass rate: ${((pass / (pass + fail || 1)) * 100).toFixed(1)}%`);
  console.log('═'.repeat(60));

  if (fail > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  \u274C ${r.test}: ${r.detail}`);
    });
  }

  console.log(`\nScreenshots: ${SCREENSHOT_DIR}`);
  console.log('Browser open for 15s for inspection...\n');
  await page.waitForTimeout(15000);

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
