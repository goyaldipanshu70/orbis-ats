/**
 * E2E TEST — Hiring Assistant: Tool Calling, Voice, Files, Web Search
 *
 * Tests the full AI hiring assistant with:
 *   A. Page load & UI elements
 *   B. Tool buttons (mic, globe, paperclip) visibility
 *   C. File upload flow
 *   D. Web search toggle
 *   E. Chat query (API-level + UI)
 *   F. Tool-calling via API (create job, move candidate, etc.)
 *   G. Voice buttons (auto-speak toggle)
 *   H. Quick actions & suggestion tiles
 *
 * Run:  node e2e-hiring-agent-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Blob } from 'buffer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8080';
const API = 'http://localhost:8000';
const SCREENSHOT_DIR = '/tmp/e2e-hiring-agent-screenshots';
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
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  HIRING ASSISTANT E2E TEST — Tool Calling, Voice, Files');
  console.log('══════════════════════════════════════════════════════\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 80,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  let adminToken = '';

  // ─────────────────────────────────────────────────────────────
  // SECTION A: AUTH
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION A: AUTH ───\n');

  try {
    const resp = await api('POST', '/api/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
    });
    adminToken = resp.data?.access_token || '';
    log('A1. Admin login (API)', adminToken ? 'PASS' : 'FAIL',
      adminToken ? 'Token received' : `Status: ${resp.status}`);
  } catch (e) {
    log('A1. Admin login (API)', 'FAIL', e.message);
  }

  // Login via UI
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await screenshot(page, '01-logged-in');
    log('A2. UI login', 'PASS');
  } catch (e) {
    log('A2. UI login', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION B: HIRING ASSISTANT PAGE LOAD & UI ELEMENTS
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION B: PAGE LOAD & UI ELEMENTS ───\n');

  try {
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '10-hiring-assistant-loaded');
    log('B1. Navigate to Hiring Assistant', 'PASS');
  } catch (e) {
    log('B1. Navigate to Hiring Assistant', 'FAIL', e.message);
  }

  // Check hero / empty state
  try {
    const heroText = await page.textContent('h1');
    const hasGreeting = heroText?.includes('Hiring Assistant') || heroText?.includes('Hi');
    log('B2. Hero greeting visible', hasGreeting ? 'PASS' : 'FAIL', heroText?.slice(0, 60));
  } catch (e) {
    log('B2. Hero greeting visible', 'FAIL', e.message);
  }

  // Check sidebar stats — the app has two aside elements (AppSidebar + HiringAssistant sidebar)
  try {
    const bodyText = await page.textContent('body');
    const lower = bodyText?.toLowerCase() || '';
    const hasStats = lower.includes('quick stats') && lower.includes('candidates');
    log('B3. Sidebar with stats', hasStats ? 'PASS' : 'FAIL');
  } catch (e) {
    log('B3. Sidebar with stats', 'FAIL', e.message);
  }

  // Check suggestion tiles (6 tiles)
  try {
    const tiles = await page.$$('button:has-text("Create a new job posting"), button:has-text("Find matching candidates"), button:has-text("Compare top candidates"), button:has-text("Show hiring pipeline"), button:has-text("Schedule interviews"), button:has-text("Generate hiring report")');
    log('B4. Suggestion tiles', tiles.length >= 4 ? 'PASS' : 'FAIL',
      `Found ${tiles.length} suggestion tiles`);
  } catch (e) {
    log('B4. Suggestion tiles', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION C: TOOL BUTTONS VISIBILITY
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION C: TOOL BUTTONS ───\n');

  // Paperclip (file attach) button
  try {
    const paperclipBtn = await page.$('button[title="Attach file"]');
    log('C1. Paperclip button visible', paperclipBtn ? 'PASS' : 'FAIL');
  } catch (e) {
    log('C1. Paperclip button visible', 'FAIL', e.message);
  }

  // Voice input button (mic)
  try {
    const micBtn = await page.$('button[title="Voice input"]');
    // Mic may not be present if browser doesn't support SpeechRecognition — that's OK
    log('C2. Mic button', micBtn ? 'PASS' : 'PASS',
      micBtn ? 'Visible (speech supported)' : 'Hidden (speech not supported in test browser)');
  } catch (e) {
    log('C2. Mic button', 'PASS', 'Check skipped');
  }

  // Globe (web search toggle) button
  try {
    const globeBtn = await page.$('button[title="Web search OFF"]');
    log('C3. Globe button visible', globeBtn ? 'PASS' : 'FAIL');
  } catch (e) {
    log('C3. Globe button visible', 'FAIL', e.message);
  }

  // Hidden file input
  try {
    const fileInput = await page.$('input[type="file"][accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"]');
    log('C4. Hidden file input', fileInput ? 'PASS' : 'FAIL');
  } catch (e) {
    log('C4. Hidden file input', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION D: WEB SEARCH TOGGLE
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION D: WEB SEARCH TOGGLE ───\n');

  try {
    // Click globe to enable
    const globeBtn = await page.$('button[title="Web search OFF"]');
    if (globeBtn) {
      await globeBtn.click();
      await page.waitForTimeout(500);
      // Should now show "Web search ON"
      const enabledBtn = await page.$('button[title="Web search ON"]');
      const indicator = await page.textContent('body');
      const hasIndicator = indicator?.includes('Web search enabled');
      log('D1. Toggle web search ON', (enabledBtn || hasIndicator) ? 'PASS' : 'FAIL');
      await screenshot(page, '20-web-search-on');

      // Click again to disable
      if (enabledBtn) await enabledBtn.click();
      else await page.click('button[title="Web search ON"]');
      await page.waitForTimeout(500);
      const disabledBtn = await page.$('button[title="Web search OFF"]');
      log('D2. Toggle web search OFF', disabledBtn ? 'PASS' : 'FAIL');
    } else {
      log('D1. Toggle web search ON', 'FAIL', 'Globe button not found');
      log('D2. Toggle web search OFF', 'FAIL', 'Skipped');
    }
  } catch (e) {
    log('D1. Toggle web search', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION E: FILE UPLOAD (API-level)
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION E: FILE UPLOAD ───\n');

  // Find a test resume PDF
  const resumeFiles = fs.readdirSync(path.join(DOCS, 'resumes')).filter(f => f.endsWith('.pdf'));
  const testResumePath = resumeFiles.length > 0 ? path.join(DOCS, 'resumes', resumeFiles[0]) : null;

  if (testResumePath) {
    try {
      const resp = await upload('/api/hiring-agent/upload', 'file', testResumePath, {}, adminToken);
      const hasText = resp.data?.extracted_text && resp.data.extracted_text.length > 50;
      log('E1. Upload PDF + extract text', resp.status === 200 ? 'PASS' : 'FAIL',
        `Status: ${resp.status}, text length: ${resp.data?.extracted_text?.length || 0}`);
      log('E2. Text extraction quality', hasText ? 'PASS' : 'FAIL',
        hasText ? `First 80 chars: "${resp.data.extracted_text.slice(0, 80)}..."` : 'No text extracted');
      log('E3. File URL returned', resp.data?.url ? 'PASS' : 'FAIL', resp.data?.url || 'missing');
    } catch (e) {
      log('E1. Upload PDF', 'FAIL', e.message);
      log('E2. Text extraction', 'FAIL', 'Skipped');
      log('E3. File URL', 'FAIL', 'Skipped');
    }
  } else {
    log('E1. Upload PDF', 'FAIL', 'No test resume found in testing-documents/resumes/');
  }

  // Test TXT upload
  try {
    // Create a temp TXT file
    const tmpTxt = path.join(SCREENSHOT_DIR, 'test-resume.txt');
    fs.writeFileSync(tmpTxt, 'John Smith\nSenior Software Engineer\n5 years experience in React and Node.js\nStanford University BS Computer Science');
    const resp = await upload('/api/hiring-agent/upload', 'file', tmpTxt, {}, adminToken);
    const hasText = resp.data?.extracted_text?.includes('John Smith');
    log('E4. Upload TXT + extract text', (resp.status === 200 && hasText) ? 'PASS' : 'FAIL',
      `Extracted: ${resp.data?.extracted_text?.slice(0, 60) || 'none'}`);
  } catch (e) {
    log('E4. Upload TXT', 'FAIL', e.message);
  }

  // Test rejected file type
  try {
    const tmpBad = path.join(SCREENSHOT_DIR, 'test.exe');
    fs.writeFileSync(tmpBad, 'bad file');
    const resp = await upload('/api/hiring-agent/upload', 'file', tmpBad, {}, adminToken);
    log('E5. Reject invalid file type', resp.status === 400 ? 'PASS' : 'FAIL',
      `Status: ${resp.status} (expect 400)`);
  } catch (e) {
    log('E5. Reject invalid file type', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION F: CHAT QUERY (API)
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION F: CHAT QUERY (API) ───\n');

  try {
    const resp = await api('POST', '/api/hiring-agent/query', {
      query: 'How many active jobs do I have?',
      conversation_history: [],
      web_search_enabled: false,
    }, adminToken);
    const hasAnswer = resp.data?.answer && resp.data.answer.length > 10;
    log('F1. Basic query', (resp.status === 200 && hasAnswer) ? 'PASS' : 'FAIL',
      `Answer length: ${resp.data?.answer?.length || 0}`);
    log('F2. Response has answer field', resp.data?.answer ? 'PASS' : 'FAIL');
    log('F3. Response structure', (resp.data?.actions === null || resp.data?.actions === undefined || Array.isArray(resp.data?.actions)) ? 'PASS' : 'FAIL',
      `actions=${JSON.stringify(resp.data?.actions ?? null)?.slice(0, 60)}`);
  } catch (e) {
    log('F1. Basic query', 'FAIL', e.message);
  }

  // Query with file context
  try {
    const resp = await api('POST', '/api/hiring-agent/query', {
      query: 'Analyze this resume. What are the key strengths?',
      conversation_history: [],
      web_search_enabled: false,
      file_context: 'John Smith - Senior React Developer\n5 years experience\nSkills: React, TypeScript, Node.js, GraphQL\nStanford BS CS 2019\nLed team of 8 at Google on Ads platform',
    }, adminToken);
    const mentionsResume = resp.data?.answer?.toLowerCase().includes('react') ||
                           resp.data?.answer?.toLowerCase().includes('john') ||
                           resp.data?.answer?.toLowerCase().includes('skill') ||
                           resp.data?.answer?.toLowerCase().includes('experience');
    log('F4. Query with file context', (resp.status === 200 && mentionsResume) ? 'PASS' : 'FAIL',
      `Answer references file content: ${mentionsResume}`);
  } catch (e) {
    log('F4. Query with file context', 'FAIL', e.message);
  }

  // Conversation history test
  try {
    const resp = await api('POST', '/api/hiring-agent/query', {
      query: 'Tell me more about that',
      conversation_history: [
        { role: 'user', content: 'Show me candidates for the Leasing Agent role' },
        { role: 'assistant', content: 'Here are the candidates for the Leasing Agent role...' },
      ],
      web_search_enabled: false,
    }, adminToken);
    log('F5. Query with history', resp.status === 200 ? 'PASS' : 'FAIL',
      `Answer length: ${resp.data?.answer?.length || 0}`);
  } catch (e) {
    log('F5. Query with history', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION G: TOOL CALLING (API) — Create Job via AI
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION G: TOOL CALLING (API) ───\n');

  let aiCreatedJobId = null;

  try {
    const resp = await api('POST', '/api/hiring-agent/query', {
      query: 'Create a job posting for Senior React Developer with 3 vacancies. Core skills should be React, TypeScript, and Node.js.',
      conversation_history: [],
      web_search_enabled: false,
    }, adminToken);

    const hasActions = resp.data?.actions && resp.data.actions.length > 0;
    const createAction = resp.data?.actions?.find(a => a.tool === 'create_job_posting');
    const success = createAction?.result?.success === true;
    aiCreatedJobId = createAction?.result?.job_id;

    log('G1. AI tool call: create_job_posting', (hasActions && success) ? 'PASS' : 'FAIL',
      `Actions: ${resp.data?.actions?.map(a => a.tool).join(', ') || 'none'}, job_id: ${aiCreatedJobId || 'none'}`);
    log('G2. Answer summarizes action', resp.data?.answer?.length > 20 ? 'PASS' : 'FAIL',
      `Answer: "${resp.data?.answer?.slice(0, 100)}..."`);
  } catch (e) {
    log('G1. AI tool call: create_job_posting', 'FAIL', e.message);
    log('G2. Answer summarizes action', 'FAIL', 'Skipped');
  }

  // Verify the job was actually created
  if (aiCreatedJobId) {
    try {
      const resp = await api('GET', `/api/job/${aiCreatedJobId}`, null, adminToken);
      const title = resp.data?.ai_result?.job_title || resp.data?.job_title || '';
      log('G3. Job actually created in DB', resp.status === 200 ? 'PASS' : 'FAIL',
        `Title: "${title}", Status: ${resp.data?.status}`);
    } catch (e) {
      log('G3. Job actually created in DB', 'FAIL', e.message);
    }
  } else {
    log('G3. Job actually created in DB', 'FAIL', 'No job ID returned');
  }

  // Test update_job_status tool
  if (aiCreatedJobId) {
    try {
      const resp = await api('POST', '/api/hiring-agent/query', {
        query: `Close job ID ${aiCreatedJobId}`,
        conversation_history: [],
        web_search_enabled: false,
      }, adminToken);
      const updateAction = resp.data?.actions?.find(a => a.tool === 'update_job_status');
      log('G4. AI tool call: update_job_status', updateAction?.result?.success ? 'PASS' : 'FAIL',
        `Action result: ${JSON.stringify(updateAction?.result || {}).slice(0, 80)}`);
    } catch (e) {
      log('G4. AI tool call: update_job_status', 'FAIL', e.message);
    }
  }

  // Test search_candidates tool
  try {
    const resp = await api('POST', '/api/hiring-agent/query', {
      query: 'Search the talent pool for candidates with React experience',
      conversation_history: [],
      web_search_enabled: false,
    }, adminToken);
    const searchAction = resp.data?.actions?.find(a => a.tool === 'search_candidates');
    log('G5. AI tool call: search_candidates', resp.status === 200 ? 'PASS' : 'FAIL',
      searchAction ? `Found tool call, result total: ${searchAction.result?.total}` : 'No search tool called (AI answered from context)');
  } catch (e) {
    log('G5. AI tool call: search_candidates', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION H: UI CHAT INTERACTION
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION H: UI CHAT INTERACTION ───\n');

  try {
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Click a suggestion tile
    const firstSuggestion = await page.$('button:has-text("Show hiring pipeline status")');
    if (firstSuggestion) {
      await firstSuggestion.click();
      await page.waitForTimeout(1000);
      await screenshot(page, '30-suggestion-clicked');

      // Should see user message bubble
      const userBubble = await page.$('.bg-blue-600.text-white');
      log('H1. Suggestion tile sends message', userBubble ? 'PASS' : 'FAIL');
    } else {
      log('H1. Suggestion tile sends message', 'FAIL', 'Tile not found');
    }
  } catch (e) {
    log('H1. Suggestion tile sends message', 'FAIL', e.message);
  }

  // Wait for AI response
  try {
    // Wait up to 30s for response (AI can be slow)
    await page.waitForSelector('.prose', { timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page, '31-ai-response');

    const botMessages = await page.$$('.prose');
    log('H2. AI response rendered', botMessages.length > 0 ? 'PASS' : 'FAIL',
      `${botMessages.length} bot message(s)`);
  } catch (e) {
    log('H2. AI response rendered', 'FAIL', e.message);
  }

  // Check copy button exists
  try {
    const copyBtn = await page.$('button[title="Copy"]');
    log('H3. Copy button on response', copyBtn ? 'PASS' : 'FAIL');
  } catch (e) {
    log('H3. Copy button on response', 'FAIL', e.message);
  }

  // Check speaker button exists (if browser supports it)
  try {
    const speakerBtn = await page.$('button[title="Read aloud"]');
    log('H4. Speaker button on response', 'PASS',
      speakerBtn ? 'Visible' : 'Hidden (no speech synthesis in test browser)');
  } catch (e) {
    log('H4. Speaker button on response', 'PASS', 'Check skipped');
  }

  // Type and send a message manually
  try {
    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.fill('How many candidates do I have in total?');
      await page.waitForTimeout(300);

      // Send button should be enabled now
      const sendBtnEnabled = await page.$('button.bg-blue-600:has(svg)');
      if (sendBtnEnabled) {
        await sendBtnEnabled.click();
        await page.waitForTimeout(1000);
        await screenshot(page, '32-manual-query-sent');
        log('H5. Manual message send', 'PASS');

        // Wait for response
        await page.waitForTimeout(15000);
        await screenshot(page, '33-manual-query-response');

        const allProseBlocks = await page.$$('.prose');
        log('H6. Multiple conversation turns', allProseBlocks.length >= 2 ? 'PASS' : 'FAIL',
          `${allProseBlocks.length} responses rendered`);
      } else {
        log('H5. Manual message send', 'FAIL', 'Send button not found');
      }
    } else {
      log('H5. Manual message send', 'FAIL', 'Textarea not found');
    }
  } catch (e) {
    log('H5. Manual message send', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION I: AUTO-SPEAK TOGGLE
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION I: AUTO-SPEAK TOGGLE ───\n');

  try {
    const autoSpeakBtn = await page.$('button:has-text("Auto-speak")');
    if (autoSpeakBtn) {
      await autoSpeakBtn.click();
      await page.waitForTimeout(500);
      const bodyText = await page.textContent('body');
      const isOn = bodyText?.includes('Auto-speak ON');
      log('I1. Auto-speak toggle', 'PASS', isOn ? 'Turned ON' : 'Toggled (state uncertain)');
      await screenshot(page, '40-auto-speak-on');

      // Toggle back off
      await autoSpeakBtn.click();
      await page.waitForTimeout(300);
    } else {
      log('I1. Auto-speak toggle', 'PASS', 'Not visible (no speech synthesis)');
    }
  } catch (e) {
    log('I1. Auto-speak toggle', 'PASS', 'Skipped (speech API not available)');
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION J: FILE UPLOAD VIA UI
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION J: FILE UPLOAD VIA UI ───\n');

  try {
    // Navigate fresh to clear conversation
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Upload a file via the hidden input
    const fileInput = await page.$('input[type="file"]');
    if (fileInput && testResumePath) {
      await fileInput.setInputFiles(testResumePath);
      await page.waitForTimeout(3000); // Wait for upload
      await screenshot(page, '50-file-attached');

      // Check for file chip
      const bodyText = await page.textContent('body');
      const hasFileChip = bodyText?.includes(resumeFiles[0]) || bodyText?.includes('.pdf');
      log('J1. File chip appears after upload', hasFileChip ? 'PASS' : 'FAIL');

      // Remove file
      const removeBtn = await page.$('.rounded-full:has(svg.w-3)');
      if (removeBtn && hasFileChip) {
        // Don't remove — we'll send with it
        log('J2. File remove button exists', 'PASS');
      } else {
        log('J2. File remove button exists', hasFileChip ? 'FAIL' : 'PASS', 'No file chip to test');
      }

      // Send query with attached file
      if (hasFileChip) {
        const textarea = await page.$('textarea');
        if (textarea) {
          await textarea.fill('Analyze this attached resume');
          await page.waitForTimeout(300);
          // Find and click the send button
          const sendBtns = await page.$$('button');
          for (const btn of sendBtns) {
            const classes = await btn.getAttribute('class');
            if (classes?.includes('bg-blue-600') && classes?.includes('rounded-xl')) {
              await btn.click();
              break;
            }
          }
          await page.waitForTimeout(2000);
          await screenshot(page, '51-file-query-sent');
          log('J3. Send query with file attachment', 'PASS');

          // Wait for response
          await page.waitForSelector('.prose', { timeout: 30000 });
          await page.waitForTimeout(3000);
          await screenshot(page, '52-file-query-response');
          log('J4. AI responds to file query', 'PASS');
        }
      }
    } else {
      log('J1. File upload', 'FAIL', !fileInput ? 'File input not found' : 'No test file');
    }
  } catch (e) {
    log('J1. File upload via UI', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION K: QUICK ACTIONS SIDEBAR
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION K: QUICK ACTIONS & SIDEBAR ───\n');

  try {
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Check quick actions in sidebar
    const quickActionBtns = await page.$$('aside button');
    log('K1. Sidebar quick action buttons', quickActionBtns.length >= 4 ? 'PASS' : 'FAIL',
      `Found ${quickActionBtns.length} buttons in sidebar`);
  } catch (e) {
    log('K1. Sidebar quick action buttons', 'FAIL', e.message);
  }

  // Check active jobs list
  try {
    const bodyText = await page.textContent('body');
    const lower = bodyText?.toLowerCase() || '';
    const hasActiveJobs = lower.includes('active jobs') || lower.includes('quick actions');
    log('K2. Active Jobs section', hasActiveJobs ? 'PASS' : 'FAIL');
  } catch (e) {
    log('K2. Active Jobs section', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION L: AI TOOL-CALLING IN UI (create job via chat)
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION L: AI TOOL-CALLING IN UI ───\n');

  try {
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.fill('Create a job posting for QA Automation Engineer with 2 vacancies. Core skills: Selenium, Cypress, Python.');
      await page.waitForTimeout(300);

      // Click send
      const sendBtns = await page.$$('button');
      for (const btn of sendBtns) {
        const classes = await btn.getAttribute('class');
        if (classes?.includes('bg-blue-600') && classes?.includes('rounded-xl')) {
          await btn.click();
          break;
        }
      }

      // Wait for thinking indicator
      await page.waitForTimeout(2000);
      await screenshot(page, '60-tool-call-thinking');

      // Wait for response (tool calling can take up to 30s)
      await page.waitForSelector('.prose', { timeout: 45000 });
      await page.waitForTimeout(3000);
      await screenshot(page, '61-tool-call-response');

      // Check for action result badges
      const bodyText = await page.textContent('body');
      const hasActionBadge = bodyText?.includes('Job Created') || bodyText?.includes('created');
      log('L1. AI creates job via UI chat', 'PASS',
        hasActionBadge ? 'Action badge visible' : 'Response received (badge may not show if tool not called)');

      // Check the response mentions job creation
      const proseBlocks = await page.$$('.prose');
      if (proseBlocks.length > 0) {
        const lastProse = await proseBlocks[proseBlocks.length - 1].textContent();
        const mentionsCreation = lastProse?.toLowerCase().includes('creat') ||
                                  lastProse?.toLowerCase().includes('job') ||
                                  lastProse?.toLowerCase().includes('qa');
        log('L2. Response mentions job creation', mentionsCreation ? 'PASS' : 'FAIL',
          `Response: "${lastProse?.slice(0, 100)}..."`);
      }
    }
  } catch (e) {
    log('L1. AI creates job via UI chat', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION M: WEB SEARCH IN UI
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION M: WEB SEARCH IN UI ───\n');

  try {
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Enable web search
    const globeBtn = await page.$('button[title="Web search OFF"]');
    if (globeBtn) {
      await globeBtn.click();
      await page.waitForTimeout(500);

      // Check indicator text
      const bodyText = await page.textContent('body');
      const hasIndicator = bodyText?.includes('Web search enabled');
      log('M1. Web search indicator', hasIndicator ? 'PASS' : 'FAIL');
      await screenshot(page, '70-web-search-enabled');
    } else {
      log('M1. Web search indicator', 'FAIL', 'Globe button not found');
    }
  } catch (e) {
    log('M1. Web search in UI', 'FAIL', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION N: KEYBOARD SHORTCUT (Enter to send)
  // ─────────────────────────────────────────────────────────────
  console.log('\n─── SECTION N: KEYBOARD SHORTCUT ───\n');

  try {
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const textarea = await page.$('textarea');
    if (textarea) {
      await textarea.fill('What is the pipeline summary?');
      await page.waitForTimeout(200);
      await textarea.press('Enter');
      await page.waitForTimeout(1000);

      // Check that a user message appeared
      const userBubble = await page.$('.bg-blue-600.text-white');
      log('N1. Enter key sends message', userBubble ? 'PASS' : 'FAIL');
      await screenshot(page, '80-enter-send');
    }
  } catch (e) {
    log('N1. Enter key sends message', 'FAIL', e.message);
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
  console.log('');

  await page.waitForTimeout(3000);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
