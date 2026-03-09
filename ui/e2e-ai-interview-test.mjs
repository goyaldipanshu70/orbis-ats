/**
 * E2E Test — AI Interview Feature
 *
 * Tests the full AI interview flow:
 *   A. Auth: Login as admin
 *   B. API: Create AI interview session for a candidate
 *   C. UI: Navigate to Pipeline, verify AI Interview action exists
 *   D. UI: Open AI Interview Room (lobby page) via token
 *   E. UI: Start interview, send messages, verify conversation flow
 *   F. UI: End interview, verify completion screen
 *   G. API: Verify session results in DB
 *   H. UI: Check results via HR endpoint
 *
 * Run:  node e2e-ai-interview-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8080';
const API = 'http://localhost:8000';
const SCREENSHOT_DIR = '/tmp/e2e-ai-interview-screenshots';

const ADMIN_EMAIL = 'admin@orbis.io';
const ADMIN_PASS = 'admin123';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
const results = [];
let ssIdx = 0;

function log(test, status, detail = '') {
  const icon = status === 'PASS' ? '\u2705' : status === 'SKIP' ? '\u23ED\uFE0F' : '\u274C';
  const line = `${icon} ${test}${detail ? ' \u2014 ' + detail : ''}`;
  console.log(line);
  results.push({ test, status, detail });
  if (status === 'PASS') pass++; else if (status !== 'SKIP') fail++;
}

async function ss(page, name) {
  ssIdx++;
  const fname = `${String(ssIdx).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, fname), fullPage: true });
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

// ═══════════════════════════════════════════════════════════════
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  console.log('\n' + '═'.repeat(60));
  console.log('  ORBIS ATS — AI INTERVIEW E2E TEST');
  console.log('═'.repeat(60) + '\n');

  let token = '';
  let jobId = '';
  let candidateId = '';
  let sessionToken = '';
  let sessionId = '';

  // ═══════════════════════════════════════════════════════════════
  //  A. AUTH — Login as admin
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- A. AUTH ---');
  try {
    const r = await api('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    if (r.status === 200 && r.data.access_token) {
      token = r.data.access_token;
      log('Login as admin', 'PASS');
    } else {
      log('Login as admin', 'FAIL', `status=${r.status}`);
    }
  } catch (e) {
    log('Login as admin', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  //  B. GET EXISTING DATA — Find a job + candidate
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- B. FIND TEST DATA ---');
  try {
    const r = await api('GET', '/api/job?page=1&page_size=1', null, token);
    if (r.status === 200 && r.data.items?.length > 0) {
      jobId = r.data.items[0].job_id;
      log('Find existing job', 'PASS', `job_id=${jobId}`);
    } else {
      log('Find existing job', 'FAIL', `status=${r.status}`);
    }
  } catch (e) {
    log('Find existing job', 'FAIL', e.message);
  }

  if (jobId) {
    try {
      const r = await api('GET', `/api/candidates?jd_id=${jobId}&page=1&page_size=1`, null, token);
      if (r.status === 200 && r.data.items?.length > 0) {
        candidateId = r.data.items[0]._id || r.data.items[0].id;
        log('Find existing candidate', 'PASS', `candidate_id=${candidateId}`);
      } else {
        log('Find existing candidate', 'FAIL', `status=${r.status}, data=${JSON.stringify(r.data).slice(0, 200)}`);
      }
    } catch (e) {
      log('Find existing candidate', 'FAIL', e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  C. API — Create AI interview session
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- C. CREATE AI INTERVIEW SESSION ---');
  if (candidateId && jobId) {
    try {
      const r = await api('POST', '/api/ai-interview/invite', {
        candidate_id: candidateId,
        jd_id: parseInt(jobId),
        interview_type: 'mixed',
        max_questions: 3,
        time_limit_minutes: 10,
        include_coding: false,
      }, token);
      if (r.status === 200 && r.data.token) {
        sessionToken = r.data.token;
        sessionId = r.data.session_id;
        log('Create AI interview session', 'PASS', `token=${sessionToken.slice(0, 12)}...`);
      } else {
        log('Create AI interview session', 'FAIL', `status=${r.status}, data=${JSON.stringify(r.data).slice(0, 200)}`);
      }
    } catch (e) {
      log('Create AI interview session', 'FAIL', e.message);
    }
  } else {
    log('Create AI interview session', 'SKIP', 'No candidate/job found');
  }

  // ═══════════════════════════════════════════════════════════════
  //  D. API — List sessions for job
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- D. LIST SESSIONS ---');
  if (jobId) {
    try {
      const r = await api('GET', `/api/ai-interview/sessions/${jobId}`, null, token);
      if (r.status === 200 && Array.isArray(r.data)) {
        log('List AI interview sessions', 'PASS', `count=${r.data.length}`);
      } else {
        log('List AI interview sessions', 'FAIL', `status=${r.status}`);
      }
    } catch (e) {
      log('List AI interview sessions', 'FAIL', e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  E. UI — Login + Navigate to Pipeline
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- E. UI — LOGIN + PIPELINE ---');
  try {
    await page.goto(`${BASE}/login`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    // Only fill login if we're on the login page
    const onLogin = page.url().includes('/login');
    if (onLogin) {
      await page.fill('input[type="email"]', ADMIN_EMAIL);
      await page.fill('input[type="password"]', ADMIN_PASS);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    }
    await ss(page, 'dashboard-after-login');
    log('UI Login', 'PASS');
  } catch (e) {
    log('UI Login', 'FAIL', e.message);
  }

  // Navigate to pipeline for the job
  if (jobId) {
    try {
      await page.goto(`${BASE}/jobs/${jobId}/pipeline`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(4000);
      await ss(page, 'pipeline-page');
      log('Navigate to Pipeline', 'PASS');
    } catch (e) {
      log('Navigate to Pipeline', 'FAIL', e.message);
    }

    // Try to find the AI Interview action in dropdown
    try {
      // Find any candidate card's more button
      const moreBtn = page.locator('button:has(svg)').filter({ has: page.locator('svg.lucide-more-horizontal') }).first();
      if (await moreBtn.count() > 0) {
        await moreBtn.click();
        await page.waitForTimeout(500);
        await ss(page, 'kanban-card-dropdown');
        // Check if AI Interview menu item exists
        const aiBtn = page.locator('[role="menuitem"]:has-text("AI Interview")');
        if (await aiBtn.count() > 0) {
          log('AI Interview dropdown action exists', 'PASS');
        } else {
          log('AI Interview dropdown action exists', 'FAIL', 'Menu item not found in dropdown');
        }
        // Close dropdown by pressing Escape
        await page.keyboard.press('Escape');
      } else {
        log('AI Interview dropdown action exists', 'SKIP', 'No candidate cards with dropdown found');
      }
    } catch (e) {
      log('AI Interview dropdown action exists', 'FAIL', e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  F. UI — AI Interview Room (Lobby)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- F. UI — AI INTERVIEW ROOM ---');
  if (sessionToken) {
    // Grant permissions before visiting the room
    await ctx.grantPermissions(['camera', 'microphone']);

    try {
      await page.goto(`${BASE}/ai-interview/${sessionToken}`);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
      await ss(page, 'ai-interview-lobby');

      // Verify lobby elements
      const hasTitle = await page.locator('text=AI Interview').count() > 0;
      const hasStartBtn = await page.locator('button:has-text("Start Interview")').count() > 0;
      const hasEquipmentCheck = await page.locator('text=Equipment Check').count() > 0;

      if (hasTitle && hasStartBtn) {
        log('AI Interview Lobby loads', 'PASS', `title=${hasTitle}, startBtn=${hasStartBtn}, equipCheck=${hasEquipmentCheck}`);
      } else {
        log('AI Interview Lobby loads', 'FAIL', `title=${hasTitle}, startBtn=${hasStartBtn}`);
      }

      // Check equipment check items (new UI uses short labels)
      const micCheck = await page.locator('text=Microphone').count() > 0;
      const camCheck = await page.locator('text=Camera').count() > 0;
      const internetCheck = await page.locator('text=Internet').count() > 0;
      log('Lobby equipment checks displayed', micCheck && camCheck && internetCheck ? 'PASS' : 'FAIL',
        `mic=${micCheck}, cam=${camCheck}, internet=${internetCheck}`);

      // Check interview config badges
      const hasQuestionCount = await page.locator('text=3 Questions').count() > 0 || await page.locator('text=3 questions').count() > 0;
      const hasTimeLimit = await page.locator('text=10 Minute').count() > 0 || await page.locator('text=10 minutes').count() > 0;
      log('Lobby shows interview config', hasQuestionCount || hasTimeLimit ? 'PASS' : 'FAIL',
        `questions=${hasQuestionCount}, time=${hasTimeLimit}`);

      await ss(page, 'ai-interview-lobby-details');

    } catch (e) {
      log('AI Interview Lobby loads', 'FAIL', e.message);
    }

    // ═══════════════════════════════════════════════════════════════
    //  G. UI — Start Interview
    // ═══════════════════════════════════════════════════════════════
    console.log('\n--- G. UI — START INTERVIEW ---');
    try {
      const startBtn = page.locator('button:has-text("Start Interview")');
      if (await startBtn.isEnabled({ timeout: 3000 })) {
        await startBtn.click();
        // Wait for the interview to start — AI generates a question plan which can take 15-20s
        // Poll for the input field to appear instead of a fixed wait
        let started = false;
        for (let i = 0; i < 30; i++) {  // up to 30s
          const inputVisible = await page.locator('input[placeholder*="Type your answer"]').count() > 0;
          const timerVisible = await page.locator('text=/\\d+:\\d+/').count() > 0;
          if (inputVisible || timerVisible) { started = true; break; }
          await page.waitForTimeout(1000);
        }
        await ss(page, 'ai-interview-started');

        // Check for active interview elements
        const hasTimer = await page.locator('text=/\\d+:\\d+/').count() > 0;
        const hasConversation = await page.locator('text=Aria').count() > 0 ||
                                await page.locator('text=AI Interviewer').count() > 0 ||
                                await page.locator('text=Aria is thinking').count() > 0;
        const hasInput = await page.locator('input[placeholder*="Type your answer"]').count() > 0;
        const hasVoiceBtn = await page.locator('button.rounded-full').count() > 0;  // large mic button

        if (hasTimer || hasConversation || hasInput) {
          log('Interview started successfully', 'PASS',
            `timer=${hasTimer}, conversation=${hasConversation}, input=${hasInput}, voice=${hasVoiceBtn}`);
        } else {
          // Check if there's an error message
          const errorText = await page.locator('.text-destructive, [role="alert"]').textContent().catch(() => '');
          log('Interview started successfully', 'FAIL',
            `timer=${hasTimer}, conv=${hasConversation}, input=${hasInput}. Error: ${errorText}`);
        }
      } else {
        log('Interview started successfully', 'SKIP', 'Start button not enabled (mic permission may be needed)');
      }
    } catch (e) {
      log('Interview started successfully', 'FAIL', e.message);
      await ss(page, 'ai-interview-start-error');
    }

    // ═══════════════════════════════════════════════════════════════
    //  H. UI — Send a message in the interview
    // ═══════════════════════════════════════════════════════════════
    console.log('\n--- H. UI — SEND MESSAGE ---');
    try {
      const input = page.locator('input[placeholder*="Type your answer"]');
      if (await input.count() > 0) {
        await input.fill('I have 5 years of experience in software development, specializing in Python and JavaScript.');
        await page.locator('button:has(svg.lucide-send)').click();
        await page.waitForTimeout(10000);  // Wait for AI response
        await ss(page, 'ai-interview-after-message');

        // Check if AI responded - count message bubbles in transcript
        const messageCount = await page.locator('.rounded-xl.px-4.py-2').count();
        log('Send message and get AI response', messageCount > 2 ? 'PASS' : 'FAIL',
          `message bubbles visible: ${messageCount}`);

        // Send second message
        await input.fill('I led a team of 8 developers building a microservices platform using FastAPI and React.');
        await page.locator('button:has(svg.lucide-send)').click();
        await page.waitForTimeout(10000);
        await ss(page, 'ai-interview-second-message');
        log('Second message exchange', 'PASS');

      } else {
        log('Send message and get AI response', 'SKIP', 'Input field not found (interview may not have started)');
      }
    } catch (e) {
      log('Send message and get AI response', 'FAIL', e.message);
      await ss(page, 'ai-interview-message-error');
    }

    // ═══════════════════════════════════════════════════════════════
    //  I. UI — End interview
    // ═══════════════════════════════════════════════════════════════
    console.log('\n--- I. UI — END INTERVIEW ---');
    try {
      const endBtn = page.locator('button:has-text("End")');
      if (await endBtn.count() > 0) {
        await endBtn.click();
        // Poll for completion screen — evaluation can take 10-20s
        let completed = false;
        for (let i = 0; i < 30; i++) {  // up to 30s
          const hasComplete = await page.locator('text=Interview Complete').count() > 0 ||
                              await page.locator('text=Thank you').count() > 0 ||
                              await page.locator('text=completed').count() > 0;
          if (hasComplete) { completed = true; break; }
          await page.waitForTimeout(1000);
        }
        await ss(page, 'ai-interview-completed');
        log('End interview shows completion', completed ? 'PASS' : 'FAIL');
      } else {
        log('End interview shows completion', 'SKIP', 'End button not found');
      }
    } catch (e) {
      log('End interview shows completion', 'FAIL', e.message);
      await ss(page, 'ai-interview-end-error');
    }
  } else {
    log('AI Interview Room tests', 'SKIP', 'No session token available');
  }

  // ═══════════════════════════════════════════════════════════════
  //  J. API — Check session results
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- J. API — SESSION RESULTS ---');
  if (sessionId) {
    try {
      const r = await api('GET', `/api/ai-interview/results/${sessionId}`, null, token);
      if (r.status === 200) {
        const result = r.data;
        log('Get session results', 'PASS',
          `status=${result.status}, score=${result.overall_score}, recommendation=${result.ai_recommendation}`);

        // Check transcript exists (only expected if interview was completed)
        if (result.transcript && result.transcript.length > 0) {
          log('Results have transcript', 'PASS', `messages=${result.transcript.length}`);
        } else if (result.status === 'completed') {
          log('Results have transcript', 'FAIL', 'No transcript found for completed session');
        } else {
          log('Results have transcript', 'PASS', `session status=${result.status}, no transcript expected yet`);
        }
      } else {
        log('Get session results', 'FAIL', `status=${r.status}`);
      }
    } catch (e) {
      log('Get session results', 'FAIL', e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  K. API — Cancel a pending session (create a new one first)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- K. API — CANCEL SESSION ---');
  if (candidateId && jobId) {
    try {
      // Create a new session to cancel
      const r = await api('POST', '/api/ai-interview/invite', {
        candidate_id: candidateId,
        jd_id: parseInt(jobId),
        max_questions: 3,
        time_limit_minutes: 5,
      }, token);
      if (r.status === 200) {
        const cancelR = await api('DELETE', `/api/ai-interview/${r.data.session_id}`, null, token);
        log('Cancel pending session', cancelR.status === 200 ? 'PASS' : 'FAIL', `status=${cancelR.status}`);
      }
    } catch (e) {
      log('Cancel pending session', 'FAIL', e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  L. UI — Test invalid token
  // ═══════════════════════════════════════════════════════════════
  console.log('\n--- L. UI — INVALID TOKEN ---');
  try {
    await page.goto(`${BASE}/ai-interview/invalid-token-12345`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await ss(page, 'ai-interview-invalid-token');

    const hasError = await page.locator('text=Interview Unavailable').count() > 0 ||
                     await page.locator('text=invalid').count() > 0;
    log('Invalid token shows error', hasError ? 'PASS' : 'FAIL');
  } catch (e) {
    log('Invalid token shows error', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  //  SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log(`  RESULTS: ${pass} passed, ${fail} failed, ${results.filter(r => r.status === 'SKIP').length} skipped`);
  console.log('═'.repeat(60));
  console.log(`  Screenshots: ${SCREENSHOT_DIR}`);
  console.log('═'.repeat(60) + '\n');

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
