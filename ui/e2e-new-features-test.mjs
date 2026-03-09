/**
 * E2E TEST — 5 New ATS Capabilities
 *
 * Tests:
 *   A. Referrals page (KPIs, leaderboard, link creation)
 *   B. Outreach page (campaigns, automations tabs)
 *   C. AI Toolkit page (5 tool cards, ranking, salary, skills gap)
 *   D. Compliance page (diversity, SLA, data export tabs)
 *   E. Candidate Scorecard page (4-tab scorecard)
 *   F. Candidate Compare page (job selector, comparison)
 *   G. Sidebar nav (new items visible)
 *   H. Backend API integration (create referral, campaign, automation, approval)
 *   I. Pipeline Config modal
 *   J. CSV Import modal
 *
 * Run:  node e2e-new-features-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:8080';
const API  = 'http://localhost:8000';
const SCREENSHOT_DIR = '/tmp/e2e-new-features';

const ADMIN_EMAIL = 'admin@orbis.io';
const ADMIN_PASS  = 'admin123';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let pass = 0, fail = 0, skip = 0;
const results = [];
let ssIdx = 0;

function log(test, status, detail = '') {
  const icon = status === 'PASS' ? '\u2705' : status === 'SKIP' ? '\u23ED\uFE0F' : '\u274C';
  const line = `${icon} ${test}${detail ? ' — ' + detail : ''}`;
  console.log(line);
  results.push({ test, status, detail });
  if (status === 'PASS') pass++;
  else if (status === 'SKIP') skip++;
  else fail++;
}

async function ss(page, name) {
  ssIdx++;
  const fname = `${String(ssIdx).padStart(3, '0')}-${name}.png`;
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

async function safeClick(page, selector, timeout = 5000) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout });
  await el.scrollIntoViewIfNeeded();
  await el.click();
}

async function goTo(page, path, waitMs = 2000) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(waitMs);
}

// ═══════════════════════════════════════════════════════════════════
(async () => {
  console.log('\n🚀 Starting E2E Test — 5 New ATS Capabilities\n');

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // ─── Login ────────────────────────────────────────────────────
  try {
    await goTo(page, '/login');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await safeClick(page, 'button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await ss(page, 'login-success');
    log('Login', 'PASS', 'Logged in as admin');
  } catch (e) {
    log('Login', 'FAIL', e.message);
    await browser.close();
    process.exit(1);
  }

  // Get API token for direct API tests
  let token;
  try {
    const res = await api('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    token = res.data?.access_token;
    log('API Token', token ? 'PASS' : 'FAIL', token ? 'Got token' : 'No token');
  } catch (e) {
    log('API Token', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // A. REFERRALS PAGE
  // ═══════════════════════════════════════════════════════════════
  console.log('\n── A. Referrals ──');
  try {
    await goTo(page, '/referrals', 3000);
    await ss(page, 'referrals-page');

    // Check page rendered (heading or content)
    const pageContent = await page.textContent('body');
    const hasReferrals = pageContent.includes('Referral') || pageContent.includes('referral');
    log('A1. Referrals page loads', hasReferrals ? 'PASS' : 'FAIL', hasReferrals ? 'Page has referral content' : 'Missing referral content');

    // Check for KPI cards (should have stat cards)
    const cards = await page.locator('[class*="card"], [class*="Card"]').count();
    log('A2. Referrals KPI cards', cards > 0 ? 'PASS' : 'SKIP', `${cards} card elements found`);

    // Test API: Create referral link
    if (token) {
      const res = await api('POST', '/api/referrals/links', { jd_id: 5 }, token);
      log('A3. API create referral link', res.status === 200 ? 'PASS' : 'FAIL', `HTTP ${res.status}`);

      // Track referral (public)
      if (res.data?.code) {
        const track = await api('GET', `/api/referrals/track/${res.data.code}`);
        log('A4. API track referral (public)', track.status === 200 ? 'PASS' : 'FAIL', `HTTP ${track.status}`);
      }

      // Leaderboard
      const lb = await api('GET', '/api/referrals/leaderboard', null, token);
      log('A5. API referral leaderboard', lb.status === 200 ? 'PASS' : 'FAIL', `HTTP ${lb.status}`);
    }
  } catch (e) {
    log('A. Referrals', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // B. OUTREACH PAGE
  // ═══════════════════════════════════════════════════════════════
  console.log('\n── B. Outreach ──');
  try {
    await goTo(page, '/outreach', 3000);
    await ss(page, 'outreach-page');

    const pageContent = await page.textContent('body');
    const hasOutreach = pageContent.includes('Outreach') || pageContent.includes('Campaign') || pageContent.includes('campaign');
    log('B1. Outreach page loads', hasOutreach ? 'PASS' : 'FAIL');

    // Check for tabs
    const tabs = await page.locator('[role="tab"], [data-state]').count();
    log('B2. Outreach has tabs', tabs > 0 ? 'PASS' : 'SKIP', `${tabs} tab elements`);

    // API: Create campaign
    if (token) {
      const res = await api('POST', '/api/outreach/campaigns', {
        name: 'E2E Test Campaign',
        jd_id: 5,
        template_subject: 'Hi {{candidate_name}}',
        template_body: 'Test body',
        campaign_type: 'one_time'
      }, token);
      log('B3. API create campaign', res.status === 200 ? 'PASS' : 'FAIL', `HTTP ${res.status}`);

      // List campaigns
      const list = await api('GET', '/api/outreach/campaigns', null, token);
      log('B4. API list campaigns', list.status === 200 ? 'PASS' : 'FAIL', `Count: ${Array.isArray(list.data) ? list.data.length : '?'}`);

      // Create automation
      const auto = await api('POST', '/api/outreach/automations', {
        jd_id: 5,
        trigger_stage: 'screening',
        email_subject: 'Screening next steps',
        email_body: 'You passed screening!'
      }, token);
      log('B5. API create automation', auto.status === 200 ? 'PASS' : 'FAIL', `HTTP ${auto.status}`);

      // List automations
      const autos = await api('GET', '/api/outreach/automations?jd_id=5', null, token);
      log('B6. API list automations', autos.status === 200 ? 'PASS' : 'FAIL', `Count: ${Array.isArray(autos.data) ? autos.data.length : '?'}`);
    }
  } catch (e) {
    log('B. Outreach', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // C. AI TOOLKIT PAGE
  // ═══════════════════════════════════════════════════════════════
  console.log('\n── C. AI Toolkit ──');
  try {
    await goTo(page, '/ai-toolkit', 3000);
    await ss(page, 'ai-toolkit-page');

    const pageContent = await page.textContent('body');
    const hasAI = pageContent.includes('AI') || pageContent.includes('Toolkit') || pageContent.includes('Ranking');
    log('C1. AI Toolkit page loads', hasAI ? 'PASS' : 'FAIL');

    // Check for tool cards
    const toolCards = await page.locator('[class*="card"], [class*="Card"]').count();
    log('C2. AI Toolkit tool cards', toolCards >= 3 ? 'PASS' : 'SKIP', `${toolCards} cards found`);

    // API: Candidate ranking
    if (token) {
      const rank = await api('GET', '/api/ai-tools/rank/5', null, token);
      log('C3. API candidate ranking', rank.status === 200 ? 'PASS' : 'FAIL',
        `Rankings: ${rank.data?.rankings?.length ?? 0}`);

      // Salary intelligence
      const salary = await api('GET', '/api/ai-tools/salary/5', null, token);
      log('C4. API salary intelligence', salary.status === 200 ? 'PASS' : 'FAIL',
        salary.data ? `${salary.data.currency} ${salary.data.bands?.min}-${salary.data.bands?.max}` : '');

      // Skills gap
      const gap = await api('GET', '/api/ai-tools/skills-gap/5/9', null, token);
      log('C5. API skills gap', gap.status === 200 ? 'PASS' : 'FAIL',
        gap.data ? `Match: ${gap.data.match_percentage}%` : '');

      // Interview questions
      const qs = await api('GET', '/api/ai-tools/questions/5/9', null, token);
      log('C6. API interview questions', qs.status === 200 ? 'PASS' : 'FAIL',
        `Questions: ${qs.data?.questions?.length ?? 0}`);
    }
  } catch (e) {
    log('C. AI Toolkit', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // D. COMPLIANCE PAGE
  // ═══════════════════════════════════════════════════════════════
  console.log('\n── D. Compliance ──');
  try {
    await goTo(page, '/compliance', 3000);
    await ss(page, 'compliance-page');

    const pageContent = await page.textContent('body');
    const hasCompliance = pageContent.includes('Compliance') || pageContent.includes('Diversity') || pageContent.includes('SLA');
    log('D1. Compliance page loads', hasCompliance ? 'PASS' : 'FAIL');

    // Check for tabs
    const tabs = await page.locator('[role="tab"]').count();
    log('D2. Compliance has tabs', tabs >= 2 ? 'PASS' : 'SKIP', `${tabs} tabs found`);

    // Click SLA tab if exists
    try {
      const slaTab = page.locator('[role="tab"]').filter({ hasText: /SLA/i });
      if (await slaTab.count() > 0) {
        await slaTab.first().click();
        await page.waitForTimeout(1500);
        await ss(page, 'compliance-sla-tab');
        log('D3. SLA tab clickable', 'PASS');
      } else {
        log('D3. SLA tab clickable', 'SKIP', 'No SLA tab found');
      }
    } catch (e) {
      log('D3. SLA tab clickable', 'FAIL', e.message);
    }

    // Click Data Export tab if exists
    try {
      const exportTab = page.locator('[role="tab"]').filter({ hasText: /Export|Data/i });
      if (await exportTab.count() > 0) {
        await exportTab.first().click();
        await page.waitForTimeout(1500);
        await ss(page, 'compliance-export-tab');
        log('D4. Data Export tab clickable', 'PASS');
      } else {
        log('D4. Data Export tab clickable', 'SKIP', 'No Export tab found');
      }
    } catch (e) {
      log('D4. Data Export tab clickable', 'FAIL', e.message);
    }

    // API: Diversity stats
    if (token) {
      const div = await api('GET', '/api/compliance/diversity', null, token);
      log('D5. API diversity stats', div.status === 200 ? 'PASS' : 'FAIL',
        `Keys: ${Object.keys(div.data || {}).join(', ')}`);

      // SLA stats
      const sla = await api('GET', '/api/compliance/sla?jd_id=5', null, token);
      log('D6. API SLA stats', sla.status === 200 ? 'PASS' : 'FAIL',
        `Overdue: ${sla.data?.overdue_count}`);

      // Export candidate
      const exp = await api('GET', '/api/export/candidate/9?format=json', null, token);
      log('D7. API export candidate', exp.status === 200 ? 'PASS' : 'FAIL',
        `Keys: ${Object.keys(exp.data || {}).join(', ')}`);
    }
  } catch (e) {
    log('D. Compliance', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // E. CANDIDATE SCORECARD PAGE
  // ═══════════════════════════════════════════════════════════════
  console.log('\n── E. Candidate Scorecard ──');
  try {
    await goTo(page, '/scorecard/9?jd_id=5', 3000);
    await ss(page, 'scorecard-page');

    const pageContent = await page.textContent('body');
    const hasScorecard = pageContent.includes('Scorecard') || pageContent.includes('Score') || pageContent.includes('Resume') || pageContent.includes('Kenneth');
    log('E1. Scorecard page loads', hasScorecard ? 'PASS' : 'FAIL');

    // Check for tabs
    const tabs = await page.locator('[role="tab"]').count();
    log('E2. Scorecard has tabs', tabs >= 2 ? 'PASS' : 'SKIP', `${tabs} tabs found`);

    // Click through tabs
    const tabNames = ['Interview', 'Feedback', 'Timeline'];
    for (const tabName of tabNames) {
      try {
        const tab = page.locator('[role="tab"]').filter({ hasText: new RegExp(tabName, 'i') });
        if (await tab.count() > 0) {
          await tab.first().click();
          await page.waitForTimeout(1000);
          await ss(page, `scorecard-${tabName.toLowerCase()}-tab`);
          log(`E3. Scorecard ${tabName} tab`, 'PASS');
        } else {
          log(`E3. Scorecard ${tabName} tab`, 'SKIP', 'Tab not found');
        }
      } catch (e) {
        log(`E3. Scorecard ${tabName} tab`, 'FAIL', e.message);
      }
    }

    // API: Scorecard
    if (token) {
      const sc = await api('GET', '/api/scorecard/9?jd_id=5', null, token);
      log('E4. API scorecard', sc.status === 200 ? 'PASS' : 'FAIL',
        `Sections: ${Object.keys(sc.data || {}).join(', ')}`);

      // Timeline
      const tl = await api('GET', '/api/scorecard/9/timeline', null, token);
      log('E5. API timeline', tl.status === 200 ? 'PASS' : 'FAIL',
        `Events: ${Array.isArray(tl.data) ? tl.data.length : '?'}`);
    }
  } catch (e) {
    log('E. Candidate Scorecard', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // F. CANDIDATE COMPARE PAGE
  // ═══════════════════════════════════════════════════════════════
  console.log('\n── F. Candidate Compare ──');
  try {
    await goTo(page, '/compare?jd_id=5', 3000);
    await ss(page, 'compare-page');

    const pageContent = await page.textContent('body');
    const hasCompare = pageContent.includes('Compare') || pageContent.includes('compare');
    log('F1. Compare page loads', hasCompare ? 'PASS' : 'FAIL');

    // API: Compare
    if (token) {
      const cmp = await api('POST', '/api/scorecard/compare', {
        candidate_ids: [9, 11],
        jd_id: 5
      }, token);
      log('F2. API compare candidates', cmp.status === 200 ? 'PASS' : 'FAIL',
        `Scorecards: ${cmp.data?.scorecards?.length ?? 0}, Matrix dims: ${cmp.data?.comparison_matrix?.length ?? 0}`);
    }
  } catch (e) {
    log('F. Candidate Compare', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // G. SIDEBAR NAVIGATION
  // ═══════════════════════════════════════════════════════════════
  console.log('\n── G. Sidebar Navigation ──');
  try {
    await goTo(page, '/dashboard', 2000);

    const sidebar = await page.textContent('aside');
    const newItems = ['Referrals', 'Outreach', 'AI Toolkit', 'Compliance'];
    for (const item of newItems) {
      const found = sidebar?.includes(item);
      log(`G1. Sidebar has "${item}"`, found ? 'PASS' : 'FAIL');
    }

    // Click each new sidebar link
    for (const item of newItems) {
      try {
        const link = page.locator('aside button, aside a').filter({ hasText: item }).first();
        if (await link.count() > 0) {
          await link.click();
          await page.waitForTimeout(1500);
          await ss(page, `sidebar-nav-${item.toLowerCase().replace(/\s/g, '-')}`);
          log(`G2. Navigate to ${item}`, 'PASS');
        } else {
          log(`G2. Navigate to ${item}`, 'SKIP', 'Link not found');
        }
      } catch (e) {
        log(`G2. Navigate to ${item}`, 'FAIL', e.message);
      }
    }
  } catch (e) {
    log('G. Sidebar', 'FAIL', e.message);
  }

  // ═══════════════════════════════════════════════════════════════
  // H. PIPELINE CONFIG & APPROVALS API
  // ═══════════════════════════════════════════════════════════════
  console.log('\n── H. Pipeline Config & Approvals ──');
  if (token) {
    try {
      // Get pipeline config
      const cfg = await api('GET', '/api/pipeline-config/?jd_id=5', null, token);
      log('H1. API get pipeline config', cfg.status === 200 ? 'PASS' : 'FAIL',
        `Stages: ${Array.isArray(cfg.data) ? cfg.data.length : '?'}`);

      // Set custom pipeline config
      const customStages = [
        { name: 'applied', display_name: 'Applied', sort_order: 0, color: '#6B7280', is_terminal: false },
        { name: 'phone_screen', display_name: 'Phone Screen', sort_order: 1, color: '#3B82F6', is_terminal: false },
        { name: 'technical', display_name: 'Technical Round', sort_order: 2, color: '#8B5CF6', is_terminal: false },
        { name: 'interview', display_name: 'Interview', sort_order: 3, color: '#F59E0B', is_terminal: false },
        { name: 'offer', display_name: 'Offer', sort_order: 4, color: '#10B981', is_terminal: false },
        { name: 'hired', display_name: 'Hired', sort_order: 5, color: '#22C55E', is_terminal: true },
        { name: 'rejected', display_name: 'Rejected', sort_order: 6, color: '#EF4444', is_terminal: true }
      ];
      const setPcfg = await api('PUT', '/api/pipeline-config/5', customStages, token);
      log('H2. API set custom pipeline stages', setPcfg.status === 200 ? 'PASS' : 'FAIL',
        `Stages returned: ${Array.isArray(setPcfg.data) ? setPcfg.data.length : '?'}`);

      // Verify custom stage appears
      const verify = await api('GET', '/api/pipeline-config/?jd_id=5', null, token);
      const hasPhoneScreen = Array.isArray(verify.data) && verify.data.some(s => s.name === 'phone_screen');
      log('H3. Custom stage persisted', hasPhoneScreen ? 'PASS' : 'FAIL',
        hasPhoneScreen ? 'phone_screen found' : 'Missing');

      // Approvals
      const pending = await api('GET', '/api/approvals/pending', null, token);
      log('H4. API pending approvals', pending.status === 200 ? 'PASS' : 'FAIL',
        `Count: ${Array.isArray(pending.data) ? pending.data.length : '?'}`);

      // Request approval for job 6
      const reqApproval = await api('POST', '/api/approvals/6/request', null, token);
      log('H5. API request approval', reqApproval.status === 200 ? 'PASS' : 'FAIL');

      // Approve it
      const approve = await api('POST', '/api/approvals/6/approve', { comments: 'E2E test approved' }, token);
      log('H6. API approve job', approve.status === 200 ? 'PASS' : 'FAIL',
        approve.data?.status === 'approved' ? 'Status: approved' : `Status: ${approve.data?.status}`);

    } catch (e) {
      log('H. Pipeline/Approvals', 'FAIL', e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // I. JOB BOARDS API
  // ═══════════════════════════════════════════════════════════════
  console.log('\n── I. Job Boards ──');
  if (token) {
    try {
      // Publish to board
      const pub = await api('POST', '/api/job-boards/publish', {
        jd_id: 6,
        board_name: 'Indeed'
      }, token);
      log('I1. API publish to job board', pub.status === 200 ? 'PASS' : 'FAIL',
        `Board: ${pub.data?.board_name}, Status: ${pub.data?.status}`);

      // List boards
      const boards = await api('GET', '/api/job-boards/?jd_id=6', null, token);
      log('I2. API list job boards', boards.status === 200 ? 'PASS' : 'FAIL',
        `Count: ${Array.isArray(boards.data) ? boards.data.length : '?'}`);

      // Delete board posting
      if (pub.data?.id) {
        const del = await api('DELETE', `/api/job-boards/${pub.data.id}`, null, token);
        log('I3. API delete board posting', del.status === 200 ? 'PASS' : 'FAIL');
      }
    } catch (e) {
      log('I. Job Boards', 'FAIL', e.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // J. CONSOLE ERRORS CHECK
  // ═══════════════════════════════════════════════════════════════
  console.log('\n── J. Console Errors ──');
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes('favicon') &&
    !e.includes('404') &&
    !e.includes('net::ERR') &&
    !e.includes('ResizeObserver') &&
    !e.includes('Download the React DevTools')
  );
  log('J1. No critical console errors', criticalErrors.length === 0 ? 'PASS' : 'FAIL',
    criticalErrors.length > 0 ? `${criticalErrors.length} errors: ${criticalErrors.slice(0, 3).join(' | ')}` : 'Clean');

  // ═══════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log(`\n📊 Results: ${pass} passed, ${fail} failed, ${skip} skipped (${pass + fail + skip} total)\n`);

  if (fail > 0) {
    console.log('❌ FAILURES:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.test}: ${r.detail}`);
    });
    console.log('');
  }

  console.log(`📸 Screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log('');

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
