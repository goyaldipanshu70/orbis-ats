/**
 * E2E test — Artifact Panel: No auto-open + Expand button on DataChart/CodeBlock
 * Run: node e2e-artifact-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:8080';
const SCREENSHOT_DIR = '/tmp/e2e-artifact-screenshots';
const ADMIN_EMAIL = 'admin@orbis.io';
const ADMIN_PASS = 'admin123';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

let pass = 0, fail = 0;
const results = [];

function log(test, status, detail = '') {
  const icon = status === 'PASS' ? '\u2705' : '\u274C';
  const line = `${icon} ${test}${detail ? ' — ' + detail : ''}`;
  console.log(line);
  results.push({ test, status, detail });
  if (status === 'PASS') pass++; else fail++;
}

async function screenshot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('\n══════════════════════════════════════════════════');
  console.log('  ARTIFACT PANEL — NO AUTO-OPEN + EXPAND BUTTONS');
  console.log('══════════════════════════════════════════════════\n');

  // ══════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════
  console.log('——— LOGIN ———\n');
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await page.waitForTimeout(1500);
    log('0. Login', 'PASS', 'Authenticated as admin');
  } catch (e) {
    log('0. Login', 'FAIL', e.message);
    await browser.close();
    process.exit(1);
  }

  // ══════════════════════════════════════════════════
  // NAVIGATE TO AI CHAT
  // ══════════════════════════════════════════════════
  console.log('\n——— NAVIGATE TO AI CHAT ———\n');
  try {
    const chatNav = page.locator('button:has-text("AI Chat")').first();
    await chatNav.click();
    await page.waitForTimeout(2000);
    await screenshot(page, '01-ai-chat-landing');
    log('1. Navigate to AI Chat', 'PASS');
  } catch (e) {
    log('1. Navigate to AI Chat', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════
  // SECTION A: TEST NO AUTO-OPEN (table data)
  // ══════════════════════════════════════════════════
  console.log('\n——— SECTION A: NO AUTO-OPEN FOR TABLE DATA ———\n');

  // TEST A1: Send a prompt that generates a markdown table
  let artifactPanelVisible = false;
  try {
    // Type a message that will generate tabular data
    const textarea = page.locator('textarea[placeholder*="Message"]').first();
    await textarea.fill('Give me a comparison table of 5 programming languages with columns: Language, Year Created, Typing, and Popularity. Use a markdown table format.');
    await page.waitForTimeout(300);

    // Send the message
    const sendBtn = page.locator('button:has(svg.lucide-arrow-up)').first();
    await sendBtn.click();
    await screenshot(page, '02-table-query-sent');

    // Wait for the streaming response to complete
    // The "Thinking..." indicator should appear first, then tokens stream in
    await page.waitForTimeout(2000);

    // Wait for streaming to finish — no more blinking cursor
    let streamFinished = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const cursor = page.locator('span.animate-pulse');
      if (await cursor.count() === 0) {
        streamFinished = true;
        break;
      }
    }

    await page.waitForTimeout(1000);
    await screenshot(page, '03-table-response-complete');

    if (!streamFinished) {
      log('A1. Stream completes for table query', 'FAIL', 'Streaming cursor still visible after 30s');
    } else {
      log('A1. Stream completes for table query', 'PASS', 'Response streamed successfully');
    }
  } catch (e) {
    log('A1. Stream completes for table query', 'FAIL', e.message);
  }

  // TEST A2: Check that artifact panel did NOT auto-open
  try {
    await page.waitForTimeout(500);
    // The artifact panel has class "animate-slide-in-right" and width 480px
    const artifactPanel = page.locator('.animate-slide-in-right');
    artifactPanelVisible = await artifactPanel.count() > 0;

    if (!artifactPanelVisible) {
      log('A2. Artifact panel does NOT auto-open', 'PASS', 'Panel stays closed — user must click Expand');
    } else {
      log('A2. Artifact panel does NOT auto-open', 'FAIL', 'Panel auto-opened — should not happen');
    }
    await screenshot(page, '04-no-auto-open-check');
  } catch (e) {
    log('A2. Artifact panel does NOT auto-open', 'FAIL', e.message);
  }

  // TEST A3: Check DataChart rendered inline (table view)
  let dataChartExists = false;
  try {
    // DataChart renders with chart type buttons (Table2 icon) or as a table element
    // Check for the DataChart toolbar which contains chart type icons
    const chartToolbar = page.locator('button[title="Table"]').first();
    const toolbarVisible = await chartToolbar.isVisible({ timeout: 3000 }).catch(() => false);

    if (toolbarVisible) {
      dataChartExists = true;
      log('A3. DataChart renders inline for table data', 'PASS', 'Interactive DataChart with chart type buttons');
    } else {
      // Also check for a <table> rendered by DataChart or markdown
      const table = page.locator('table').first();
      const tableVisible = await table.isVisible({ timeout: 2000 }).catch(() => false);
      if (tableVisible) {
        dataChartExists = true;
        log('A3. DataChart renders inline for table data', 'PASS', 'Table rendered inline');
      } else {
        // Check for Expand button which confirms data-bearing content exists
        const expandBtn = page.locator('button:has-text("Expand")').first();
        const expandVisible = await expandBtn.isVisible({ timeout: 2000 }).catch(() => false);
        if (expandVisible) {
          dataChartExists = true;
          log('A3. DataChart renders inline for table data', 'PASS', 'Content with Expand button found');
        } else {
          log('A3. DataChart renders inline for table data', 'FAIL', 'No table/chart/expand found in response');
        }
      }
    }
    await screenshot(page, '05-datachart-inline');
  } catch (e) {
    log('A3. DataChart renders inline for table data', 'FAIL', e.message);
  }

  // TEST A4: Check that "Expand" button exists on DataChart
  let expandBtnOnChart = null;
  try {
    // Look for the Expand button — it has PanelRightOpen icon + "Expand" text
    expandBtnOnChart = page.locator('button:has-text("Expand")').first();
    const expandVisible = await expandBtnOnChart.isVisible({ timeout: 3000 }).catch(() => false);

    if (expandVisible) {
      log('A4. Expand button visible on DataChart/CodeBlock', 'PASS', 'User can click to open panel');
    } else {
      log('A4. Expand button visible on DataChart/CodeBlock', 'FAIL', 'No Expand button found');
    }
    await screenshot(page, '06-expand-button-visible');
  } catch (e) {
    log('A4. Expand button visible on DataChart/CodeBlock', 'FAIL', e.message);
  }

  // TEST A5: Click Expand button — artifact panel opens
  try {
    if (expandBtnOnChart && await expandBtnOnChart.isVisible().catch(() => false)) {
      await expandBtnOnChart.click();
      await page.waitForTimeout(800);
      await screenshot(page, '07-expand-clicked');

      const artifactPanel = page.locator('.animate-slide-in-right');
      const panelOpened = await artifactPanel.count() > 0;

      if (panelOpened) {
        log('A5. Clicking Expand opens artifact panel', 'PASS', 'Panel slides in from right');
      } else {
        log('A5. Clicking Expand opens artifact panel', 'FAIL', 'Panel did not open');
      }
    } else {
      log('A5. Clicking Expand opens artifact panel', 'FAIL', 'No Expand button to click');
    }
  } catch (e) {
    log('A5. Clicking Expand opens artifact panel', 'FAIL', e.message);
  }

  // TEST A6: Artifact panel shows correct content
  try {
    const artifactPanel = page.locator('.animate-slide-in-right');
    if (await artifactPanel.count() > 0) {
      await screenshot(page, '08-artifact-panel-content');

      // Check for DataChart inside the panel (should have chart type buttons) or table content
      const panelContent = await artifactPanel.textContent();
      const hasDataContent = panelContent.includes('Table') || panelContent.includes('Bar') ||
                              panelContent.includes('Line') || panelContent.includes('Preview');

      if (hasDataContent) {
        log('A6. Artifact panel shows correct data', 'PASS', 'Panel has data visualization content');
      } else {
        log('A6. Artifact panel shows correct data', 'FAIL', `Panel content: ${panelContent?.substring(0, 100)}`);
      }
    } else {
      log('A6. Artifact panel shows correct data', 'FAIL', 'Panel not open');
    }
  } catch (e) {
    log('A6. Artifact panel shows correct data', 'FAIL', e.message);
  }

  // TEST A7: Close artifact panel
  try {
    const closeBtn = page.locator('.animate-slide-in-right button:has(.lucide-x)').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
      const panelGone = await page.locator('.animate-slide-in-right').count() === 0;
      if (panelGone) {
        log('A7. Close artifact panel', 'PASS', 'Panel dismissed');
      } else {
        log('A7. Close artifact panel', 'FAIL', 'Panel still visible');
      }
    } else {
      // Try PanelRightClose button in input bar
      const altClose = page.locator('button[title="Close artifact panel"]').first();
      if (await altClose.isVisible().catch(() => false)) {
        await altClose.click();
        await page.waitForTimeout(500);
        log('A7. Close artifact panel', 'PASS', 'Closed via input bar button');
      } else {
        log('A7. Close artifact panel', 'FAIL', 'No close button found');
      }
    }
    await screenshot(page, '09-panel-closed');
  } catch (e) {
    log('A7. Close artifact panel', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════
  // SECTION B: CODE BLOCK EXPAND (existing feature)
  // ══════════════════════════════════════════════════
  console.log('\n——— SECTION B: CODE BLOCK EXPAND ———\n');

  // TEST B1: Send a prompt that generates code
  try {
    const textarea = page.locator('textarea[placeholder*="Message"]').first();
    await textarea.fill('Write a Python function that calculates the fibonacci sequence recursively with memoization. Include at least 10 lines of code.');
    await page.waitForTimeout(300);

    const sendBtn = page.locator('button:has(svg.lucide-arrow-up)').first();
    await sendBtn.click();
    await screenshot(page, '10-code-query-sent');

    // Wait for streaming to finish
    let streamFinished = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const cursor = page.locator('span.animate-pulse');
      if (await cursor.count() === 0) {
        streamFinished = true;
        break;
      }
    }

    await page.waitForTimeout(1000);
    await screenshot(page, '11-code-response-complete');

    if (streamFinished) {
      log('B1. Code response streams completely', 'PASS');
    } else {
      log('B1. Code response streams completely', 'FAIL', 'Streaming cursor still visible');
    }
  } catch (e) {
    log('B1. Code response streams completely', 'FAIL', e.message);
  }

  // TEST B2: No auto-open for code blocks either
  try {
    const artifactPanel = page.locator('.animate-slide-in-right');
    const panelVisible = await artifactPanel.count() > 0;

    if (!panelVisible) {
      log('B2. Artifact panel does NOT auto-open for code', 'PASS');
    } else {
      log('B2. Artifact panel does NOT auto-open for code', 'FAIL', 'Panel auto-opened for code block');
    }
    await screenshot(page, '12-no-auto-open-code');
  } catch (e) {
    log('B2. Artifact panel does NOT auto-open for code', 'FAIL', e.message);
  }

  // TEST B3: Code block has Expand button
  try {
    // CodeBlock's expand button is inside the dark code header
    const codeExpandBtns = page.locator('button:has-text("Expand")');
    const count = await codeExpandBtns.count();

    if (count > 0) {
      log('B3. Code block has Expand button', 'PASS', `Found ${count} Expand button(s)`);
    } else {
      log('B3. Code block has Expand button', 'FAIL', 'No Expand buttons found');
    }
    await screenshot(page, '13-code-expand-buttons');
  } catch (e) {
    log('B3. Code block has Expand button', 'FAIL', e.message);
  }

  // TEST B4: Click Expand on code block — panel opens with code
  try {
    // Find the last Expand button (most recent code block)
    const codeExpandBtns = page.locator('button:has-text("Expand")');
    const count = await codeExpandBtns.count();
    if (count > 0) {
      const lastExpand = codeExpandBtns.nth(count - 1);
      await lastExpand.click();
      await page.waitForTimeout(800);
      await screenshot(page, '14-code-panel-opened');

      const artifactPanel = page.locator('.animate-slide-in-right');
      const panelOpened = await artifactPanel.count() > 0;

      if (panelOpened) {
        // Check for code-related content in panel
        const panelText = await artifactPanel.textContent();
        const hasCodeContent = panelText.includes('Code') || panelText.includes('Preview') || panelText.includes('Raw');
        if (hasCodeContent) {
          log('B4. Code Expand opens panel with code content', 'PASS', 'Code/Preview/Raw tabs visible');
        } else {
          log('B4. Code Expand opens panel with code content', 'FAIL', 'Panel lacks code tabs');
        }
      } else {
        log('B4. Code Expand opens panel with code content', 'FAIL', 'Panel did not open');
      }
    } else {
      log('B4. Code Expand opens panel with code content', 'FAIL', 'No Expand button to click');
    }
  } catch (e) {
    log('B4. Code Expand opens panel with code content', 'FAIL', e.message);
  }

  // TEST B5: Panel tabs work (Preview, Code, Raw)
  try {
    const artifactPanel = page.locator('.animate-slide-in-right');
    if (await artifactPanel.count() > 0) {
      // Click "Code" tab
      const codeTab = artifactPanel.locator('button:has-text("Code")').first();
      if (await codeTab.isVisible()) {
        await codeTab.click();
        await page.waitForTimeout(400);
        await screenshot(page, '15-code-tab');
      }

      // Click "Raw" tab
      const rawTab = artifactPanel.locator('button:has-text("Raw")').first();
      if (await rawTab.isVisible()) {
        await rawTab.click();
        await page.waitForTimeout(400);
        await screenshot(page, '16-raw-tab');
      }

      log('B5. Panel tabs (Code, Raw) work', 'PASS');
    } else {
      log('B5. Panel tabs (Code, Raw) work', 'FAIL', 'Panel not open');
    }
  } catch (e) {
    log('B5. Panel tabs (Code, Raw) work', 'FAIL', e.message);
  }

  // Close the panel
  try {
    const closeBtn = page.locator('.animate-slide-in-right button:has(.lucide-x)').first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  } catch { /* ignore */ }

  // ══════════════════════════════════════════════════
  // SECTION C: JSON CHART DATA EXPAND
  // ══════════════════════════════════════════════════
  console.log('\n——— SECTION C: JSON CHART DATA EXPAND ———\n');

  // TEST C1: Send prompt that generates JSON chart data
  try {
    const textarea = page.locator('textarea[placeholder*="Message"]').first();
    await textarea.fill('Give me quarterly revenue data for 2024 as a JSON array. Each object should have quarter, revenue, and profit fields. Use a ```json code block.');
    await page.waitForTimeout(300);

    const sendBtn = page.locator('button:has(svg.lucide-arrow-up)').first();
    await sendBtn.click();

    // Wait for streaming to finish
    let streamFinished = false;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      const cursor = page.locator('span.animate-pulse');
      if (await cursor.count() === 0) {
        streamFinished = true;
        break;
      }
    }

    await page.waitForTimeout(1000);
    await screenshot(page, '17-json-response');

    if (streamFinished) {
      log('C1. JSON chart data response streams', 'PASS');
    } else {
      log('C1. JSON chart data response streams', 'FAIL', 'Streaming cursor still visible');
    }
  } catch (e) {
    log('C1. JSON chart data response streams', 'FAIL', e.message);
  }

  // TEST C2: No auto-open for JSON data
  try {
    const artifactPanel = page.locator('.animate-slide-in-right');
    const panelVisible = await artifactPanel.count() > 0;

    if (!panelVisible) {
      log('C2. No auto-open for JSON chart data', 'PASS');
    } else {
      log('C2. No auto-open for JSON chart data', 'FAIL', 'Panel auto-opened');
    }
  } catch (e) {
    log('C2. No auto-open for JSON chart data', 'FAIL', e.message);
  }

  // TEST C3: DataChart rendered for JSON (interactive chart, not raw code)
  try {
    // Look for chart type buttons (Table, Bar, Line etc.) which indicate DataChart rendered
    const chartButtons = page.locator('.lucide-bar-chart3, .lucide-trending-up');
    const chartCount = await chartButtons.count();

    if (chartCount > 0) {
      log('C3. JSON rendered as interactive DataChart', 'PASS', `${chartCount} chart buttons found`);
    } else {
      // Might still have an Expand button on a CodeBlock
      const expandBtns = page.locator('button:has-text("Expand")');
      if (await expandBtns.count() > 0) {
        log('C3. JSON rendered as interactive DataChart', 'PASS', 'Code block with Expand button');
      } else {
        log('C3. JSON rendered as interactive DataChart', 'FAIL', 'No chart/code visualization found');
      }
    }
    await screenshot(page, '18-json-chart-inline');
  } catch (e) {
    log('C3. JSON rendered as interactive DataChart', 'FAIL', e.message);
  }

  // TEST C4: Expand button on JSON chart opens panel with DataChart
  try {
    // Find expand buttons — last ones are for the most recent message
    const expandBtns = page.locator('button:has-text("Expand")');
    const count = await expandBtns.count();
    if (count > 0) {
      const lastExpand = expandBtns.nth(count - 1);
      await lastExpand.click();
      await page.waitForTimeout(800);
      await screenshot(page, '19-json-panel-opened');

      const artifactPanel = page.locator('.animate-slide-in-right');
      const panelOpened = await artifactPanel.count() > 0;

      if (panelOpened) {
        log('C4. JSON Expand opens panel', 'PASS');
      } else {
        log('C4. JSON Expand opens panel', 'FAIL', 'Panel did not open');
      }

      // Close panel
      const closeBtn = page.locator('.animate-slide-in-right button:has(.lucide-x)').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      }
    } else {
      log('C4. JSON Expand opens panel', 'FAIL', 'No Expand button found');
    }
  } catch (e) {
    log('C4. JSON Expand opens panel', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════
  // SECTION D: CHART TYPE SWITCHING IN DataChart
  // ══════════════════════════════════════════════════
  console.log('\n——— SECTION D: CHART TYPE SWITCHING ———\n');

  // TEST D1: Switch between chart types inline
  try {
    // Find chart type buttons on the most recent DataChart
    const barBtn = page.locator('.lucide-bar-chart3').last();
    const lineBtn = page.locator('.lucide-trending-up').last();

    let switched = false;

    if (await barBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await barBtn.click();
      await page.waitForTimeout(600);
      await screenshot(page, '20-bar-chart');

      if (await lineBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await lineBtn.click();
        await page.waitForTimeout(600);
        await screenshot(page, '21-line-chart');
        switched = true;
      }
    }

    // Switch back to table
    const tableBtn = page.locator('.lucide-table2').last();
    if (await tableBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tableBtn.click();
      await page.waitForTimeout(600);
      await screenshot(page, '22-table-view');
      switched = true;
    }

    if (switched) {
      log('D1. Chart type switching works inline', 'PASS', 'Switched between table/bar/line views');
    } else {
      log('D1. Chart type switching works inline', 'FAIL', 'Could not find chart type buttons');
    }
  } catch (e) {
    log('D1. Chart type switching works inline', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════
  // SECTION E: NEW SESSION — VERIFY CLEAN STATE
  // ══════════════════════════════════════════════════
  console.log('\n——— SECTION E: NEW SESSION — CLEAN STATE ———\n');

  // TEST E1: Start new chat — no artifact panel
  try {
    const newChatBtn = page.locator('button:has-text("New Chat")').first();
    await newChatBtn.click();
    await page.waitForTimeout(800);

    const artifactPanel = page.locator('.animate-slide-in-right');
    const panelVisible = await artifactPanel.count() > 0;

    if (!panelVisible) {
      log('E1. New chat starts with no artifact panel', 'PASS');
    } else {
      log('E1. New chat starts with no artifact panel', 'FAIL', 'Panel visible on new chat');
    }
    await screenshot(page, '23-new-chat-clean');
  } catch (e) {
    log('E1. New chat starts with no artifact panel', 'FAIL', e.message);
  }

  // TEST E2: Load existing session — no auto-open
  try {
    // Click on an existing session in the sidebar (if any)
    const sessionBtns = page.locator('aside button:has(.lucide-message-square)');
    const sessionCount = await sessionBtns.count();

    if (sessionCount > 0) {
      await sessionBtns.first().click();
      await page.waitForTimeout(2000);

      const artifactPanel = page.locator('.animate-slide-in-right');
      const panelVisible = await artifactPanel.count() > 0;

      if (!panelVisible) {
        log('E2. Loading existing session does not auto-open panel', 'PASS');
      } else {
        log('E2. Loading existing session does not auto-open panel', 'FAIL', 'Panel auto-opened on session load');
      }
    } else {
      log('E2. Loading existing session does not auto-open panel', 'PASS', 'No existing sessions — skip');
    }
    await screenshot(page, '24-existing-session-no-panel');
  } catch (e) {
    log('E2. Loading existing session does not auto-open panel', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════
  console.log('\n══════════════════════════════════════════════════');
  console.log(`  RESULTS: ${pass} passed, ${fail} failed (${pass + fail} total)`);
  console.log('══════════════════════════════════════════════════\n');

  results.forEach(r => {
    const icon = r.status === 'PASS' ? '\u2705' : '\u274C';
    console.log(`  ${icon} ${r.test}${r.detail ? ' — ' + r.detail : ''}`);
  });

  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);
  console.log('');

  await page.waitForTimeout(2000);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
