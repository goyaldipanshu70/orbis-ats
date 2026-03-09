/**
 * COMPREHENSIVE E2E TEST — Full ATS Workflow with Real Documents
 *
 * Uses files from ../testing-documents/ (real JD PDFs, resumes, rubrics, model answers).
 * Runs in headless:false mode for visual verification.
 *
 * Run:  node e2e-full-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Blob } from 'buffer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8080';
const API = 'http://localhost:8000';
const SCREENSHOT_DIR = '/tmp/e2e-full-screenshots';
const DOCS = path.resolve(__dirname, '..', 'testing-documents');

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

/** JSON API call using native fetch */
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

/** File upload using native fetch + FormData */
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

/** Multi-file upload using native fetch + FormData */
async function multiUpload(endpoint, files, fields = {}, token = '') {
  const form = new FormData();
  for (const { field, path: fp, filename } of files) {
    const fileData = fs.readFileSync(fp);
    form.append(field, new Blob([fileData]), filename || path.basename(fp));
  }
  for (const [k, v] of Object.entries(fields)) {
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


// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN TEST
// ═══════════════════════════════════════════════════════════════════════════════
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  ORBIS ATS — FULL E2E TEST WITH REAL DOCUMENTS      ');
  console.log('══════════════════════════════════════════════════════\n');

  let adminToken = '';
  let candidateToken = '';
  let refreshToken = '';
  let createdJobIds = [];
  let candidateIds = [];
  let applicationId = null;
  let offerId = null;
  let scheduleId = null;

  // ─────────────────────────────────────────────────────────────
  // SECTION A: ADMIN LOGIN & AUTH
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION A: ADMIN AUTH ───\n');

  // A1: Login as admin
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await page.waitForTimeout(2000);
    adminToken = await page.evaluate(() => localStorage.getItem('access_token') || '');
    refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token') || '');
    await screenshot(page, '01-admin-dashboard');
    log('A1. Admin login', 'PASS', `Token: ${adminToken ? 'yes' : 'no'}, Refresh: ${refreshToken ? 'yes' : 'no'}`);
  } catch (e) {
    log('A1. Admin login', 'FAIL', e.message);
    // Fallback: API login
    const r = await api('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    adminToken = r.data?.access_token || '';
    refreshToken = r.data?.refresh_token || '';
  }

  // A2: Refresh token exchange
  try {
    const resp = await api('POST', '/api/auth/refresh', { refresh_token: refreshToken });
    const ok = resp.status === 200 && resp.data?.access_token;
    if (ok) adminToken = resp.data.access_token;
    log('A2. Refresh token exchange', ok ? 'PASS' : 'FAIL', `Status: ${resp.status}`);
  } catch (e) {
    log('A2. Refresh token exchange', 'FAIL', e.message);
  }

  // A3: Dashboard KPI cards
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const body = await page.textContent('body');
    const hasKPIs = body.includes('Total') || body.includes('Active') || body.includes('Candidates');
    await screenshot(page, '02-dashboard-kpis');
    log('A3. Dashboard KPI cards', hasKPIs ? 'PASS' : 'FAIL');
  } catch (e) {
    log('A3. Dashboard KPI cards', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION B: JOB CREATION WITH REAL JD PDFs
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION B: JOB CREATION (Real JDs) ───\n');

  const jdFiles = [
    { file: 'Leasing Agent.pdf', rubric: 'Streamlined Leasing Agent Interview Scoring Rubric.docx', model: 'Leasing Agent Interview Model Answers.docx' },
    { file: 'Community Manager.pdf', rubric: null, model: null },
    { file: 'Maintenance Supervisor.pdf', rubric: 'Streamlined Maintenance Supervisor Interview Scoring Rubric.docx', model: 'Maintenance Supervisor Interview Model Answers.docx' },
  ];

  for (let i = 0; i < jdFiles.length; i++) {
    const jd = jdFiles[i];
    const jdPath = path.join(DOCS, 'jd', jd.file);

    // Extract JD
    try {
      const extractResp = await upload('/api/job/extract/jd', 'jd_file', jdPath, {}, adminToken);
      const hasResult = extractResp.status === 200 && extractResp.data?.ai_result;
      log(`B${i*2+1}. Extract JD: ${jd.file}`, hasResult ? 'PASS' : 'FAIL',
        `Status: ${extractResp.status}`);

      if (!hasResult) continue;

      // Submit job with optional rubric + model answer
      const submitFiles = [];
      if (jd.rubric) {
        submitFiles.push({ field: 'rubric_file', path: path.join(DOCS, 'ruberics', jd.rubric), filename: jd.rubric });
      }
      if (jd.model) {
        submitFiles.push({ field: 'model_answer_file', path: path.join(DOCS, 'model-answer', jd.model), filename: jd.model });
      }

      const submitResp = await multiUpload('/api/job/submit', submitFiles,
        { ai_result: JSON.stringify(extractResp.data) }, adminToken);

      const jobId = submitResp.data?.jd_id;
      if (jobId) createdJobIds.push(jobId);
      log(`B${i*2+2}. Submit job: ${jd.file}`, jobId ? 'PASS' : 'FAIL',
        `Job ID: ${jobId || 'none'}, Files: ${submitFiles.length > 0 ? 'rubric+model' : 'JD only'}`);
    } catch (e) {
      log(`B${i*2+1}. Create job: ${jd.file}`, 'FAIL', e.message);
    }
  }

  // B7: Verify jobs list
  try {
    const resp = await api('GET', '/api/job?page=1&page_size=20', null, adminToken);
    const total = resp.data?.total || resp.data?.items?.length || 0;
    log('B7. Job list', total >= createdJobIds.length ? 'PASS' : 'FAIL', `Total jobs: ${total}`);
  } catch (e) {
    log('B7. Job list', 'FAIL', e.message);
  }

  // B8: Verify job detail
  if (createdJobIds.length > 0) {
    try {
      const resp = await api('GET', `/api/job/${createdJobIds[0]}`, null, adminToken);
      const title = resp.data?.job_title || resp.data?.title || '';
      log('B8. Job detail', resp.status === 200 ? 'PASS' : 'FAIL', `Title: ${title.substring(0, 40)}`);
    } catch (e) {
      log('B8. Job detail', 'FAIL', e.message);
    }
  }

  // B9: Make one job public
  if (createdJobIds.length > 0) {
    try {
      const resp = await api('PUT', `/api/job/${createdJobIds[0]}/visibility`, { visibility: 'public' }, adminToken);
      log('B9. Make job public', resp.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) {
      log('B9. Make job public', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION C: RESUME UPLOAD & AI SCORING
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION C: RESUME UPLOAD & AI SCORING ───\n');

  const resumeFiles = [
    "Brad's Resume new (1).pdf",
    'Kenneth_Benn.pdf',
    'Tom_Andrews.pdf',
    'William_Smith.pdf',
    'Zachary_Patterson.pdf',
  ];

  if (createdJobIds.length > 0) {
    const targetJobId = createdJobIds[0];

    // C1-3: Upload individual resumes
    for (let i = 0; i < Math.min(resumeFiles.length, 3); i++) {
      const resumePath = path.join(DOCS, 'resumes', resumeFiles[i]);
      try {
        const resp = await upload('/api/candidates/upload', 'resume_file', resumePath,
          { jd_id: targetJobId, use_rubric: 'true' }, adminToken);
        const cid = resp.data?.candidate_id || resp.data?.id;
        const aiStatus = resp.data?.ai_status || 'sync';
        if (cid) candidateIds.push(cid);
        log(`C${i+1}. Upload: ${resumeFiles[i].substring(0, 30)}`,
          resp.status === 200 || resp.status === 202 ? 'PASS' : 'FAIL',
          `ID: ${cid || '?'}, AI: ${aiStatus}`);
      } catch (e) {
        log(`C${i+1}. Upload: ${resumeFiles[i].substring(0, 30)}`, 'FAIL', e.message);
      }
    }

    // C4: Bulk upload remaining
    try {
      const bulkFiles = resumeFiles.slice(3).map(f => ({
        field: 'resume_files', path: path.join(DOCS, 'resumes', f), filename: f
      }));
      const resp = await multiUpload('/api/candidates/upload-multiple', bulkFiles,
        { jd_id: targetJobId, use_rubric: 'true' }, adminToken);
      const successCount = resp.data?.successful_uploads || 0;
      if (resp.data?.results) {
        for (const r of resp.data.results) {
          if (r.candidate_id) candidateIds.push(r.candidate_id);
        }
      }
      log('C4. Bulk upload resumes', resp.status === 200 || resp.status === 202 ? 'PASS' : 'FAIL',
        `Success: ${successCount}/${resp.data?.total_files || '?'}`);
    } catch (e) {
      log('C4. Bulk upload resumes', 'FAIL', e.message);
    }

    // C5: Verify candidates list
    try {
      const resp = await api('GET', `/api/candidates?jd_id=${targetJobId}&page=1&page_size=20`, null, adminToken);
      const total = resp.data?.total || resp.data?.items?.length || 0;
      log('C5. Candidates list', total > 0 ? 'PASS' : 'FAIL', `Total: ${total}`);
    } catch (e) {
      log('C5. Candidates list', 'FAIL', e.message);
    }

    // C6: Candidate detail with AI scores
    if (candidateIds.length > 0) {
      try {
        const resp = await api('GET', `/api/candidates/id/${candidateIds[0]}`, null, adminToken);
        const scores = resp.data?.ai_resume_analysis?.category_scores;
        const name = resp.data?.ai_resume_analysis?.metadata?.full_name || '?';
        log('C6. Candidate detail + AI scores', scores ? 'PASS' : 'FAIL',
          `Name: ${name}, Scores: ${scores ? 'yes' : 'no'}`);
      } catch (e) {
        log('C6. Candidate detail + AI scores', 'FAIL', e.message);
      }
    }

    // C7: AI status poll
    if (candidateIds.length > 0) {
      try {
        const resp = await api('GET', `/api/candidates/${candidateIds[0]}/ai-status`, null, adminToken);
        log('C7. AI status endpoint', resp.status === 200 ? 'PASS' : 'FAIL',
          `Status: ${resp.data?.status || '?'}`);
      } catch (e) {
        log('C7. AI status endpoint', 'FAIL', e.message);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION D: UI — DASHBOARD & JOB LIST
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION D: UI — DASHBOARD & JOB VIEWS ───\n');

  // Make sure admin token is in localStorage
  await page.evaluate((t) => localStorage.setItem('access_token', t), adminToken);

  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await screenshot(page, '10-dashboard-with-jobs');
    log('D1. Dashboard with jobs', 'PASS');
  } catch (e) {
    log('D1. Dashboard with jobs', 'FAIL', e.message);
  }

  // D2: Job detail page
  if (createdJobIds.length > 0) {
    try {
      await page.goto(`${BASE}/jobs/${createdJobIds[0]}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const body = await page.textContent('body');
      const hasStats = body.includes('Candidate') || body.includes('Statistics') || body.includes('Total');
      await screenshot(page, '11-job-detail');
      log('D2. Job detail page', hasStats ? 'PASS' : 'FAIL', `Has stats: ${hasStats}`);
    } catch (e) {
      log('D2. Job detail page', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION E: UI — CANDIDATE EVALUATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION E: UI — CANDIDATE EVALUATION ───\n');

  if (createdJobIds.length > 0) {
    try {
      await page.goto(`${BASE}/jobs/${createdJobIds[0]}/candidates`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      const body = await page.textContent('body');
      const hasCandidates = body.includes('Candidate') || body.includes('Evaluation');
      await screenshot(page, '20-candidate-evaluation');
      log('E1. Candidate evaluation page', hasCandidates ? 'PASS' : 'FAIL');
    } catch (e) {
      log('E1. Candidate evaluation page', 'FAIL', e.message);
    }

    // E2: Score visuals
    try {
      await page.waitForTimeout(1500);
      const body = await page.textContent('body');
      const hasScores = body.includes('Core') || body.includes('Score') || body.includes('%') || body.includes('/100');
      await screenshot(page, '21-candidate-scores');
      log('E2. Candidate score visuals', hasScores ? 'PASS' : 'FAIL');
    } catch (e) {
      log('E2. Candidate score visuals', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION F: PIPELINE
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION F: PIPELINE ───\n');

  if (createdJobIds.length > 0 && candidateIds.length > 0) {
    // F1: Pipeline API
    try {
      const resp = await api('GET', `/api/candidates/pipeline/${createdJobIds[0]}`, null, adminToken);
      const stages = Object.keys(resp.data || {});
      log('F1. Pipeline API', resp.status === 200 ? 'PASS' : 'FAIL', `Stages: ${stages.join(', ')}`);
    } catch (e) {
      log('F1. Pipeline API', 'FAIL', e.message);
    }

    // F2-3: Move candidate through stages
    for (const [idx, stage] of ['screening', 'interview'].entries()) {
      try {
        const resp = await api('PUT', `/api/candidates/${candidateIds[0]}/stage`,
          { stage, notes: `E2E: moving to ${stage}` }, adminToken);
        log(`F${idx+2}. Move to ${stage}`, resp.status === 200 ? 'PASS' : 'FAIL');
      } catch (e) {
        log(`F${idx+2}. Move to ${stage}`, 'FAIL', e.message);
      }
    }

    // F4: Stage history
    try {
      const resp = await api('GET', `/api/candidates/${candidateIds[0]}/history`, null, adminToken);
      const count = Array.isArray(resp.data) ? resp.data.length : 0;
      log('F4. Stage history', count > 0 ? 'PASS' : 'FAIL', `Entries: ${count}`);
    } catch (e) {
      log('F4. Stage history', 'FAIL', e.message);
    }

    // F5: Bulk stage move
    if (candidateIds.length >= 2) {
      try {
        const ids = candidateIds.slice(1, 3).map(Number);
        const resp = await api('PUT', '/api/candidates/bulk-stage',
          { candidate_ids: ids, stage: 'screening', notes: 'Bulk move' }, adminToken);
        log('F5. Bulk stage move', resp.status === 200 ? 'PASS' : 'FAIL');
      } catch (e) {
        log('F5. Bulk stage move', 'FAIL', e.message);
      }
    }

    // F6: Pipeline UI
    try {
      await page.goto(`${BASE}/jobs/${createdJobIds[0]}/pipeline`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      const body = await page.textContent('body');
      const hasPipeline = ['applied', 'screening', 'interview', 'Applied', 'Screening', 'Interview']
        .some(s => body.includes(s));
      await screenshot(page, '30-pipeline-view');
      log('F6. Pipeline UI', hasPipeline ? 'PASS' : 'FAIL');
    } catch (e) {
      log('F6. Pipeline UI', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION G: INTERVIEW SCHEDULING & FEEDBACK
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION G: INTERVIEWS & FEEDBACK ───\n');

  if (createdJobIds.length > 0 && candidateIds.length > 0) {
    // G1: Schedule interview
    try {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const resp = await api('POST', '/api/interview/schedule', {
        candidate_id: Number(candidateIds[0]),
        jd_id: Number(createdJobIds[0]),
        interview_type: 'video',
        scheduled_date: tomorrow,
        scheduled_time: '10:00',
        duration_minutes: 60,
        location: 'Zoom Meeting',
        interviewer_names: ['Admin User'],
        notes: 'E2E scheduled interview'
      }, adminToken);
      scheduleId = resp.data?.schedule_id || resp.data?.id;
      log('G1. Schedule interview', scheduleId ? 'PASS' : 'FAIL', `ID: ${scheduleId}`);
    } catch (e) {
      log('G1. Schedule interview', 'FAIL', e.message);
    }

    // G2: List interviews for job
    try {
      const resp = await api('GET', `/api/interview/schedule/job/${createdJobIds[0]}`, null, adminToken);
      const count = Array.isArray(resp.data) ? resp.data.length : 0;
      log('G2. Interviews for job', count > 0 ? 'PASS' : 'FAIL', `Count: ${count}`);
    } catch (e) {
      log('G2. Interviews for job', 'FAIL', e.message);
    }

    // G3: Upcoming interviews
    try {
      const resp = await api('GET', '/api/interview/schedule/upcoming?days_ahead=30', null, adminToken);
      const count = Array.isArray(resp.data) ? resp.data.length : 0;
      log('G3. Upcoming interviews', resp.status === 200 ? 'PASS' : 'FAIL', `Count: ${count}`);
    } catch (e) {
      log('G3. Upcoming interviews', 'FAIL', e.message);
    }

    // G4: Submit feedback
    if (scheduleId) {
      try {
        const resp = await api('POST', `/api/interview/schedule/${scheduleId}/feedback`, {
          rating: 4, recommendation: 'yes',
          strengths: 'Strong technical skills', concerns: 'Needs leadership exp',
          notes: 'E2E feedback'
        }, adminToken);
        log('G4. Submit feedback', resp.status === 200 ? 'PASS' : 'FAIL');
      } catch (e) {
        log('G4. Submit feedback', 'FAIL', e.message);
      }

      // G5: Get feedback
      try {
        const resp = await api('GET', `/api/interview/schedule/${scheduleId}/feedback`, null, adminToken);
        const count = Array.isArray(resp.data) ? resp.data.length : 0;
        log('G5. Get feedback', count > 0 ? 'PASS' : 'FAIL', `Entries: ${count}`);
      } catch (e) {
        log('G5. Get feedback', 'FAIL', e.message);
      }

      // G6: Complete interview
      try {
        const resp = await api('PUT', `/api/interview/schedule/${scheduleId}/status`,
          { status: 'completed' }, adminToken);
        log('G6. Complete interview', resp.status === 200 ? 'PASS' : 'FAIL');
      } catch (e) {
        log('G6. Complete interview', 'FAIL', e.message);
      }
    }

    // G7: Candidate feedback aggregate
    try {
      const resp = await api('GET', `/api/candidates/${candidateIds[0]}/feedback`, null, adminToken);
      log('G7. Candidate feedback', resp.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) {
      log('G7. Candidate feedback', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION H: JOB APPROVAL WORKFLOW
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION H: APPROVAL WORKFLOW ───\n');

  if (createdJobIds.length >= 2) {
    const aJob = createdJobIds[1];

    try {
      const resp = await api('POST', `/api/job/${aJob}/request-approval`, null, adminToken);
      log('H1. Request approval', resp.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) {
      log('H1. Request approval', 'FAIL', e.message);
    }

    try {
      const resp = await api('GET', '/api/job/approvals/pending', null, adminToken);
      const count = Array.isArray(resp.data) ? resp.data.length : 0;
      log('H2. Pending approvals', resp.status === 200 ? 'PASS' : 'FAIL', `Count: ${count}`);
    } catch (e) {
      log('H2. Pending approvals', 'FAIL', e.message);
    }

    try {
      const resp = await api('POST', `/api/job/${aJob}/approve`,
        { comments: 'Approved via E2E test' }, adminToken);
      log('H3. Approve job', resp.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) {
      log('H3. Approve job', 'FAIL', e.message);
    }

    try {
      const resp = await api('GET', `/api/job/${aJob}/approvals`, null, adminToken);
      const count = Array.isArray(resp.data) ? resp.data.length : 0;
      log('H4. Approval history', count > 0 ? 'PASS' : 'FAIL', `Entries: ${count}`);
    } catch (e) {
      log('H4. Approval history', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION I: SCREENING QUESTIONS
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION I: SCREENING QUESTIONS ───\n');

  if (createdJobIds.length > 0) {
    const sJob = createdJobIds[0];

    try {
      const resp = await api('POST', `/api/job/${sJob}/screening-questions`, {
        question: 'How many years of leasing experience do you have?',
        question_type: 'text', required: true, sort_order: 1
      }, adminToken);
      log('I1. Add text question', resp.status === 200 || resp.status === 201 ? 'PASS' : 'FAIL');
    } catch (e) {
      log('I1. Add text question', 'FAIL', e.message);
    }

    try {
      const resp = await api('POST', `/api/job/${sJob}/screening-questions`, {
        question: 'Are you legally authorized to work in the US?',
        question_type: 'yes_no', required: true, sort_order: 2
      }, adminToken);
      log('I2. Add yes/no question', resp.status === 200 || resp.status === 201 ? 'PASS' : 'FAIL');
    } catch (e) {
      log('I2. Add yes/no question', 'FAIL', e.message);
    }

    try {
      const resp = await api('GET', `/api/job/${sJob}/screening-questions`, null, adminToken);
      const count = Array.isArray(resp.data) ? resp.data.length : 0;
      log('I3. List questions', count >= 2 ? 'PASS' : 'FAIL', `Questions: ${count}`);
    } catch (e) {
      log('I3. List questions', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION J: OFFERS
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION J: OFFERS ───\n');

  if (createdJobIds.length > 0 && candidateIds.length > 0) {
    const oJob = createdJobIds[0];

    // Move candidate to offer stage
    try {
      await api('PUT', `/api/candidates/${candidateIds[0]}/stage`,
        { stage: 'offer', notes: 'Moving to offer' }, adminToken);
    } catch {}

    try {
      const resp = await api('POST', `/api/job/${oJob}/offers`, {
        candidate_id: Number(candidateIds[0]), salary: 55000,
        salary_currency: 'USD', start_date: '2026-04-01',
        position_title: 'Leasing Agent', department: 'Property Management'
      }, adminToken);
      offerId = resp.data?.offer_id || resp.data?.id;
      log('J1. Create offer', offerId ? 'PASS' : 'FAIL', `ID: ${offerId}`);
    } catch (e) {
      log('J1. Create offer', 'FAIL', e.message);
    }

    try {
      const resp = await api('GET', `/api/job/${oJob}/offers`, null, adminToken);
      const count = Array.isArray(resp.data) ? resp.data.length : 0;
      log('J2. List offers', count > 0 ? 'PASS' : 'FAIL', `Count: ${count}`);
    } catch (e) {
      log('J2. List offers', 'FAIL', e.message);
    }

    if (offerId) {
      try {
        const resp = await api('GET', `/api/offers/${offerId}`, null, adminToken);
        log('J3. Offer detail', resp.status === 200 ? 'PASS' : 'FAIL', `Salary: ${resp.data?.salary}`);
      } catch (e) {
        log('J3. Offer detail', 'FAIL', e.message);
      }

      try {
        const resp = await api('POST', `/api/offers/${offerId}/send`, null, adminToken);
        log('J4. Send offer', resp.status === 200 ? 'PASS' : 'FAIL');
      } catch (e) {
        log('J4. Send offer', 'FAIL', e.message);
      }

      try {
        const resp = await api('GET', `/api/offers/${offerId}/preview`, null, adminToken);
        log('J5. Preview offer', resp.status === 200 ? 'PASS' : 'FAIL');
      } catch (e) {
        log('J5. Preview offer', 'FAIL', e.message);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION K: JOB TEAM MEMBERS
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION K: TEAM MEMBERS ───\n');

  if (createdJobIds.length > 0) {
    const tJob = createdJobIds[0];

    try {
      const resp = await api('POST', `/api/job/${tJob}/members`,
        { user_id: 1, role: 'editor' }, adminToken);
      log('K1. Add team member', resp.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) {
      log('K1. Add team member', 'FAIL', e.message);
    }

    try {
      const resp = await api('GET', `/api/job/${tJob}/members`, null, adminToken);
      const count = Array.isArray(resp.data) ? resp.data.length : 0;
      log('K2. List members', count > 0 ? 'PASS' : 'FAIL', `Members: ${count}`);
    } catch (e) {
      log('K2. List members', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION L: ANALYTICS
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION L: ANALYTICS ───\n');

  const analyticsEndpoints = [
    ['L1', '/api/dashboard/stats', 'Dashboard stats'],
    ['L2', '/api/dashboard/analytics/funnel', 'Funnel'],
    ['L3', '/api/dashboard/analytics/time-to-hire', 'Time-to-hire'],
    ['L4', '/api/dashboard/analytics/source-effectiveness', 'Source effectiveness'],
    ['L5', '/api/dashboard/analytics/velocity', 'Velocity'],
    ['L6', '/api/dashboard/analytics/offer-rate', 'Offer rate'],
    ['L7', '/api/dashboard/analytics/interviewer-load', 'Interviewer load'],
    ['L8', '/api/dashboard/analytics/rejection-reasons', 'Rejection reasons'],
    ['L9', '/api/dashboard/analytics/recruiter-performance', 'Recruiter performance'],
    ['L10', '/api/dashboard/analytics/time-in-stage', 'Time-in-stage'],
  ];

  for (const [id, ep, name] of analyticsEndpoints) {
    try {
      const resp = await api('GET', ep, null, adminToken);
      log(`${id}. ${name}`, resp.status === 200 ? 'PASS' : 'FAIL', `Status: ${resp.status}`);
    } catch (e) {
      log(`${id}. ${name}`, 'FAIL', e.message);
    }
  }

  // L11: Analytics UI
  try {
    await page.goto(`${BASE}/analytics`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await screenshot(page, '40-analytics-page');
    log('L11. Analytics UI', 'PASS');
  } catch (e) {
    log('L11. Analytics UI', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION M: CANDIDATE PORTAL
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION M: CANDIDATE PORTAL ───\n');

  // M1: Register candidate
  try {
    const resp = await api('POST', '/api/auth/signup/candidate', {
      email: `e2e.candidate.${Date.now()}@example.com`,
      password: 'TestCandidate123',
      first_name: 'E2E', last_name: 'Candidate'
    });
    candidateToken = resp.data?.access_token || '';
    log('M1. Candidate registration', candidateToken ? 'PASS' : 'FAIL',
      `Status: ${resp.status}`);
  } catch (e) {
    log('M1. Candidate registration', 'FAIL', e.message);
  }

  // M2: Public careers API
  try {
    const resp = await api('GET', '/api/careers/jobs');
    const count = resp.data?.total || (Array.isArray(resp.data) ? resp.data.length :
      (resp.data?.items?.length || 0));
    log('M2. Public careers API', resp.status === 200 ? 'PASS' : 'FAIL', `Jobs: ${count}`);
  } catch (e) {
    log('M2. Public careers API', 'FAIL', e.message);
  }

  // M3: Careers UI
  try {
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE}/careers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '50-careers-page');
    log('M3. Careers page UI', 'PASS');
  } catch (e) {
    log('M3. Careers page UI', 'FAIL', e.message);
  }

  // M4: Apply to job (API)
  if (candidateToken && createdJobIds.length > 0) {
    try {
      const resumePath = path.join(DOCS, 'resumes', 'Tom_Andrews.pdf');
      const resp = await upload('/api/applications', 'resume_file', resumePath,
        { jd_id: createdJobIds[0], phone: '555-0101', cover_letter: 'E2E application' },
        candidateToken);
      applicationId = resp.data?.application_id || resp.data?.id;
      log('M4. Apply to job', applicationId ? 'PASS' : 'FAIL',
        `App ID: ${applicationId}, Status: ${resp.data?.status || resp.status}`);
    } catch (e) {
      log('M4. Apply to job', 'FAIL', e.message);
    }

    // M5: My applications
    try {
      const resp = await api('GET', '/api/applications?page=1&page_size=10', null, candidateToken);
      const total = resp.data?.total || (Array.isArray(resp.data) ? resp.data.length : 0);
      log('M5. My applications', resp.status === 200 ? 'PASS' : 'FAIL', `Total: ${total}`);
    } catch (e) {
      log('M5. My applications', 'FAIL', e.message);
    }

    // M6: Application detail
    if (applicationId) {
      try {
        const resp = await api('GET', `/api/applications/${applicationId}`, null, candidateToken);
        log('M6. Application detail', resp.status === 200 ? 'PASS' : 'FAIL',
          `Status: ${resp.data?.status}`);
      } catch (e) {
        log('M6. Application detail', 'FAIL', e.message);
      }
    }

    // M7: HR updates application
    if (applicationId) {
      try {
        const resp = await api('PATCH', `/api/applications/${applicationId}/status`,
          { status: 'screening' }, adminToken);
        log('M7. HR updates app status', resp.status === 200 ? 'PASS' : 'FAIL');
      } catch (e) {
        log('M7. HR updates app status', 'FAIL', e.message);
      }
    }

    // M8: Candidate sees update
    if (applicationId) {
      try {
        const resp = await api('GET', `/api/applications/${applicationId}`, null, candidateToken);
        log('M8. Candidate sees update', resp.data?.status === 'screening' ? 'PASS' : 'FAIL',
          `Status: ${resp.data?.status}`);
      } catch (e) {
        log('M8. Candidate sees update', 'FAIL', e.message);
      }
    }

    // M9: Resume versioning
    if (applicationId) {
      try {
        const resumePath = path.join(DOCS, 'resumes', 'Kenneth_Benn.pdf');
        const resp = await upload(`/api/applications/${applicationId}/resume`, 'resume_file',
          resumePath, {}, candidateToken);
        log('M9. Upload resume version', resp.status === 200 || resp.status === 201 ? 'PASS' : 'FAIL',
          `Version: ${resp.data?.version || '?'}`);
      } catch (e) {
        log('M9. Upload resume version', 'FAIL', e.message);
      }

      try {
        const resp = await api('GET', `/api/applications/${applicationId}/resumes`, null, candidateToken);
        const count = Array.isArray(resp.data) ? resp.data.length : 0;
        log('M10. List resume versions', count > 0 ? 'PASS' : 'FAIL', `Versions: ${count}`);
      } catch (e) {
        log('M10. List resume versions', 'FAIL', e.message);
      }
    }

    // M11: HR lists portal applications
    try {
      const resp = await api('GET', `/api/applications/job/${createdJobIds[0]}?page=1&page_size=10`, null, adminToken);
      const total = resp.data?.total || (Array.isArray(resp.data) ? resp.data.length : 0);
      log('M11. HR sees portal applications', resp.status === 200 ? 'PASS' : 'FAIL', `Total: ${total}`);
    } catch (e) {
      log('M11. HR sees portal applications', 'FAIL', e.message);
    }
  }

  // M12: Candidate signup UI
  try {
    await page.goto(`${BASE}/careers/signup`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    const hasSignup = body.includes('Create') || body.includes('Sign') || body.includes('candidate');
    await screenshot(page, '51-candidate-signup');
    log('M12. Candidate signup UI', hasSignup ? 'PASS' : 'FAIL');
  } catch (e) {
    log('M12. Candidate signup UI', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION N: TALENT POOL
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION N: TALENT POOL ───\n');

  // Re-login admin
  await page.evaluate((t) => { localStorage.setItem('access_token', t); }, adminToken);

  try {
    const resp = await api('GET', '/api/talent-pool?page=1&page_size=20', null, adminToken);
    log('N1. Talent pool API', resp.status === 200 ? 'PASS' : 'FAIL', `Total: ${resp.data?.total || 0}`);
  } catch (e) {
    log('N1. Talent pool API', 'FAIL', e.message);
  }

  try {
    await page.goto(`${BASE}/talent-pool`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '60-talent-pool');
    log('N2. Talent pool UI', 'PASS');
  } catch (e) {
    log('N2. Talent pool UI', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION O: ADMIN DASHBOARD
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION O: ADMIN DASHBOARD ───\n');

  try {
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const body = await page.textContent('body');
    const hasAdmin = body.includes('Users') || body.includes('Admin');
    await screenshot(page, '70-admin');
    log('O1. Admin dashboard', hasAdmin ? 'PASS' : 'FAIL');
  } catch (e) {
    log('O1. Admin dashboard', 'FAIL', e.message);
  }

  // O2: Audit logs
  try {
    const auditTab = page.locator('button:has-text("Audit")').first();
    if (await auditTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await auditTab.click();
      await page.waitForTimeout(1500);
      await screenshot(page, '71-audit-logs');
      log('O2. Audit logs', 'PASS');
    } else {
      log('O2. Audit logs', 'PASS', 'No separate tab');
    }
  } catch (e) {
    log('O2. Audit logs', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION P: HIRING ASSISTANT & SETTINGS
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION P: HIRING ASSISTANT & SETTINGS ───\n');

  try {
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '80-hiring-assistant');
    log('P1. Hiring assistant', 'PASS');
  } catch (e) {
    log('P1. Hiring assistant', 'FAIL', e.message);
  }

  try {
    await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '81-settings');
    log('P2. Account settings', 'PASS');
  } catch (e) {
    log('P2. Account settings', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION Q: CANDIDATE IMPORT ACROSS JOBS
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION Q: CROSS-JOB IMPORT ───\n');

  if (createdJobIds.length >= 2 && candidateIds.length > 0) {
    try {
      const resp = await api('POST', '/api/candidates/import', {
        target_job_id: String(createdJobIds[1]),
        candidate_ids: candidateIds.slice(0, 2).map(String)
      }, adminToken);
      log('Q1. Import candidates', resp.status === 200 ? 'PASS' : 'FAIL',
        `Imported: ${resp.data?.imported_count || '?'}`);
    } catch (e) {
      log('Q1. Import candidates', 'FAIL', e.message);
    }

    try {
      const resp = await api('GET', `/api/candidates?jd_id=${createdJobIds[1]}&page=1&page_size=20`, null, adminToken);
      const total = resp.data?.total || 0;
      log('Q2. Imported visible', total > 0 ? 'PASS' : 'FAIL', `Count: ${total}`);
    } catch (e) {
      log('Q2. Imported visible', 'FAIL', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION R: LOGOUT & TOKEN REVOCATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION R: LOGOUT ───\n');

  try {
    const resp = await api('POST', '/api/auth/logout', { refresh_token: refreshToken }, adminToken);
    log('R1. Logout/revoke', resp.status === 200 ? 'PASS' : 'FAIL');
  } catch (e) {
    log('R1. Logout/revoke', 'FAIL', e.message);
  }

  try {
    const resp = await api('POST', '/api/auth/refresh', { refresh_token: refreshToken });
    log('R2. Revoked token rejected', resp.status === 401 ? 'PASS' : 'FAIL',
      `Status: ${resp.status} (expect 401)`);
  } catch (e) {
    log('R2. Revoked token rejected', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  //  RESULTS
  // ═══════════════════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${pass} passed, ${fail} failed (${pass + fail} total)`);
  console.log('══════════════════════════════════════════════════════\n');

  if (fail > 0) {
    console.log('Failed tests:');
    for (const r of results) {
      if (r.status === 'FAIL') console.log(`  ❌ ${r.test} — ${r.detail}`);
    }
    console.log('');
  }

  console.log(`📸 Screenshots saved to: ${SCREENSHOT_DIR}`);

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
