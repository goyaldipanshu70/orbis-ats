/**
 * INTERVIEWER MODULE E2E TEST — Complete Interviewer Flow Verification
 *
 * Tests the entire interviewer module end-to-end:
 *   A. Auth — Interviewer invite + accept + login
 *   B. Interviewer CRUD — list, get, update, activate/deactivate
 *   C. Interview Panel Builder — multi-round panel creation
 *   D. Interviewer Dashboard — my interviews + stats (as interviewer)
 *   E. Structured Feedback — submit, retrieve, aggregate
 *   F. Interviewer UI Pages — management, dashboard, feedback form, aggregate view
 *   G. Accept Invite UI — invite page rendering
 *   H. Pipeline Integration — feedback indicators on pipeline
 *   I. Sidebar Navigation — interviewer role restrictions
 *
 * Run:  node e2e-interviewer-test.mjs
 *
 * Requires: svc-gateway (8000), svc-auth (8001), svc-recruiting (8002),
 *           UI dev server (8080), PostgreSQL
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8080';
const API  = 'http://localhost:8000';
const SCREENSHOT_DIR = '/tmp/e2e-interviewer-screenshots';

const ADMIN_EMAIL = 'admin@orbis.io';
const ADMIN_PASS  = 'admin123';
const INTERVIEWER_EMAIL = `test-interviewer-e2e-${Date.now()}@orbis.io`;
const INTERVIEWER_PASS  = 'TestPass1234!';
const INTERVIEWER_FIRST = 'TestE2E';
const INTERVIEWER_LAST  = 'Interviewer';

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
  console.log('\n' + '='.repeat(60));
  console.log('  ORBIS ATS -- INTERVIEWER MODULE E2E TEST');
  console.log('='.repeat(60) + '\n');

  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  let adminToken = null;
  let interviewerToken = null;
  let interviewerProfileId = null;
  let interviewerUserId = null;
  let inviteToken = null;
  let jobId = null;
  let entryId = null;   // candidate entry _id
  let candidateId = null; // numeric candidate_id for panel
  let scheduleId1 = null;
  let scheduleId2 = null;

  // =================================================================
  //  SETUP: Login as admin + create job + upload candidate
  // =================================================================
  console.log('\n--- SETUP: Admin login + test data ---\n');

  // Admin login
  try {
    const r = await api('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    adminToken = r.data?.access_token;
    log('SETUP-1. Admin login', adminToken ? 'PASS' : 'FAIL');
  } catch (e) { log('SETUP-1. Admin login', 'FAIL', e.message); }

  if (!adminToken) {
    console.log('\nFATAL: Cannot proceed without admin token');
    await browser.close();
    process.exit(1);
  }

  // Create a test job
  try {
    const aiResult = JSON.stringify({
      ai_result: {
        job_title: 'E2E Interviewer Test Engineer',
        department: 'Engineering',
        experience_required: '3+ years',
        key_skills: ['Python', 'Testing', 'CI/CD'],
        job_description: 'Testing position for E2E interviewer module verification.',
        responsibilities: ['Write tests', 'Review code', 'Maintain CI'],
        qualifications: ['BS in CS']
      }
    });
    const formData = new FormData();
    formData.append('ai_result', aiResult);
    formData.append('number_of_vacancies', '2');
    formData.append('country', 'United States');
    formData.append('city', 'San Francisco');
    const r = await fetch(`${API}/api/job/submit`, {
      method: 'POST', body: formData,
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await r.json();
    jobId = data?.jd_id || data?.job_id || data?.id;
    log('SETUP-2. Create test job', jobId ? 'PASS' : 'FAIL', `id=${jobId}`);
  } catch (e) { log('SETUP-2. Create job', 'FAIL', e.message); }

  // Upload a candidate (find any resume PDF)
  if (jobId) {
    try {
      const resumes = fs.readdirSync(RESUME_DIR).filter(f => f.endsWith('.pdf'));
      if (resumes.length > 0) {
        const r = await uploadFile('/api/candidates/upload',
          path.join(RESUME_DIR, resumes[0]), 'resume_file',
          { jd_id: jobId, use_rubric: 'true' }, adminToken);
        entryId = r.data?.candidate_id;
        log('SETUP-3. Upload candidate', entryId ? 'PASS' : 'FAIL', `entry=${entryId}`);
      } else {
        log('SETUP-3. Upload candidate', 'SKIP', 'no resume PDFs found');
      }
    } catch (e) { log('SETUP-3. Upload candidate', 'FAIL', e.message); }

    // Get numeric candidate_id from entry
    if (entryId) {
      try {
        const r = await api('GET', `/api/candidates?jd_id=${jobId}&page=1&page_size=50`, null, adminToken);
        const items = r.data?.items || [];
        const entry = items.find(i => String(i._id) === String(entryId));
        candidateId = entry?._id || entryId;
        log('SETUP-4. Resolve candidate_id', candidateId ? 'PASS' : 'FAIL', `candidate_id=${candidateId}`);
      } catch (e) { log('SETUP-4. Resolve candidate_id', 'FAIL', e.message); }

      // Move to interview stage
      try {
        await api('PUT', `/api/candidates/${entryId}/stage`, { stage: 'screening' }, adminToken);
        const r = await api('PUT', `/api/candidates/${entryId}/stage`, { stage: 'interview' }, adminToken);
        log('SETUP-5. Move to interview stage', r.status === 200 ? 'PASS' : 'FAIL');
      } catch (e) { log('SETUP-5. Move stage', 'FAIL', e.message); }
    }
  }

  // =================================================================
  //  A. AUTH -- Interviewer Invite Flow
  // =================================================================
  console.log('\n--- A: AUTH -- Interviewer Invite Flow ---\n');

  // A1: Invite new interviewer
  try {
    const r = await api('POST', '/api/interviewers/invite', {
      email: INTERVIEWER_EMAIL,
      first_name: INTERVIEWER_FIRST,
      last_name: INTERVIEWER_LAST,
      specializations: ['Backend', 'System Design'],
      seniority: 'senior'
    }, adminToken);

    interviewerProfileId = r.data?.profile_id;
    interviewerUserId = r.data?.user_id;
    const inviteUrl = r.data?.invite_url || '';

    // Extract token from invite URL (format: .../invite/<token>)
    const urlMatch = inviteUrl.match(/\/invite\/([^/?]+)/);
    inviteToken = urlMatch ? urlMatch[1] : null;

    log('A1. Invite interviewer', r.status === 200 && interviewerProfileId ? 'PASS' : 'FAIL',
      `profile_id=${interviewerProfileId}, user_id=${interviewerUserId}, has_token=${!!inviteToken}`);
  } catch (e) { log('A1. Invite interviewer', 'FAIL', e.message); }

  // A2: Accept invite with password
  if (inviteToken) {
    try {
      const r = await api('POST', '/api/auth/accept-invite', {
        token: inviteToken,
        password: INTERVIEWER_PASS
      });
      const acceptToken = r.data?.access_token;
      if (acceptToken) interviewerToken = acceptToken;
      log('A2. Accept invite', r.status === 200 && acceptToken ? 'PASS' : 'FAIL',
        `has_token=${!!acceptToken}`);
    } catch (e) { log('A2. Accept invite', 'FAIL', e.message); }
  } else {
    log('A2. Accept invite', 'SKIP', 'no invite token');
  }

  // A3: Login as interviewer
  try {
    const r = await api('POST', '/api/auth/login', {
      email: INTERVIEWER_EMAIL,
      password: INTERVIEWER_PASS
    });
    if (r.data?.access_token) interviewerToken = r.data.access_token;
    log('A3. Interviewer login', r.data?.access_token ? 'PASS' : 'FAIL',
      `role=${r.data?.role || 'unknown'}`);
  } catch (e) { log('A3. Interviewer login', 'FAIL', e.message); }

  // A4: Verify interviewer profile
  if (interviewerToken) {
    try {
      const r = await api('GET', '/api/auth/me', null, interviewerToken);
      const isCorrect = r.data?.role === 'interviewer' &&
                        r.data?.email === INTERVIEWER_EMAIL;
      log('A4. Interviewer profile', isCorrect ? 'PASS' : 'FAIL',
        `role=${r.data?.role}, email=${r.data?.email}`);
    } catch (e) { log('A4. Interviewer profile', 'FAIL', e.message); }
  } else {
    log('A4. Interviewer profile', 'SKIP', 'no interviewer token');
  }

  // =================================================================
  //  B. INTERVIEWER CRUD (as admin)
  // =================================================================
  console.log('\n--- B: INTERVIEWER CRUD ---\n');

  // B5: List interviewers
  try {
    const r = await api('GET', '/api/interviewers', null, adminToken);
    const list = Array.isArray(r.data) ? r.data : [];
    const found = list.some(i =>
      i.email === INTERVIEWER_EMAIL || String(i.id) === String(interviewerProfileId)
    );
    log('B5. List interviewers', found ? 'PASS' : 'FAIL',
      `total=${list.length}, found_ours=${found}`);
  } catch (e) { log('B5. List interviewers', 'FAIL', e.message); }

  // B6: Get profile detail
  if (interviewerProfileId) {
    try {
      const r = await api('GET', `/api/interviewers/${interviewerProfileId}`, null, adminToken);
      const hasFields = r.data?.email && r.data?.seniority;
      log('B6. Interviewer detail', r.status === 200 && hasFields ? 'PASS' : 'FAIL',
        `email=${r.data?.email}, seniority=${r.data?.seniority}, specs=${JSON.stringify(r.data?.specializations)}`);
    } catch (e) { log('B6. Interviewer detail', 'FAIL', e.message); }

    // B7: Update profile (change department)
    try {
      const r = await api('PUT', `/api/interviewers/${interviewerProfileId}`, {
        department: 'Engineering'
      }, adminToken);
      log('B7. Update profile', r.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) { log('B7. Update profile', 'FAIL', e.message); }

    // B8: Verify update persisted
    try {
      const r = await api('GET', `/api/interviewers/${interviewerProfileId}`, null, adminToken);
      log('B8. Update persisted', r.data?.department === 'Engineering' ? 'PASS' : 'FAIL',
        `department=${r.data?.department}`);
    } catch (e) { log('B8. Verify update', 'FAIL', e.message); }

    // B9: Deactivate
    try {
      const r = await api('PATCH', `/api/interviewers/${interviewerProfileId}/status`, {
        is_active: false
      }, adminToken);
      log('B9. Deactivate interviewer', r.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) { log('B9. Deactivate', 'FAIL', e.message); }

    // B10: Reactivate
    try {
      const r = await api('PATCH', `/api/interviewers/${interviewerProfileId}/status`, {
        is_active: true
      }, adminToken);
      log('B10. Reactivate interviewer', r.status === 200 ? 'PASS' : 'FAIL');
    } catch (e) { log('B10. Reactivate', 'FAIL', e.message); }
  } else {
    log('B6-B10. Interviewer CRUD', 'SKIP', 'no profile_id');
  }

  // =================================================================
  //  C. INTERVIEW PANEL BUILDER (as admin)
  // =================================================================
  console.log('\n--- C: INTERVIEW PANEL BUILDER ---\n');

  if (jobId && candidateId && interviewerUserId) {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const dayAfter = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

    // C11: Create multi-round panel
    try {
      const r = await api('POST', '/api/interview/panel', {
        candidate_id: Number(candidateId),
        jd_id: Number(jobId),
        rounds: [
          {
            round_number: 1,
            round_type: 'technical',
            interviewer_ids: [interviewerUserId],
            interviewer_names: [`${INTERVIEWER_FIRST} ${INTERVIEWER_LAST}`],
            scheduled_date: tomorrow,
            scheduled_time: '10:00',
            duration_minutes: 60,
            location: 'Zoom',
            meeting_link: 'https://zoom.us/test-round-1',
            notes: 'Technical round — backend systems'
          },
          {
            round_number: 2,
            round_type: 'behavioral',
            interviewer_ids: [interviewerUserId],
            interviewer_names: [`${INTERVIEWER_FIRST} ${INTERVIEWER_LAST}`],
            scheduled_date: dayAfter,
            scheduled_time: '14:00',
            duration_minutes: 45,
            location: 'Zoom',
            meeting_link: 'https://zoom.us/test-round-2',
            notes: 'Behavioral round — culture fit'
          }
        ]
      }, adminToken);

      const rounds = r.data?.rounds || [];
      if (rounds.length >= 2) {
        scheduleId1 = rounds[0].id || rounds[0].schedule_id;
        scheduleId2 = rounds[1].id || rounds[1].schedule_id;
      }
      log('C11. Create interview panel', r.status === 200 && rounds.length === 2 ? 'PASS' : 'FAIL',
        `rounds=${rounds.length}, schedule_ids=[${scheduleId1}, ${scheduleId2}]`);
    } catch (e) { log('C11. Create panel', 'FAIL', e.message); }

    // C12: Get panel
    try {
      const r = await api('GET', `/api/interview/panel/${candidateId}/${jobId}`, null, adminToken);
      const panelRounds = Array.isArray(r.data) ? r.data : [];
      const hasRoundTypes = panelRounds.some(r => r.round_type === 'technical') &&
                            panelRounds.some(r => r.round_type === 'behavioral');
      log('C12. Get panel', panelRounds.length >= 2 && hasRoundTypes ? 'PASS' : 'FAIL',
        `rounds=${panelRounds.length}, types=${panelRounds.map(r => r.round_type).join(',')}`);
    } catch (e) { log('C12. Get panel', 'FAIL', e.message); }

    // C13: Verify candidate in interview stage
    try {
      const r = await api('GET', `/api/candidates/pipeline/${jobId}`, null, adminToken);
      const pipeline = r.data || {};
      const interviewStage = pipeline['interview'] || [];
      const inInterview = interviewStage.some(c =>
        String(c._id) === String(candidateId) || String(c.candidate_id) === String(candidateId)
      );
      log('C13. Candidate in interview stage', inInterview ? 'PASS' : 'FAIL',
        `interview_count=${interviewStage.length}`);
    } catch (e) { log('C13. Pipeline check', 'FAIL', e.message); }
  } else {
    log('C11-C13. Panel builder', 'SKIP',
      `jobId=${jobId}, candidateId=${candidateId}, interviewerUserId=${interviewerUserId}`);
  }

  // =================================================================
  //  D. INTERVIEWER DASHBOARD (as interviewer)
  // =================================================================
  console.log('\n--- D: INTERVIEWER DASHBOARD ---\n');

  if (interviewerToken) {
    // D14: Get my interviews
    try {
      const r = await api('GET', '/api/interviewers/me/interviews', null, interviewerToken);
      const interviews = Array.isArray(r.data) ? r.data : [];
      log('D14. My interviews', r.status === 200 ? 'PASS' : 'FAIL',
        `count=${interviews.length}`);
    } catch (e) { log('D14. My interviews', 'FAIL', e.message); }

    // D15: Get my stats
    try {
      const r = await api('GET', '/api/interviewers/me/stats', null, interviewerToken);
      const hasFields = r.data && typeof r.data.upcoming_count !== 'undefined' &&
                        typeof r.data.pending_feedback !== 'undefined';
      log('D15. My stats', r.status === 200 && hasFields ? 'PASS' : 'FAIL',
        `upcoming=${r.data?.upcoming_count}, pending=${r.data?.pending_feedback}, ` +
        `completed=${r.data?.completed_this_month}, avg=${r.data?.avg_rating_given}`);
    } catch (e) { log('D15. My stats', 'FAIL', e.message); }
  } else {
    log('D14-D15. Interviewer dashboard', 'SKIP', 'no interviewer token');
  }

  // =================================================================
  //  E. STRUCTURED FEEDBACK (as admin — feedback routes require hiring access)
  // =================================================================
  console.log('\n--- E: STRUCTURED FEEDBACK ---\n');

  // E16: Submit feedback for round 1
  if (scheduleId1) {
    try {
      const r = await api('POST', `/api/interview/schedule/${scheduleId1}/feedback`, {
        rating: 4,
        recommendation: 'yes',
        strengths: 'Strong backend skills, excellent system design knowledge',
        concerns: 'Could improve on communication',
        notes: 'Solid technical candidate, recommend for next round',
        criteria_scores: {
          technical_skills: { score: 4, comment: 'Strong Python and FastAPI knowledge demonstrated' },
          communication: { score: 3, comment: 'Clear but could be more concise' },
          problem_solving: { score: 5, comment: 'Excellent algorithmic thinking' },
          culture_fit: { score: 4, comment: 'Good team collaboration mindset' },
          leadership: { score: 3, comment: 'Shows potential for growth' }
        }
      }, adminToken);
      log('E16. Submit feedback round 1', r.status === 200 ? 'PASS' : 'FAIL',
        `status=${r.status}`);
    } catch (e) { log('E16. Feedback round 1', 'FAIL', e.message); }
  } else {
    log('E16. Feedback round 1', 'SKIP', 'no schedule_id_1');
  }

  // E17: Submit feedback for round 2
  if (scheduleId2) {
    try {
      const r = await api('POST', `/api/interview/schedule/${scheduleId2}/feedback`, {
        rating: 3,
        recommendation: 'neutral',
        strengths: 'Adaptable and open to feedback',
        concerns: 'Limited leadership experience',
        notes: 'Good cultural fit but needs mentoring',
        criteria_scores: {
          technical_skills: { score: 3, comment: 'Adequate but not exceptional' },
          communication: { score: 4, comment: 'Articulate and thoughtful' },
          problem_solving: { score: 3, comment: 'Systematic approach' },
          culture_fit: { score: 5, comment: 'Strong values alignment' },
          leadership: { score: 2, comment: 'Needs development' }
        }
      }, adminToken);
      log('E17. Submit feedback round 2', r.status === 200 ? 'PASS' : 'FAIL',
        `status=${r.status}`);
    } catch (e) { log('E17. Feedback round 2', 'FAIL', e.message); }
  } else {
    log('E17. Feedback round 2', 'SKIP', 'no schedule_id_2');
  }

  // E18: Get feedback for round 1
  if (scheduleId1) {
    try {
      const r = await api('GET', `/api/interview/schedule/${scheduleId1}/feedback`, null, adminToken);
      const feedback = Array.isArray(r.data) ? r.data : [r.data].filter(Boolean);
      const hasCriteria = feedback.length > 0 &&
        (feedback[0].criteria_scores || feedback[0].rating);
      log('E18. Get feedback round 1', r.status === 200 && hasCriteria ? 'PASS' : 'FAIL',
        `feedback_count=${feedback.length}, has_criteria=${!!feedback[0]?.criteria_scores}`);
    } catch (e) { log('E18. Get feedback', 'FAIL', e.message); }
  } else {
    log('E18. Get feedback', 'SKIP', 'no schedule_id_1');
  }

  // E19: Aggregate feedback
  if (candidateId && jobId) {
    try {
      const r = await api('GET', `/api/interview/feedback/candidate/${candidateId}/${jobId}`, null, adminToken);
      const hasAggregate = r.data && (
        r.data.rounds || r.data.avg_rating !== undefined ||
        r.data.total_rounds !== undefined || r.data.recommendation_distribution
      );
      log('E19. Aggregate feedback', r.status === 200 && hasAggregate ? 'PASS' : 'FAIL',
        `avg_rating=${r.data?.avg_rating}, total_rounds=${r.data?.total_rounds}, ` +
        `recommendations=${JSON.stringify(r.data?.recommendation_distribution)}`);
    } catch (e) { log('E19. Aggregate feedback', 'FAIL', e.message); }
  } else {
    log('E19. Aggregate feedback', 'SKIP', 'no candidate/job');
  }

  // =================================================================
  //  F. INTERVIEWER UI PAGES (Browser, as admin)
  // =================================================================
  console.log('\n--- F: INTERVIEWER UI PAGES ---\n');

  // Login as admin via browser
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    log('F-SETUP. Admin browser login', token ? 'PASS' : 'FAIL');
  } catch (e) { log('F-SETUP. Browser login', 'FAIL', e.message); }

  // F20: Interviewer Management page
  try {
    await page.goto(`${BASE}/interviewers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await ss(page, 'interviewer-management');
    const body = await page.textContent('body');
    const hasTitle = body.includes('Interviewers') || body.includes('interviewer');
    const hasInviteBtn = body.includes('Invite') || body.includes('invite');
    log('F20. Interviewer Management page', hasTitle ? 'PASS' : 'FAIL',
      `has_title=${hasTitle}, has_invite=${hasInviteBtn}`);
  } catch (e) { log('F20. Interviewer Management', 'FAIL', e.message); }

  // F21: Interviewer Dashboard page (admin can also access this)
  try {
    await page.goto(`${BASE}/interviews`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await ss(page, 'interviewer-dashboard');
    const body = await page.textContent('body');
    const hasKPIs = body.includes('Upcoming') || body.includes('Completed') ||
                    body.includes('Pending') || body.includes('Interview');
    log('F21. Interviewer Dashboard page', hasKPIs ? 'PASS' : 'FAIL',
      `has_kpi_cards=${hasKPIs}`);
  } catch (e) { log('F21. Interviewer Dashboard', 'FAIL', e.message); }

  // F22: Feedback Form page
  if (scheduleId1) {
    try {
      await page.goto(`${BASE}/interviews/${scheduleId1}/feedback`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      await ss(page, 'feedback-form');
      const body = await page.textContent('body');
      const hasFeedbackForm = body.includes('Feedback') || body.includes('feedback') ||
                              body.includes('Rating') || body.includes('rating') ||
                              body.includes('Evaluation') || body.includes('Criteria');
      log('F22. Feedback Form page', hasFeedbackForm ? 'PASS' : 'FAIL',
        `has_form_elements=${hasFeedbackForm}`);
    } catch (e) { log('F22. Feedback Form', 'FAIL', e.message); }
  } else {
    log('F22. Feedback Form', 'SKIP', 'no schedule_id');
  }

  // F23: Candidate Feedback Detail page (aggregate view)
  if (jobId && candidateId) {
    try {
      await page.goto(`${BASE}/jobs/${jobId}/candidates/${candidateId}/feedback`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      await ss(page, 'candidate-feedback-detail');
      const body = await page.textContent('body');
      const hasAggregate = body.includes('Feedback') || body.includes('feedback') ||
                           body.includes('Round') || body.includes('round') ||
                           body.includes('Rating') || body.includes('Comparison');
      log('F23. Candidate Feedback Detail page', hasAggregate ? 'PASS' : 'FAIL',
        `has_aggregate_view=${hasAggregate}`);
    } catch (e) { log('F23. Candidate Feedback Detail', 'FAIL', e.message); }
  } else {
    log('F23. Candidate Feedback Detail', 'SKIP', 'no job/candidate');
  }

  // =================================================================
  //  G. ACCEPT INVITE UI (Browser)
  // =================================================================
  console.log('\n--- G: ACCEPT INVITE UI ---\n');

  // G24: Navigate to invite page (with already-used token — should show form or error)
  if (inviteToken) {
    try {
      await page.goto(`${BASE}/invite/${inviteToken}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await ss(page, 'accept-invite');
      const body = await page.textContent('body');
      // Page should either show password form or already-used error
      const hasContent = body.includes('Password') || body.includes('password') ||
                         body.includes('Set') || body.includes('Invite') ||
                         body.includes('already') || body.includes('expired') ||
                         body.includes('All Set');
      log('G24. Accept Invite page', hasContent ? 'PASS' : 'FAIL',
        `shows_form_or_status=${hasContent}`);
    } catch (e) { log('G24. Accept Invite', 'FAIL', e.message); }
  } else {
    // Test with a fake token to verify page renders
    try {
      await page.goto(`${BASE}/invite/fake-invalid-token`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await ss(page, 'accept-invite-invalid');
      const body = await page.textContent('body');
      const hasContent = body.includes('Password') || body.includes('Invite') ||
                         body.includes('Invalid') || body.includes('Set');
      log('G24. Accept Invite page (invalid token)', hasContent ? 'PASS' : 'FAIL');
    } catch (e) { log('G24. Accept Invite', 'FAIL', e.message); }
  }

  // =================================================================
  //  H. PIPELINE INTEGRATION (Browser, as admin)
  // =================================================================
  console.log('\n--- H: PIPELINE INTEGRATION ---\n');

  // Re-login as admin (may have been redirected by invite page)
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const hasToken = await page.evaluate(() => !!localStorage.getItem('access_token'));
    if (!hasToken) {
      await page.fill('input[type="email"]', ADMIN_EMAIL);
      await page.fill('input[type="password"]', ADMIN_PASS);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    }
  } catch {}

  // H25: Pipeline page with feedback indicators
  if (jobId) {
    try {
      await page.goto(`${BASE}/jobs/${jobId}/pipeline`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      await ss(page, 'pipeline-feedback');
      const body = await page.textContent('body');
      const hasPipeline = body.includes('Interview') || body.includes('interview') ||
                          body.includes('Pipeline') || body.includes('Screening');
      log('H25. Pipeline with feedback indicators', hasPipeline ? 'PASS' : 'FAIL');
    } catch (e) { log('H25. Pipeline integration', 'FAIL', e.message); }
  } else {
    log('H25. Pipeline integration', 'SKIP', 'no job');
  }

  // =================================================================
  //  I. SIDEBAR NAVIGATION (Browser, as interviewer)
  // =================================================================
  console.log('\n--- I: SIDEBAR NAVIGATION ---\n');

  if (interviewerToken) {
    // I26: Login as interviewer via browser
    try {
      // Clear existing session
      await page.evaluate(() => localStorage.clear());
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      await page.fill('input[type="email"]', INTERVIEWER_EMAIL);
      await page.fill('input[type="password"]', INTERVIEWER_PASS);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      const currentUrl = page.url();
      await ss(page, 'interviewer-login');

      // Should redirect to /interviews (not /dashboard)
      const redirectedToInterviews = currentUrl.includes('/interviews');
      log('I26. Interviewer redirect', redirectedToInterviews ? 'PASS' : 'FAIL',
        `url=${currentUrl.replace(BASE, '')}`);

      // Check sidebar content
      const body = await page.textContent('body');
      const hasMyInterviews = body.includes('My Interviews') || body.includes('Interviews');
      const hasDashboard = body.includes('Dashboard');
      const hasJobs = body.includes('Jobs');
      const hasTalentPool = body.includes('Talent Pool');

      log('I27a. Sidebar shows My Interviews', hasMyInterviews ? 'PASS' : 'FAIL');

      // Interviewer should NOT see Dashboard, Jobs, Talent Pool in sidebar
      // Note: "Dashboard" might appear as page content, so check sidebar specifically
      try {
        const sidebar = await page.locator('aside, [class*="sidebar"], nav').first();
        if (await sidebar.isVisible({ timeout: 2000 }).catch(() => false)) {
          const sidebarText = await sidebar.textContent();
          const sidebarHasDashboard = sidebarText.includes('Dashboard');
          const sidebarHasTalentPool = sidebarText.includes('Talent Pool');
          log('I27b. Sidebar hides Dashboard', !sidebarHasDashboard ? 'PASS' : 'FAIL',
            `has_dashboard=${sidebarHasDashboard}`);
          log('I27c. Sidebar hides Talent Pool', !sidebarHasTalentPool ? 'PASS' : 'FAIL',
            `has_talent_pool=${sidebarHasTalentPool}`);
        } else {
          log('I27b. Sidebar check', 'SKIP', 'sidebar not found');
          log('I27c. Sidebar check', 'SKIP', 'sidebar not found');
        }
      } catch (e) {
        log('I27b. Sidebar check', 'FAIL', e.message);
        log('I27c. Sidebar check', 'SKIP', 'skipped due to error');
      }

      await ss(page, 'interviewer-sidebar');
    } catch (e) { log('I26-I27. Sidebar navigation', 'FAIL', e.message); }
  } else {
    log('I26-I27. Sidebar navigation', 'SKIP', 'no interviewer token');
  }

  // =================================================================
  //  SUMMARY
  // =================================================================
  console.log('\n' + '='.repeat(60));
  console.log(`  RESULTS: ${pass} passed, ${fail} failed, ${skip} skipped, ${pass + fail + skip} total`);
  if (pass + fail > 0) {
    console.log(`  Pass rate: ${((pass / (pass + fail)) * 100).toFixed(1)}%`);
  }
  console.log('='.repeat(60));

  if (fail > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  \u274C ${r.test}: ${r.detail}`);
    });
  }

  if (skip > 0) {
    console.log('\nSkipped tests:');
    results.filter(r => r.status === 'SKIP').forEach(r => {
      console.log(`  \u23ED\uFE0F ${r.test}: ${r.detail}`);
    });
  }

  console.log(`\nScreenshots: ${SCREENSHOT_DIR}`);
  console.log('Browser open for 15s for inspection...\n');
  await page.waitForTimeout(15000);

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
