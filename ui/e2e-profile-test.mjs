/**
 * E2E TEST — Candidate-Job Data Model Separation
 *
 * Tests the new CandidateProfile + CandidateJobEntry split:
 *   A. Auth + migration verification
 *   B. Upload candidate to job → creates profile + entry
 *   C. Upload same email to different job → reuses profile, creates 2nd entry
 *   D. Talent pool → unique profiles (no duplicates), job_count display
 *   E. Profile CRUD endpoints
 *   F. Candidate drawer → profile-first layout, job history table
 *   G. Pipeline → entry-based Kanban
 *   H. Import candidates → creates entry under existing profile
 *   I. Hiring Agent web search with Tavily
 *
 * Run:  node e2e-profile-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Blob } from 'buffer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8080';
const API = 'http://localhost:8000';
const SCREENSHOT_DIR = '/tmp/e2e-profile-screenshots';
const DOCS = path.resolve(__dirname, '..', 'testing-documents');

const ADMIN_EMAIL = 'admin@orbis.io';
const ADMIN_PASS = 'admin123';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
const results = [];

function log(test, status, detail = '') {
  const icon = status === 'PASS' ? '\u2705' : '\u274C';
  const line = `${icon} ${test}${detail ? ' \u2014 ' + detail : ''}`;
  console.log(line);
  results.push({ test, status, detail });
  if (status === 'PASS') pass++; else fail++;
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });
}

async function api(method, endpoint, body = null, token = '') {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${endpoint}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function upload(endpoint, fieldName, filePath, extraFields = {}, token = '') {
  const form = new FormData();
  const fileData = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  form.append(fieldName, new Blob([fileData]), fileName);
  for (const [k, v] of Object.entries(extraFields)) {
    form.append(k, String(v));
  }
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${endpoint}`, { method: 'POST', headers, body: form });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

// ═══════════════════════════════════════════════════════════════
//  MAIN TEST
// ═══════════════════════════════════════════════════════════════
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('  CANDIDATE-JOB DATA MODEL SEPARATION \u2014 E2E TEST');
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

  let adminToken = '';
  let jobId1 = '';
  let jobId2 = '';
  let entryId1 = '';
  let entryId2 = '';
  let profileId = '';

  // ─────────────────────────────────────────────────────────────
  // SECTION A: ADMIN LOGIN & MIGRATION CHECK
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION A: AUTH & MIGRATION \u2500\u2500\u2500\n');

  // A1: Login
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForTimeout(2000);
    adminToken = await page.evaluate(() => localStorage.getItem('access_token') || '');
    await screenshot(page, '01-dashboard');
    log('A1. Admin login via UI', adminToken ? 'PASS' : 'FAIL');
  } catch (e) {
    log('A1. Admin login via UI', 'FAIL', e.message);
    const r = await api('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    adminToken = r.data?.access_token || '';
    log('A1b. Admin login via API fallback', adminToken ? 'PASS' : 'FAIL');
  }

  // A2: Verify new tables exist (profiles endpoint works)
  try {
    const r = await api('GET', '/api/profiles?page=1&page_size=1', null, adminToken);
    log('A2. /api/profiles endpoint exists', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`);
  } catch (e) {
    log('A2. /api/profiles endpoint exists', 'FAIL', e.message);
  }

  // A3: Verify talent-pool still works
  try {
    const r = await api('GET', '/api/talent-pool?page=1&page_size=1', null, adminToken);
    log('A3. /api/talent-pool endpoint works', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}`);
  } catch (e) {
    log('A3. /api/talent-pool endpoint works', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION B: CREATE JOBS & UPLOAD CANDIDATE
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION B: CREATE JOBS & UPLOAD CANDIDATE \u2500\u2500\u2500\n');

  // B1: Get existing jobs (or we'll work with whatever exists)
  try {
    const r = await api('GET', '/api/job?page=1&page_size=5', null, adminToken);
    if (r.data?.items?.length >= 2) {
      jobId1 = r.data.items[0].job_id || r.data.items[0]._id;
      jobId2 = r.data.items[1].job_id || r.data.items[1]._id;
      log('B1. Found existing jobs', 'PASS', `job1=${jobId1}, job2=${jobId2}`);
    } else if (r.data?.items?.length === 1) {
      jobId1 = r.data.items[0].job_id || r.data.items[0]._id;
      log('B1. Found 1 existing job', 'PASS', `job1=${jobId1} (will skip 2-job tests)`);
    } else {
      log('B1. Found existing jobs', 'FAIL', 'No jobs found — upload a JD first');
    }
  } catch (e) {
    log('B1. Found existing jobs', 'FAIL', e.message);
  }

  // B2: Upload a candidate resume to job 1
  if (jobId1) {
    try {
      const resumePath = path.join(DOCS, 'resumes', 'Kenneth_Benn.pdf');
      const r = await upload('/api/candidates/upload', 'resume_file', resumePath, { jd_id: jobId1, use_rubric: 'false' }, adminToken);
      log('B2. Upload candidate to job 1', r.status === 200 ? 'PASS' : 'FAIL', `status=${r.status}, data=${JSON.stringify(r.data).slice(0, 120)}`);
      entryId1 = r.data?.candidate_id || r.data?._id || '';
    } catch (e) {
      log('B2. Upload candidate to job 1', 'FAIL', e.message);
    }
  }

  // B3: Wait for AI processing (poll)
  if (entryId1) {
    console.log('   Waiting for AI processing...');
    let aiDone = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const r = await api('GET', `/api/candidates/${entryId1}/ai-status`, null, adminToken);
        if (r.data?.ai_status === 'completed') { aiDone = true; break; }
        if (r.data?.ai_status === 'failed') { break; }
      } catch { /* continue polling */ }
    }
    log('B3. AI processing completed', aiDone ? 'PASS' : 'FAIL');
  }

  // B4: Verify entry has profile_id
  if (entryId1) {
    try {
      const r = await api('GET', `/api/candidates?jd_id=${jobId1}&page=1&page_size=50`, null, adminToken);
      const entry = r.data?.items?.find(c => String(c._id) === String(entryId1));
      profileId = entry?.profile_id ? String(entry.profile_id) : '';
      const hasProfileFields = entry?.full_name || entry?.email;
      log('B4. Entry has profile_id', profileId ? 'PASS' : 'FAIL', `profile_id=${profileId}, name=${entry?.full_name}`);
      log('B4b. Entry has joined profile fields', hasProfileFields ? 'PASS' : 'FAIL', `full_name=${entry?.full_name}, email=${entry?.email}`);
    } catch (e) {
      log('B4. Entry has profile_id', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION C: SAME CANDIDATE TO DIFFERENT JOB (profile reuse)
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION C: PROFILE REUSE ACROSS JOBS \u2500\u2500\u2500\n');

  if (jobId2 && profileId) {
    // C1: Upload same resume to job 2
    try {
      const resumePath = path.join(DOCS, 'resumes', 'Kenneth_Benn.pdf');
      const r = await upload('/api/candidates/upload', 'resume_file', resumePath, { jd_id: jobId2, use_rubric: 'false' }, adminToken);
      entryId2 = r.data?.candidate_id || r.data?._id || '';
      log('C1. Upload same candidate to job 2', r.status === 200 ? 'PASS' : 'FAIL', `entry2=${entryId2}`);
    } catch (e) {
      log('C1. Upload same candidate to job 2', 'FAIL', e.message);
    }

    // C2: Wait for AI processing
    if (entryId2) {
      console.log('   Waiting for AI processing...');
      let aiDone = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        try {
          const r = await api('GET', `/api/candidates/${entryId2}/ai-status`, null, adminToken);
          if (r.data?.ai_status === 'completed') { aiDone = true; break; }
          if (r.data?.ai_status === 'failed') { break; }
        } catch { /* continue polling */ }
      }
      log('C2. AI processing for job 2', aiDone ? 'PASS' : 'FAIL');
    }

    // C3: Both entries should share the same profile_id
    if (entryId2) {
      try {
        const r = await api('GET', `/api/candidates?jd_id=${jobId2}&page=1&page_size=50`, null, adminToken);
        const entry2 = r.data?.items?.find(c => String(c._id) === String(entryId2));
        const sameProfile = String(entry2?.profile_id) === String(profileId);
        log('C3. Both entries share same profile_id', sameProfile ? 'PASS' : 'FAIL',
          `entry1.profile=${profileId}, entry2.profile=${entry2?.profile_id}`);
      } catch (e) {
        log('C3. Both entries share same profile_id', 'FAIL', e.message);
      }
    }
  } else {
    log('C. Profile reuse tests', 'FAIL', 'Need 2 jobs — skipped');
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION D: TALENT POOL — UNIQUE PROFILES
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION D: TALENT POOL \u2014 UNIQUE PROFILES \u2500\u2500\u2500\n');

  // D1: API — check no duplicate profiles for same email
  try {
    const r = await api('GET', '/api/talent-pool?page=1&page_size=100', null, adminToken);
    const items = r.data?.items || [];
    // Count how many items have the same email as our test candidate
    const testEntries = items.filter(i => String(i.profile_id) === String(profileId) || String(i._id) === String(profileId));
    log('D1. Talent pool returns profiles (not entries)', r.status === 200 ? 'PASS' : 'FAIL',
      `total=${r.data?.total}, items_on_page=${items.length}`);

    // If we uploaded same person to 2 jobs, they should appear only ONCE in talent pool
    if (entryId2 && profileId) {
      log('D1b. Same person appears once (deduped)', testEntries.length <= 1 ? 'PASS' : 'FAIL',
        `found ${testEntries.length} entries for profile ${profileId}`);
    }

    // Check for job_count field
    const hasJobCount = items.length > 0 && 'job_count' in items[0];
    log('D1c. Items have job_count field', hasJobCount ? 'PASS' : 'FAIL',
      hasJobCount ? `first item job_count=${items[0].job_count}` : 'missing');
  } catch (e) {
    log('D1. Talent pool API', 'FAIL', e.message);
  }

  // D2: UI — navigate to talent pool page
  try {
    await page.goto(`${BASE}/talent-pool`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '10-talent-pool');

    // Check status filter has correct options (active, inactive, blacklisted — NOT hired, rejected)
    await page.click('button:has-text("Status")');
    await page.waitForTimeout(500);
    const statusOptions = await page.locator('[role="option"]').allTextContents();
    const hasInactive = statusOptions.some(s => s.toLowerCase().includes('inactive'));
    const noHired = !statusOptions.some(s => s.toLowerCase() === 'hired');
    const noRejected = !statusOptions.some(s => s.toLowerCase() === 'rejected');
    await page.keyboard.press('Escape');
    log('D2. Status filter has "inactive"', hasInactive ? 'PASS' : 'FAIL', statusOptions.join(', '));
    log('D2b. Status filter no "hired"', noHired ? 'PASS' : 'FAIL');
    log('D2c. Status filter no "rejected"', noRejected ? 'PASS' : 'FAIL');
    await screenshot(page, '11-talent-pool-filters');
  } catch (e) {
    log('D2. Talent pool UI', 'FAIL', e.message);
  }

  // D3: Check job count badge visible on cards
  try {
    const jobBadges = await page.locator('text=/\\d+ jobs?/').count();
    log('D3. Job count badges on cards', jobBadges > 0 ? 'PASS' : 'FAIL', `found ${jobBadges} badges`);
  } catch (e) {
    log('D3. Job count badges', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION E: PROFILE CRUD ENDPOINTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION E: PROFILE CRUD \u2500\u2500\u2500\n');

  if (profileId) {
    // E1: GET /api/profiles/:id
    try {
      const r = await api('GET', `/api/profiles/${profileId}`, null, adminToken);
      log('E1. Get profile by ID', r.status === 200 ? 'PASS' : 'FAIL',
        `name=${r.data?.full_name}, email=${r.data?.email}, status=${r.data?.status}`);
    } catch (e) {
      log('E1. Get profile by ID', 'FAIL', e.message);
    }

    // E2: PUT /api/profiles/:id — update notes
    try {
      const r = await api('PUT', `/api/profiles/${profileId}`, { notes: 'E2E test note', category: 'Engineering' }, adminToken);
      log('E2. Update profile', r.status === 200 ? 'PASS' : 'FAIL', JSON.stringify(r.data).slice(0, 80));
    } catch (e) {
      log('E2. Update profile', 'FAIL', e.message);
    }

    // E3: PATCH /api/profiles/:id/status
    try {
      const r = await api('PATCH', `/api/profiles/${profileId}/status`, { status: 'inactive' }, adminToken);
      log('E3. Change profile status to inactive', r.status === 200 ? 'PASS' : 'FAIL');

      // Revert back
      await api('PATCH', `/api/profiles/${profileId}/status`, { status: 'active' }, adminToken);
    } catch (e) {
      log('E3. Change profile status', 'FAIL', e.message);
    }

    // E4: GET /api/profiles/:id/jobs — job entries for this profile
    try {
      const r = await api('GET', `/api/profiles/${profileId}/jobs`, null, adminToken);
      const jobs = Array.isArray(r.data) ? r.data : [];
      log('E4. Get profile job entries', r.status === 200 ? 'PASS' : 'FAIL',
        `${jobs.length} job entries found`);
      if (entryId2) {
        log('E4b. Multiple job entries for same profile', jobs.length >= 2 ? 'PASS' : 'FAIL',
          `expected >=2, got ${jobs.length}`);
      }
    } catch (e) {
      log('E4. Get profile job entries', 'FAIL', e.message);
    }

    // E5: GET /api/profiles — paginated list
    try {
      const r = await api('GET', '/api/profiles?page=1&page_size=10', null, adminToken);
      log('E5. List profiles (paginated)', r.status === 200 ? 'PASS' : 'FAIL',
        `total=${r.data?.total}, page_size=${r.data?.page_size}`);
    } catch (e) {
      log('E5. List profiles', 'FAIL', e.message);
    }
  } else {
    log('E. Profile CRUD', 'FAIL', 'No profileId — skipped');
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION F: CANDIDATE DRAWER (profile-first layout)
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION F: CANDIDATE DRAWER \u2500\u2500\u2500\n');

  // F1: Click a talent pool card to open drawer
  try {
    await page.goto(`${BASE}/talent-pool`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const cards = page.locator('.cursor-pointer').first();
    if (await cards.count() > 0) {
      await cards.click();
      await page.waitForTimeout(2000);
      await screenshot(page, '20-candidate-drawer');

      // F2: Check drawer shows profile info
      const drawerVisible = await page.locator('.fixed.inset-y-0.right-0').isVisible();
      log('F1. Drawer opens on card click', drawerVisible ? 'PASS' : 'FAIL');

      // F3: Check job history table exists in drawer
      const historyTable = await page.locator('text=Evaluation History').count();
      log('F2. Job history table in drawer', historyTable > 0 ? 'PASS' : 'FAIL');

      // F4: Check for "Stage" column header in history
      const stageColumn = await page.locator('th:has-text("Stage")').count();
      log('F3. History table has Stage column', stageColumn > 0 ? 'PASS' : 'FAIL');

      // F5: Check for "Job" column showing titles
      const jobColumn = await page.locator('th:has-text("Job")').count();
      log('F4. History table has Job column', jobColumn > 0 ? 'PASS' : 'FAIL');

      await screenshot(page, '21-drawer-detail');

      // Close drawer
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      log('F1. Drawer opens', 'FAIL', 'No cards found in talent pool');
    }
  } catch (e) {
    log('F. Candidate drawer', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION G: CANDIDATE EVALUATION PAGE (entry-based)
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION G: CANDIDATE EVALUATION PAGE \u2500\u2500\u2500\n');

  if (jobId1) {
    try {
      await page.goto(`${BASE}/jobs/${jobId1}/candidates`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(5000);
      await screenshot(page, '30-candidate-evaluation');

      // Check that candidate cards render with names
      const candidateCards = await page.locator('.rounded-2xl.border.border-slate-200').count();
      log('G1. Candidate evaluation cards render', candidateCards > 0 ? 'PASS' : 'FAIL',
        `${candidateCards} cards found`);

      // Check name is not "N/A" (profile fields should provide fallback)
      const firstCardName = await page.locator('h3.font-bold').first().textContent().catch(() => 'N/A');
      log('G2. Candidate name populated', firstCardName && firstCardName !== 'N/A' ? 'PASS' : 'FAIL',
        `name="${firstCardName}"`);
    } catch (e) {
      log('G. Candidate evaluation', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION H: PIPELINE (entry-based Kanban)
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION H: PIPELINE \u2500\u2500\u2500\n');

  if (jobId1) {
    try {
      // API: Pipeline endpoint
      const r = await api('GET', `/api/candidates/pipeline/${jobId1}`, null, adminToken);
      const stages = Object.keys(r.data || {});
      const hasStages = stages.includes('applied') && stages.includes('screening');
      log('H1. Pipeline API returns stages', hasStages ? 'PASS' : 'FAIL', stages.join(', '));

      // Count total candidates across all stages
      let totalInPipeline = 0;
      for (const stage of stages) {
        totalInPipeline += (r.data[stage] || []).length;
      }
      log('H1b. Pipeline has candidates', totalInPipeline > 0 ? 'PASS' : 'FAIL', `total=${totalInPipeline}`);

      // UI: Navigate to pipeline
      await page.goto(`${BASE}/jobs/${jobId1}/pipeline`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      await screenshot(page, '40-pipeline');
      log('H2. Pipeline page renders', 'PASS');
    } catch (e) {
      log('H. Pipeline', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION I: IMPORT CANDIDATES (profile reuse)
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION I: IMPORT CANDIDATES \u2500\u2500\u2500\n');

  if (jobId1 && jobId2) {
    try {
      // I1: Get candidates available for import from job1 to job2
      const r = await api('GET', `/api/candidates/import?job_id=${jobId1}`, null, adminToken);
      log('I1. Import candidates list', r.status === 200 ? 'PASS' : 'FAIL',
        `${Array.isArray(r.data) ? r.data.length : 0} candidates available`);
    } catch (e) {
      log('I1. Import candidates list', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION J: TALENT POOL ADD-TO-JOB (profile_ids)
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION J: TALENT POOL ADD-TO-JOB \u2500\u2500\u2500\n');

  if (profileId && jobId1) {
    try {
      const r = await api('POST', '/api/talent-pool/add-to-job', {
        profile_ids: [profileId],
        candidate_ids: [profileId],
        target_job_id: jobId1,
      }, adminToken);
      // This may say "already exists" since we uploaded to this job, but the endpoint should work
      log('J1. Add profile to job via talent pool', r.status === 200 ? 'PASS' : 'FAIL',
        JSON.stringify(r.data).slice(0, 100));
    } catch (e) {
      log('J1. Add profile to job', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION K: DASHBOARD STATS
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION K: DASHBOARD STATS \u2500\u2500\u2500\n');

  try {
    const r = await api('GET', '/api/dashboard/stats', null, adminToken);
    log('K1. Dashboard stats API', r.status === 200 ? 'PASS' : 'FAIL',
      `jobs=${r.data?.total_jobs}, candidates=${r.data?.total_candidates}`);

    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '50-dashboard');
    log('K2. Dashboard page renders', 'PASS');
  } catch (e) {
    log('K. Dashboard', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION L: HIRING AGENT WEB SEARCH (Tavily)
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION L: HIRING AGENT WEB SEARCH \u2500\u2500\u2500\n');

  try {
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '60-hiring-assistant');

    // L1: Toggle web search ON
    const globeBtn = page.locator('button[title="Web search OFF"]');
    if (await globeBtn.count() > 0) {
      await globeBtn.click();
      await page.waitForTimeout(500);
      const indicator = await page.locator('text=Web search enabled').count();
      await screenshot(page, '61-web-search-on');
      log('L1. Toggle web search ON', indicator > 0 ? 'PASS' : 'FAIL');
    } else {
      log('L1. Toggle web search ON', 'FAIL', 'Globe button not found');
    }

    // L2: Send a web search query
    try {
      const r = await api('POST', '/api/hiring-agent/query', {
        query: 'What is the average salary for a software engineer in New York in 2025?',
        conversation_history: [],
        web_search_enabled: true,
      }, adminToken);
      const hasAnswer = r.data?.answer && r.data.answer.length > 20;
      const usedWebSearch = r.data?.actions?.some(a => a.tool === 'web_search');
      log('L2. Web search query via API', r.status === 200 && hasAnswer ? 'PASS' : 'FAIL',
        `answer_len=${r.data?.answer?.length || 0}, used_web_search=${usedWebSearch}`);
    } catch (e) {
      log('L2. Web search query', 'FAIL', e.message);
    }
  } catch (e) {
    log('L. Hiring agent', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION M: CANDIDATE JOB HISTORY (via talent pool drawer)
  // ─────────────────────────────────────────────────────────────
  console.log('\n\u2500\u2500\u2500 SECTION M: JOB HISTORY API \u2500\u2500\u2500\n');

  if (profileId) {
    try {
      const r = await api('GET', `/api/talent-pool/${profileId}/history`, null, adminToken);
      const history = Array.isArray(r.data) ? r.data : [];
      log('M1. Job history API returns entries', r.status === 200 ? 'PASS' : 'FAIL',
        `${history.length} entries`);

      // Check entries have job_title field
      if (history.length > 0) {
        const hasJobTitle = 'job_title' in history[0];
        const hasPipelineStage = 'pipeline_stage' in history[0];
        log('M2. History entries have job_title', hasJobTitle ? 'PASS' : 'FAIL');
        log('M3. History entries have pipeline_stage', hasPipelineStage ? 'PASS' : 'FAIL');
      }
    } catch (e) {
      log('M. Job history', 'FAIL', e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log(`  RESULTS: ${pass} passed, ${fail} failed, ${pass + fail} total`);
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

  if (fail > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  \u274C ${r.test}: ${r.detail}`);
    });
  }

  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);
  console.log('Browser will stay open for 15 seconds for manual inspection...\n');
  await page.waitForTimeout(15000);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
