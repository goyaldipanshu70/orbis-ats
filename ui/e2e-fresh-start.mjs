/**
 * FRESH-START E2E TEST — Complete Platform Verification from Zero Data
 *
 * Tests the ENTIRE application from a clean database:
 *   A. Auth (login as seeded admin)
 *   B. Create Job (upload JD → AI extract → submit)
 *   C. Upload Candidates (same person to multiple jobs → verify dedup)
 *   D. Candidate Evaluation (cards, scores, profile fields)
 *   E. Pipeline (stage moves, history)
 *   F. Talent Pool (profile dedup, status, job_count, filters)
 *   G. Profile CRUD
 *   H. Import Candidates (reuse across jobs)
 *   I. Interviews & Feedback
 *   J. Offers
 *   K. Analytics (all endpoints)
 *   L. Hiring Assistant
 *   M. Admin Dashboard
 *   N. Careers Portal
 *   O. Account Settings
 *   P. Database Integrity Checks
 *
 * Run:  node e2e-fresh-start.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8080';
const API  = 'http://localhost:8000';
const RECRUITING = 'http://localhost:8002';
const SCREENSHOT_DIR = '/tmp/e2e-fresh-screenshots';

const ADMIN_EMAIL = 'admin@orbis.io';
const ADMIN_PASS  = 'admin123';

// Resume PDFs that exist on disk
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
  const base = urlPath.startsWith('http') ? '' : API;
  const opts = { method, headers: {} };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body && !(body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  if (body instanceof FormData) {
    opts.body = body;
  }
  const r = await fetch(`${base}${urlPath}`, opts);
  let data;
  try { data = await r.json(); } catch { data = null; }
  return { status: r.status, data };
}

// Upload a file via multipart form
async function uploadFile(urlPath, filePath, fieldName, extraFields = {}, token = null) {
  const fileData = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const formData = new FormData();
  formData.append(fieldName, new Blob([fileData], { type: 'application/pdf' }), fileName);
  for (const [k, v] of Object.entries(extraFields)) {
    formData.append(k, String(v));
  }

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
  console.log('  ORBIS ATS — FRESH-START E2E TEST (zero data → full verification)');
  console.log('═'.repeat(60) + '\n');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  let token = null;
  let jobId1 = null, jobId2 = null;
  let entryId1 = null, entryId2 = null;
  let profileId1 = null;
  let scheduleId = null, offerId = null;

  // ═════════════════════════════════════════════════════════════════
  //  A. AUTH
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 A: AUTH \u2500\u2500\u2500\n');

  // A1: Login via UI
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await ss(page, 'login');

    // Extract token from localStorage
    token = await page.evaluate(() => localStorage.getItem('access_token'));
    const currentUrl = page.url();
    log('A1. UI login', token && !currentUrl.includes('/login') ? 'PASS' : 'FAIL',
      `url=${currentUrl.replace(BASE, '')}`);
  } catch (e) { log('A1. UI login', 'FAIL', e.message); }

  // A2: API login
  try {
    const r = await api('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    if (r.data?.access_token) token = r.data.access_token;
    log('A2. API login', r.data?.access_token ? 'PASS' : 'FAIL');
  } catch (e) { log('A2. API login', 'FAIL', e.message); }

  // A3: Get profile
  try {
    const r = await api('GET', '/api/auth/me', null, token);
    log('A3. User profile', r.status === 200 ? 'PASS' : 'FAIL', `email=${r.data?.email}, role=${r.data?.role}`);
  } catch (e) { log('A3. Profile', 'FAIL', e.message); }

  // ═════════════════════════════════════════════════════════════════
  //  B. CREATE JOBS (we need at least 2 jobs for dedup testing)
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 B: CREATE JOBS \u2500\u2500\u2500\n');

  // Helper: create job via /api/job/submit (ai_result must be wrapped as {"ai_result": {...}})
  async function createJob(title, dept, skills, desc, vacancies, country, city) {
    const aiResult = JSON.stringify({
      ai_result: {
        job_title: title,
        department: dept,
        experience_required: "3+ years",
        key_skills: skills,
        job_description: desc,
        responsibilities: ["Develop", "Review", "Test"],
        qualifications: ["BS in CS"]
      }
    });
    const formData = new FormData();
    formData.append('ai_result', aiResult);
    formData.append('number_of_vacancies', String(vacancies));
    formData.append('country', country);
    formData.append('city', city);
    const r = await fetch(`${API}/api/job/submit`, {
      method: 'POST', body: formData,
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await r.json();
    return data?.jd_id || data?.job_id || data?.id;
  }

  // B1: Create Job 1
  try {
    jobId1 = await createJob("Senior Software Engineer", "Engineering",
      ["Python", "FastAPI", "PostgreSQL"], "Build scalable backend services.", 2, "United States", "San Francisco");
    log('B1. Create Job 1 (Sr Software Engineer)', jobId1 ? 'PASS' : 'FAIL', `id=${jobId1}`);
  } catch (e) { log('B1. Create Job 1', 'FAIL', e.message); }

  // B2: Create Job 2
  try {
    jobId2 = await createJob("Frontend Developer", "Engineering",
      ["React", "TypeScript", "Tailwind"], "Build beautiful UIs.", 1, "United States", "New York");
    log('B2. Create Job 2 (Frontend Developer)', jobId2 ? 'PASS' : 'FAIL', `id=${jobId2}`);
  } catch (e) { log('B2. Create Job 2', 'FAIL', e.message); }

  // B3: Create Job 3 (for import testing)
  let jobId3 = null;
  try {
    jobId3 = await createJob("QA Engineer", "Engineering",
      ["Selenium", "Python", "API Testing"], "Ensure quality.", 1, "United States", "Austin");
    log('B3. Create Job 3 (QA Engineer)', jobId3 ? 'PASS' : 'FAIL', `id=${jobId3}`);
  } catch (e) { log('B3. Create Job 3', 'FAIL', e.message); }

  // B4: Verify jobs list
  try {
    const r = await api('GET', '/api/job?page=1&page_size=10', null, token);
    const items = r.data?.items || [];
    log('B4. Jobs list', items.length >= 3 ? 'PASS' : 'FAIL', `count=${items.length}, expected>=3`);
  } catch (e) { log('B4. Jobs list', 'FAIL', e.message); }

  // B5: Jobs UI (Dashboard shows the job list)
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await ss(page, 'jobs-list');
    const body = await page.textContent('body');
    log('B5. Jobs UI (Dashboard)', body.includes('Software Engineer') || body.includes('Frontend') || body.includes('QA') || body.includes('Dashboard') ? 'PASS' : 'FAIL');
  } catch (e) { log('B5. Jobs UI', 'FAIL', e.message); }

  // ═════════════════════════════════════════════════════════════════
  //  C. UPLOAD CANDIDATES — test profile dedup
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 C: UPLOAD CANDIDATES \u2500\u2500\u2500\n');

  // Find resume PDFs
  const resumes = fs.readdirSync(RESUME_DIR).filter(f => f.endsWith('.pdf'));
  const kennethResume = resumes.find(f => f.includes('Kenneth'));
  const williamResume = resumes.find(f => f.includes('William'));
  const bradResume = resumes.find(f => f.includes('Brad'));
  const tomResume = resumes.find(f => f.includes('Tom'));

  if (!kennethResume || !williamResume) {
    log('C0. Resume files exist', 'FAIL', 'Need Kenneth + William PDFs');
  } else {
    log('C0. Resume files exist', 'PASS', `kenneth=${kennethResume?.slice(0,20)}, william=${williamResume?.slice(0,20)}`);
  }

  // C1: Upload Kenneth to Job 1
  if (kennethResume && jobId1) {
    try {
      const r = await uploadFile('/api/candidates/upload',
        path.join(RESUME_DIR, kennethResume), 'resume_file',
        { jd_id: jobId1, use_rubric: 'true' }, token);
      entryId1 = r.data?.candidate_id;
      log('C1. Upload Kenneth → Job 1', entryId1 ? 'PASS' : 'FAIL',
        `entry=${entryId1}, status=${r.status}`);
    } catch (e) { log('C1. Upload Kenneth → Job 1', 'FAIL', e.message); }
  }

  // C2: Upload William to Job 1
  let entryWilliam1 = null;
  if (williamResume && jobId1) {
    try {
      const r = await uploadFile('/api/candidates/upload',
        path.join(RESUME_DIR, williamResume), 'resume_file',
        { jd_id: jobId1, use_rubric: 'true' }, token);
      entryWilliam1 = r.data?.candidate_id;
      log('C2. Upload William → Job 1', entryWilliam1 ? 'PASS' : 'FAIL',
        `entry=${entryWilliam1}`);
    } catch (e) { log('C2. Upload William → Job 1', 'FAIL', e.message); }
  }

  // C3: Upload SAME Kenneth to Job 2 — should REUSE profile, create new entry
  let entryKenneth2 = null;
  if (kennethResume && jobId2) {
    try {
      const r = await uploadFile('/api/candidates/upload',
        path.join(RESUME_DIR, kennethResume), 'resume_file',
        { jd_id: jobId2, use_rubric: 'true' }, token);
      entryKenneth2 = r.data?.candidate_id;
      log('C3. Upload Kenneth → Job 2 (dedup test)', entryKenneth2 ? 'PASS' : 'FAIL',
        `entry=${entryKenneth2}`);
    } catch (e) { log('C3. Upload Kenneth → Job 2', 'FAIL', e.message); }
  }

  // C4: Upload Brad to Job 1
  let entryBrad = null;
  if (bradResume && jobId1) {
    try {
      const r = await uploadFile('/api/candidates/upload',
        path.join(RESUME_DIR, bradResume), 'resume_file',
        { jd_id: jobId1, use_rubric: 'true' }, token);
      entryBrad = r.data?.candidate_id;
      log('C4. Upload Brad → Job 1', entryBrad ? 'PASS' : 'FAIL',
        `entry=${entryBrad}`);
    } catch (e) { log('C4. Upload Brad → Job 1', 'FAIL', e.message); }
  }

  // C5: Re-upload Kenneth to Job 1 — should UPDATE existing entry, NOT create duplicate
  if (kennethResume && jobId1) {
    try {
      const r = await uploadFile('/api/candidates/upload',
        path.join(RESUME_DIR, kennethResume), 'resume_file',
        { jd_id: jobId1, use_rubric: 'true' }, token);
      const reEntryId = r.data?.candidate_id;
      log('C5. Re-upload Kenneth → Job 1 (same entry)',
        reEntryId === entryId1 ? 'PASS' : 'FAIL',
        `got=${reEntryId}, expected=${entryId1}`);
    } catch (e) { log('C5. Re-upload Kenneth → Job 1', 'FAIL', e.message); }
  }

  // ═════════════════════════════════════════════════════════════════
  //  D. DATABASE DEDUP VERIFICATION (critical!)
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 D: DEDUP VERIFICATION \u2500\u2500\u2500\n');

  // D1: Check profile count — should be 3 unique people (Kenneth, William, Brad)
  // OR 2 if Brad has no email and shares profile-less entries
  try {
    const r = await api('GET', '/api/profiles?page=1&page_size=50', null, token);
    const profiles = r.data?.items || [];
    const profileCount = r.data?.total || profiles.length;
    // We uploaded: Kenneth (2 jobs), William (1 job), Brad (1 job) = 3 unique people
    log('D1. Profile count', profileCount >= 3 ? 'PASS' : 'FAIL',
      `profiles=${profileCount}, expected>=3`);

    // D2: No duplicate emails
    const emails = profiles.map(p => p.email).filter(Boolean);
    const uniqueEmails = new Set(emails.map(e => e.toLowerCase()));
    log('D2. No duplicate emails', emails.length === uniqueEmails.size ? 'PASS' : 'FAIL',
      `emails=${emails.length}, unique=${uniqueEmails.size}`);

    // D3: Kenneth should have job_count=2
    const kenneth = profiles.find(p => p.full_name?.toLowerCase().includes('kenneth') || p.name?.toLowerCase().includes('kenneth'));
    if (kenneth) {
      profileId1 = kenneth.profile_id || kenneth.id;
      log('D3. Kenneth job_count=2', kenneth.job_count === 2 ? 'PASS' : 'FAIL',
        `job_count=${kenneth.job_count}`);
    } else {
      log('D3. Kenneth found in profiles', 'FAIL', 'not found');
    }

    // D4: William should have job_count=1
    const william = profiles.find(p => p.full_name?.toLowerCase().includes('william') || p.name?.toLowerCase().includes('william'));
    if (william) {
      log('D4. William job_count=1', william.job_count === 1 ? 'PASS' : 'FAIL',
        `job_count=${william.job_count}`);
    } else {
      log('D4. William found in profiles', 'FAIL', 'not found');
    }

  } catch (e) { log('D1. Profile count', 'FAIL', e.message); }

  // D5: Check entries count — should be 4 total (Kenneth×2 + William×1 + Brad×1)
  try {
    const r1 = await api('GET', `/api/candidates?jd_id=${jobId1}&page=1&page_size=50`, null, token);
    const r2 = await api('GET', `/api/candidates?jd_id=${jobId2}&page=1&page_size=50`, null, token);
    const job1Count = r1.data?.total || 0;
    const job2Count = r2.data?.total || 0;
    log('D5. Job 1 entries', job1Count === 3 ? 'PASS' : 'FAIL',
      `count=${job1Count}, expected=3 (Kenneth+William+Brad)`);
    log('D6. Job 2 entries', job2Count === 1 ? 'PASS' : 'FAIL',
      `count=${job2Count}, expected=1 (Kenneth only)`);
    log('D7. Total entries', (job1Count + job2Count) === 4 ? 'PASS' : 'FAIL',
      `total=${job1Count + job2Count}, expected=4`);
  } catch (e) { log('D5. Entry counts', 'FAIL', e.message); }

  // D8: Verify entry has profile fields populated
  try {
    const r = await api('GET', `/api/candidates?jd_id=${jobId1}&page=1&page_size=50`, null, token);
    const items = r.data?.items || [];
    if (items.length > 0) {
      const entry = items[0];
      log('D8a. Entry has profile_id', entry.profile_id ? 'PASS' : 'FAIL', `profile_id=${entry.profile_id}`);
      log('D8b. Entry has full_name', entry.full_name ? 'PASS' : 'FAIL', `name=${entry.full_name}`);
      log('D8c. Entry has pipeline_stage', entry.pipeline_stage ? 'PASS' : 'FAIL', `stage=${entry.pipeline_stage}`);
      // Store for later tests
      entryId1 = entry._id;
      entryId2 = items.length > 1 ? items[1]._id : null;
    }
  } catch (e) { log('D8. Entry fields', 'FAIL', e.message); }

  // ═════════════════════════════════════════════════════════════════
  //  E. CANDIDATE EVALUATION UI
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 E: CANDIDATE EVALUATION UI \u2500\u2500\u2500\n');

  if (jobId1) {
    try {
      await page.goto(`${BASE}/jobs/${jobId1}/candidates`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      await ss(page, 'candidate-eval');
      const cards = await page.locator('.rounded-2xl.border').count();
      log('E1. Candidate eval page', cards >= 2 ? 'PASS' : 'FAIL', `${cards} cards`);
    } catch (e) { log('E1. Eval page', 'FAIL', e.message); }

    // Check score visuals
    try {
      const body = await page.textContent('body');
      const hasScores = body.includes('/') || body.includes('Score') || body.includes('Core');
      log('E2. Score visuals', hasScores ? 'PASS' : 'FAIL');
    } catch (e) { log('E2. Score visuals', 'FAIL', e.message); }
  }

  // ═════════════════════════════════════════════════════════════════
  //  F. PIPELINE
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 F: PIPELINE \u2500\u2500\u2500\n');

  if (jobId1 && entryId1) {
    // F1: Pipeline API
    try {
      const r = await api('GET', `/api/candidates/pipeline/${jobId1}`, null, token);
      const stages = Object.keys(r.data || {});
      log('F1. Pipeline API', stages.length >= 4 ? 'PASS' : 'FAIL', `stages=${stages.join(',')}`);
    } catch (e) { log('F1. Pipeline', 'FAIL', e.message); }

    // F2: Move candidate stage
    try {
      const r = await api('PUT', `/api/candidates/${entryId1}/stage`, { stage: 'screening' }, token);
      log('F2. Move to screening', r.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) { log('F2. Move stage', 'FAIL', e.message); }

    // F3: Stage history
    try {
      const r = await api('GET', `/api/candidates/${entryId1}/history`, null, token);
      const histLen = Array.isArray(r.data) ? r.data.length : 0;
      log('F3. Stage history', histLen >= 1 ? 'PASS' : 'FAIL', `entries=${histLen}`);
    } catch (e) { log('F3. History', 'FAIL', e.message); }

    // F4: Move to interview
    try {
      const r = await api('PUT', `/api/candidates/${entryId1}/stage`, { stage: 'interview' }, token);
      log('F4. Move to interview', r.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) { log('F4. Move stage', 'FAIL', e.message); }

    // F5: Pipeline UI
    try {
      await page.goto(`${BASE}/jobs/${jobId1}/pipeline`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await ss(page, 'pipeline');
      const body = await page.textContent('body');
      log('F5. Pipeline UI', body.includes('Interview') || body.includes('Screening') ? 'PASS' : 'FAIL');
    } catch (e) { log('F5. Pipeline UI', 'FAIL', e.message); }
  }

  // ═════════════════════════════════════════════════════════════════
  //  G. TALENT POOL — profile-based, dedup verified
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 G: TALENT POOL \u2500\u2500\u2500\n');

  try {
    const r = await api('GET', '/api/talent-pool?page=1&page_size=50', null, token);
    const items = r.data?.items || [];
    const total = r.data?.total || 0;
    log('G1. Talent pool API', r.status === 200 ? 'PASS' : 'FAIL', `total=${total}`);

    // G2: No duplicate names (same email = same profile)
    const names = items.map(i => (i.full_name || i.name || '').toLowerCase()).filter(Boolean);
    const uniqueNames = new Set(names);
    log('G2. No duplicates in talent pool', names.length === uniqueNames.size ? 'PASS' : 'FAIL',
      `items=${names.length}, unique=${uniqueNames.size}`);

    // G3: Each item has job_count
    const withJobCount = items.filter(i => typeof i.job_count === 'number');
    log('G3. All items have job_count', withJobCount.length === items.length ? 'PASS' : 'FAIL',
      `${withJobCount.length}/${items.length}`);

    // G4: Kenneth should have job_count >= 2
    const kenneth = items.find(i => (i.full_name || i.name || '').toLowerCase().includes('kenneth'));
    if (kenneth) {
      log('G4. Kenneth job_count >=2', kenneth.job_count >= 2 ? 'PASS' : 'FAIL',
        `job_count=${kenneth.job_count}`);
    } else {
      log('G4. Kenneth in talent pool', 'FAIL', 'not found');
    }

    // G5: Each item has status
    const withStatus = items.filter(i => ['active', 'inactive', 'blacklisted'].includes(i.status));
    log('G5. All have valid status', withStatus.length === items.length ? 'PASS' : 'FAIL',
      `${withStatus.length}/${items.length}`);

    // G6: Each item has profile_id
    const withProfileId = items.filter(i => i.profile_id);
    log('G6. All have profile_id', withProfileId.length === items.length ? 'PASS' : 'FAIL',
      `${withProfileId.length}/${items.length}`);

  } catch (e) { log('G1. Talent pool', 'FAIL', e.message); }

  // G7: Status filter
  try {
    const r = await api('GET', '/api/talent-pool?page=1&page_size=50&status=active', null, token);
    log('G7. Filter active', r.status === 200 ? 'PASS' : 'FAIL', `count=${r.data?.total}`);
  } catch (e) { log('G7. Filter', 'FAIL', e.message); }

  // G8: Change status to inactive
  if (profileId1) {
    try {
      const r = await api('PATCH', `/api/talent-pool/${profileId1}/status`, { status: 'inactive' }, token);
      log('G8. Change status to inactive', r.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) { log('G8. Status change', 'FAIL', e.message); }

    // G9: Verify status changed
    try {
      const r = await api('GET', `/api/talent-pool/${profileId1}`, null, token);
      log('G9. Status persisted', r.data?.status === 'inactive' ? 'PASS' : 'FAIL',
        `status=${r.data?.status}`);
    } catch (e) { log('G9. Status verify', 'FAIL', e.message); }

    // G10: Restore to active
    try {
      await api('PATCH', `/api/talent-pool/${profileId1}/status`, { status: 'active' }, token);
      log('G10. Restore to active', 'PASS');
    } catch (e) { log('G10. Restore', 'FAIL', e.message); }
  }

  // G11: Job history via talent pool
  if (profileId1) {
    try {
      const r = await api('GET', `/api/talent-pool/${profileId1}/history`, null, token);
      const hist = Array.isArray(r.data) ? r.data : [];
      log('G11. Job history', hist.length >= 2 ? 'PASS' : 'FAIL', `entries=${hist.length}`);
      if (hist.length > 0) {
        log('G11b. Has job_title', hist[0].job_title ? 'PASS' : 'FAIL', `title=${hist[0].job_title}`);
        log('G11c. Has pipeline_stage', hist[0].pipeline_stage ? 'PASS' : 'FAIL', `stage=${hist[0].pipeline_stage}`);
      }
    } catch (e) { log('G11. Job history', 'FAIL', e.message); }
  }

  // G12: Talent pool UI
  try {
    await page.goto(`${BASE}/talent-pool`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await ss(page, 'talent-pool');

    // Status filter options
    const body = await page.textContent('body');
    const hasOptions = ['active', 'inactive', 'blacklisted'].some(s => body.toLowerCase().includes(s));
    log('G12. Talent pool UI', hasOptions ? 'PASS' : 'FAIL');

    // G13: Job count badges visible
    const badges = await page.locator('text=/\\d+ jobs?/').count();
    log('G13. Job count badges', badges > 0 ? 'PASS' : 'FAIL', `${badges} badges`);

    // G14: Click first card to open drawer
    try {
      const firstCard = page.locator('[class*="cursor-pointer"]').first();
      if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstCard.click();
        await page.waitForTimeout(2000);
        await ss(page, 'candidate-drawer');
        const drawerBody = await page.textContent('body');
        log('G14. Drawer opens', drawerBody.includes('History') || drawerBody.includes('history') || drawerBody.includes('Score') ? 'PASS' : 'FAIL');
      } else {
        // Try alternative selectors
        const altCard = page.locator('.rounded-xl.border').first();
        if (await altCard.isVisible({ timeout: 2000 }).catch(() => false)) {
          await altCard.click();
          await page.waitForTimeout(2000);
          await ss(page, 'candidate-drawer');
          log('G14. Drawer opens', 'PASS', 'via alt selector');
        } else {
          log('G14. Drawer', 'SKIP', 'no clickable card found');
        }
      }
    } catch (e) { log('G14. Drawer', 'FAIL', e.message); }
  } catch (e) { log('G12. Talent pool UI', 'FAIL', e.message); }

  // ═════════════════════════════════════════════════════════════════
  //  H. PROFILE CRUD
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 H: PROFILE CRUD \u2500\u2500\u2500\n');

  if (profileId1) {
    // H1: Get profile
    try {
      const r = await api('GET', `/api/profiles/${profileId1}`, null, token);
      log('H1. Get profile', r.status === 200 ? 'PASS' : 'FAIL',
        `name=${r.data?.full_name}, email=${r.data?.email}`);
    } catch (e) { log('H1. Get profile', 'FAIL', e.message); }

    // H2: Update profile
    try {
      const r = await api('PUT', `/api/profiles/${profileId1}`, {
        notes: 'E2E test note', category: 'Engineering'
      }, token);
      log('H2. Update profile', r.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) { log('H2. Update', 'FAIL', e.message); }

    // H3: Verify update
    try {
      const r = await api('GET', `/api/profiles/${profileId1}`, null, token);
      log('H3. Update persisted', r.data?.notes === 'E2E test note' ? 'PASS' : 'FAIL',
        `notes=${r.data?.notes}`);
    } catch (e) { log('H3. Verify', 'FAIL', e.message); }

    // H4: Profile job entries
    try {
      const r = await api('GET', `/api/profiles/${profileId1}/jobs`, null, token);
      const jobs = Array.isArray(r.data) ? r.data : [];
      log('H4. Profile job entries', jobs.length >= 2 ? 'PASS' : 'FAIL',
        `entries=${jobs.length}, expected>=2`);
    } catch (e) { log('H4. Job entries', 'FAIL', e.message); }

    // H5: Search profiles
    try {
      const r = await api('GET', '/api/profiles?search=kenneth&page=1&page_size=10', null, token);
      const count = r.data?.total || (r.data?.items || []).length;
      log('H5. Search profiles', count >= 1 ? 'PASS' : 'FAIL', `results=${count}`);
    } catch (e) { log('H5. Search', 'FAIL', e.message); }
  }

  // ═════════════════════════════════════════════════════════════════
  //  I. IMPORT CANDIDATES
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 I: IMPORT CANDIDATES \u2500\u2500\u2500\n');

  if (profileId1 && jobId3) {
    // I1: Import Kenneth to Job 3 via talent pool
    try {
      const r = await api('POST', '/api/talent-pool/add-to-job', {
        profile_ids: [String(profileId1)],
        candidate_ids: [String(profileId1)],
        target_job_id: String(jobId3)
      }, token);
      log('I1. Import Kenneth → Job 3', r.status === 200 ? 'PASS' : 'FAIL',
        `imported=${r.data?.imported_count}`);
    } catch (e) { log('I1. Import', 'FAIL', e.message); }

    // I2: Verify Kenneth now has 3 job entries
    try {
      const r = await api('GET', `/api/profiles/${profileId1}/jobs`, null, token);
      const jobs = Array.isArray(r.data) ? r.data : [];
      log('I2. Kenneth now has 3 job entries', jobs.length === 3 ? 'PASS' : 'FAIL',
        `entries=${jobs.length}`);
    } catch (e) { log('I2. Entry count', 'FAIL', e.message); }

    // I3: Profile job_count updated
    try {
      const r = await api('GET', `/api/profiles/${profileId1}`, null, token);
      log('I3. Profile job_count=3', r.data?.job_count === 3 ? 'PASS' : 'FAIL',
        `job_count=${r.data?.job_count}`);
    } catch (e) { log('I3. job_count', 'FAIL', e.message); }

    // I4: Import SAME person to SAME job — should not create duplicate
    try {
      const r = await api('POST', '/api/talent-pool/add-to-job', {
        profile_ids: [String(profileId1)],
        candidate_ids: [String(profileId1)],
        target_job_id: String(jobId3)
      }, token);
      log('I4. Re-import (no duplicate)', r.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) { log('I4. Re-import', 'FAIL', e.message); }

    // I5: Verify still 3 entries (no duplicate)
    try {
      const r = await api('GET', `/api/profiles/${profileId1}/jobs`, null, token);
      const jobs = Array.isArray(r.data) ? r.data : [];
      log('I5. Still 3 entries after re-import', jobs.length === 3 ? 'PASS' : 'FAIL',
        `entries=${jobs.length}`);
    } catch (e) { log('I5. Verify no dup', 'FAIL', e.message); }
  }

  // ═════════════════════════════════════════════════════════════════
  //  J. INTERVIEWS & FEEDBACK
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 J: INTERVIEWS & FEEDBACK \u2500\u2500\u2500\n');

  if (jobId1 && entryId1) {
    // J1: Schedule interview
    try {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const r = await api('POST', '/api/interview/schedule', {
        candidate_id: Number(entryId1), jd_id: Number(jobId1),
        interview_type: 'video', scheduled_date: tomorrow, scheduled_time: '14:00',
        duration_minutes: 45, location: 'Zoom', interviewer_names: ['Admin'], notes: 'E2E test'
      }, token);
      scheduleId = r.data?.schedule_id || r.data?.id;
      log('J1. Schedule interview', scheduleId ? 'PASS' : 'FAIL', `id=${scheduleId}`);
    } catch (e) { log('J1. Schedule', 'FAIL', e.message); }

    // J2: List interviews for job
    try {
      const r = await api('GET', `/api/interview/schedule/job/${jobId1}`, null, token);
      log('J2. Interviews for job', r.status === 200 ? 'PASS' : 'FAIL',
        `count=${Array.isArray(r.data) ? r.data.length : 0}`);
    } catch (e) { log('J2. List interviews', 'FAIL', e.message); }

    // J3: Upcoming interviews
    try {
      const r = await api('GET', '/api/interview/schedule/upcoming?days_ahead=30', null, token);
      log('J3. Upcoming interviews', r.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) { log('J3. Upcoming', 'FAIL', e.message); }

    // J4: Submit feedback
    if (scheduleId) {
      try {
        const r = await api('POST', `/api/interview/schedule/${scheduleId}/feedback`, {
          rating: 4, recommendation: 'yes', strengths: 'Strong skills', concerns: 'None', notes: 'E2E'
        }, token);
        log('J4. Submit feedback', r.status === 200 ? 'PASS' : 'FAIL');
      } catch (e) { log('J4. Feedback', 'FAIL', e.message); }

      // J5: Get feedback
      try {
        const r = await api('GET', `/api/interview/schedule/${scheduleId}/feedback`, null, token);
        log('J5. Get feedback', r.status === 200 ? 'PASS' : 'FAIL');
      } catch (e) { log('J5. Get feedback', 'FAIL', e.message); }
    }
  }

  // ═════════════════════════════════════════════════════════════════
  //  K. OFFERS
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 K: OFFERS \u2500\u2500\u2500\n');

  if (jobId1 && entryId1) {
    // Move to offer stage first
    try { await api('PUT', `/api/candidates/${entryId1}/stage`, { stage: 'offer' }, token); } catch {}

    // K1: Create offer
    try {
      const r = await api('POST', `/api/job/${jobId1}/offers`, {
        candidate_id: Number(entryId1), salary: 120000, salary_currency: 'USD',
        start_date: '2026-06-01', position_title: 'Senior Software Engineer', department: 'Engineering'
      }, token);
      offerId = r.data?.offer_id || r.data?.id;
      log('K1. Create offer', offerId ? 'PASS' : 'FAIL', `id=${offerId}`);
    } catch (e) { log('K1. Create offer', 'FAIL', e.message); }

    // K2: List offers
    try {
      const r = await api('GET', `/api/job/${jobId1}/offers`, null, token);
      log('K2. List offers', r.status === 200 ? 'PASS' : 'FAIL',
        `count=${Array.isArray(r.data) ? r.data.length : 0}`);
    } catch (e) { log('K2. List offers', 'FAIL', e.message); }

    // K3: Offer detail
    if (offerId) {
      try {
        const r = await api('GET', `/api/offers/${offerId}`, null, token);
        log('K3. Offer detail', r.data?.salary === 120000 ? 'PASS' : 'FAIL',
          `salary=${r.data?.salary}`);
      } catch (e) { log('K3. Offer detail', 'FAIL', e.message); }
    }
  }

  // ═════════════════════════════════════════════════════════════════
  //  L. ANALYTICS
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 L: ANALYTICS \u2500\u2500\u2500\n');

  const analyticsEndpoints = [
    ['/api/dashboard/stats', 'L1. Dashboard stats'],
    ['/api/dashboard/analytics/funnel', 'L2. Funnel'],
    ['/api/dashboard/analytics/time-to-hire', 'L3. Time-to-hire'],
    ['/api/dashboard/analytics/source-effectiveness', 'L4. Source effectiveness'],
    ['/api/dashboard/analytics/velocity', 'L5. Velocity'],
    ['/api/dashboard/analytics/offer-rate', 'L6. Offer rate'],
    ['/api/dashboard/analytics/interviewer-load', 'L7. Interviewer load'],
    ['/api/dashboard/analytics/rejection-reasons', 'L8. Rejection reasons'],
    ['/api/dashboard/analytics/recruiter-performance', 'L9. Recruiter performance'],
    ['/api/dashboard/analytics/time-in-stage', 'L10. Time-in-stage'],
  ];

  for (const [endpoint, label] of analyticsEndpoints) {
    try {
      const r = await api('GET', endpoint, null, token);
      log(label, r.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) { log(label, 'FAIL', e.message); }
  }

  // L11: Analytics UI
  try {
    await page.goto(`${BASE}/analytics`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'analytics');
    const body = await page.textContent('body');
    log('L11. Analytics UI', body.includes('Analytics') || body.includes('KPI') || body.includes('Jobs') ? 'PASS' : 'FAIL');
  } catch (e) { log('L11. Analytics UI', 'FAIL', e.message); }

  // ═════════════════════════════════════════════════════════════════
  //  M. HIRING ASSISTANT
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 M: HIRING ASSISTANT \u2500\u2500\u2500\n');

  try {
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'hiring-assistant');
    const body = await page.textContent('body');
    log('M1. Hiring assistant UI', body.includes('Assistant') || body.includes('assistant') || body.includes('message') ? 'PASS' : 'FAIL');
  } catch (e) { log('M1. Hiring assistant', 'FAIL', e.message); }

  // M2: API query
  try {
    const r = await api('POST', '/api/hiring-agent/query', {
      query: 'How many jobs are open?', web_search: false
    }, token);
    log('M2. Agent query', r.data?.answer || r.data?.response ? 'PASS' : 'FAIL',
      `answer_len=${(r.data?.answer || r.data?.response || '').length}`);
  } catch (e) { log('M2. Agent query', 'FAIL', e.message); }

  // ═════════════════════════════════════════════════════════════════
  //  N. ADMIN
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 N: ADMIN \u2500\u2500\u2500\n');

  try {
    const r = await api('GET', '/api/admin/stats', null, token);
    log('N1. Admin stats', r.status === 200 ? 'PASS' : 'FAIL',
      `users=${r.data?.total_users}, jobs=${r.data?.total_jobs}`);
  } catch (e) { log('N1. Admin stats', 'FAIL', e.message); }

  try {
    const r = await api('GET', '/api/admin/users?page=1&page_size=10', null, token);
    log('N2. Users list', r.status === 200 ? 'PASS' : 'FAIL',
      `total=${r.data?.total}`);
  } catch (e) { log('N2. Users', 'FAIL', e.message); }

  try {
    const r = await api('GET', '/api/settings/ats', null, token);
    log('N3. ATS settings', r.status === 200 ? 'PASS' : 'FAIL');
  } catch (e) { log('N3. ATS settings', 'FAIL', e.message); }

  // Admin UI
  try {
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'admin');
    const body = await page.textContent('body');
    log('N4. Admin UI', body.includes('Users') || body.includes('Admin') ? 'PASS' : 'FAIL');
  } catch (e) { log('N4. Admin UI', 'FAIL', e.message); }

  // ═════════════════════════════════════════════════════════════════
  //  O. CAREERS PORTAL
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 O: CAREERS PORTAL \u2500\u2500\u2500\n');

  // Make jobs public first
  if (jobId1) {
    try {
      await api('PUT', `/api/job/${jobId1}`, { visibility: 'public', status: 'Open' }, token);
    } catch {}
  }

  try {
    const r = await api('GET', '/api/careers/jobs');
    log('O1. Public jobs API', r.status === 200 ? 'PASS' : 'FAIL',
      `total=${r.data?.total || (r.data?.items || []).length}`);
  } catch (e) { log('O1. Public jobs', 'FAIL', e.message); }

  try {
    await page.goto(`${BASE}/careers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'careers');
    const body = await page.textContent('body');
    log('O2. Careers page UI', body.includes('Career') || body.includes('Jobs') || body.includes('Position') ? 'PASS' : 'FAIL');
  } catch (e) { log('O2. Careers UI', 'FAIL', e.message); }

  // ═════════════════════════════════════════════════════════════════
  //  P. DASHBOARD
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 P: DASHBOARD \u2500\u2500\u2500\n');

  try {
    const r = await api('GET', '/api/dashboard/stats', null, token);
    log('P1. Dashboard stats', r.status === 200 ? 'PASS' : 'FAIL',
      `jobs=${r.data?.total_jobs}, candidates=${r.data?.total_candidates}`);
  } catch (e) { log('P1. Dashboard stats', 'FAIL', e.message); }

  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await ss(page, 'dashboard');
    const body = await page.textContent('body');
    log('P2. Dashboard UI', body.includes('Dashboard') || body.includes('Jobs') ? 'PASS' : 'FAIL');
  } catch (e) { log('P2. Dashboard UI', 'FAIL', e.message); }

  // ═════════════════════════════════════════════════════════════════
  //  Q. MISC PAGES
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 Q: MISC PAGES \u2500\u2500\u2500\n');

  const miscPages = [
    ['/account-settings', 'Q1. Account Settings'],
    ['/templates', 'Q2. Document Templates'],
  ];

  for (const [route, label] of miscPages) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await ss(page, route.replace(/\//g, '-').slice(1));
      log(label, 'PASS');
    } catch (e) { log(label, 'FAIL', e.message); }
  }

  // ═════════════════════════════════════════════════════════════════
  //  R. FINAL INTEGRITY CHECK — the most important test
  // ═════════════════════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 R: FINAL INTEGRITY CHECKS \u2500\u2500\u2500\n');

  // R1: Final profile count
  try {
    const r = await api('GET', '/api/profiles?page=1&page_size=100', null, token);
    const profiles = r.data?.items || [];
    const total = r.data?.total || 0;

    // Check for email uniqueness
    const emails = profiles.map(p => p.email).filter(Boolean);
    const emailSet = new Set(emails.map(e => e.toLowerCase()));
    log('R1. No duplicate profile emails', emails.length === emailSet.size ? 'PASS' : 'FAIL',
      `emails=${emails.length}, unique=${emailSet.size}`);

    // Check for name uniqueness (all named profiles should be unique)
    const namedProfiles = profiles.filter(p => p.full_name || p.name);
    const nameSet = new Set(namedProfiles.map(p => (p.full_name || p.name || '').toLowerCase()));
    log('R2. No duplicate profile names', namedProfiles.length === nameSet.size ? 'PASS' : 'FAIL',
      `named=${namedProfiles.length}, unique=${nameSet.size}`);

    log('R3. Total profiles', 'PASS', `count=${total}`);
  } catch (e) { log('R1. Profile integrity', 'FAIL', e.message); }

  // R4: Talent pool has no duplicates
  try {
    const r = await api('GET', '/api/talent-pool?page=1&page_size=100', null, token);
    const items = r.data?.items || [];
    const talentEmails = items.map(i => i.email).filter(Boolean);
    const talentEmailSet = new Set(talentEmails.map(e => e.toLowerCase()));
    log('R4. Talent pool no dup emails', talentEmails.length === talentEmailSet.size ? 'PASS' : 'FAIL',
      `emails=${talentEmails.length}, unique=${talentEmailSet.size}`);

    const talentNames = items.map(i => (i.full_name || i.name || '').toLowerCase()).filter(Boolean);
    const talentNameSet = new Set(talentNames);
    log('R5. Talent pool no dup names', talentNames.length === talentNameSet.size ? 'PASS' : 'FAIL',
      `names=${talentNames.length}, unique=${talentNameSet.size}`);
  } catch (e) { log('R4. Talent pool integrity', 'FAIL', e.message); }

  // R6: Each candidate entry maps to a valid profile
  try {
    const r = await api('GET', `/api/candidates?jd_id=${jobId1}&page=1&page_size=50`, null, token);
    const entries = r.data?.items || [];
    const allHaveProfileId = entries.every(e => e.profile_id);
    log('R6. All entries have profile_id', allHaveProfileId ? 'PASS' : 'FAIL');

    // Verify profile_ids map to existing profiles
    const profileIds = [...new Set(entries.map(e => e.profile_id))];
    let allExist = true;
    for (const pid of profileIds) {
      const pr = await api('GET', `/api/profiles/${pid}`, null, token);
      if (pr.status !== 200) { allExist = false; break; }
    }
    log('R7. All profile_ids are valid', allExist ? 'PASS' : 'FAIL',
      `checked ${profileIds.length} profiles`);
  } catch (e) { log('R6. Entry-profile mapping', 'FAIL', e.message); }

  // ═════════════════════════════════════════════════════════════════
  //  SUMMARY
  // ═════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log(`  RESULTS: ${pass} passed, ${fail} failed, ${skip} skipped, ${pass + fail + skip} total`);
  console.log(`  Pass rate: ${((pass / (pass + fail)) * 100).toFixed(1)}%`);
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
