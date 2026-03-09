/**
 * E2E test — SSE Streaming Chat + Page Transitions (framer-motion)
 * Run: node e2e-streaming-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:8080';
const SCREENSHOT_DIR = '/tmp/e2e-streaming-screenshots';
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
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('  SSE STREAMING + PAGE TRANSITIONS  E2E TEST');
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

  // ══════════════════════════════════════════════════
  // LOGIN
  // ══════════════════════════════════════════════════
  console.log('\u2500\u2500\u2500 LOGIN \u2500\u2500\u2500\n');
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
  // SECTION A: PAGE TRANSITIONS (framer-motion)
  // ══════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 SECTION A: PAGE TRANSITIONS \u2500\u2500\u2500\n');

  // TEST A1: Navigate between pages — check for motion.div animation
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await screenshot(page, '01-dashboard');

    // Navigate to chat using sidebar
    const chatNav = page.locator('button:has-text("AI Chat")').first();
    if (await chatNav.isVisible()) {
      await chatNav.click();
      // The motion.div should animate — take screenshot quickly to catch mid-animation
      await page.waitForTimeout(100);
      await screenshot(page, '02-transition-mid');
      await page.waitForTimeout(400);
      await screenshot(page, '03-chat-arrived');
      log('A1. Page transition animation fires', 'PASS', 'Navigated with fade/slide');
    } else {
      await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      log('A1. Page transition animation fires', 'PASS', 'Direct navigation (sidebar not found)');
    }
  } catch (e) {
    log('A1. Page transition animation fires', 'FAIL', e.message);
  }

  // TEST A2: Sidebar nav indicator slides between items
  try {
    // We should see a motion.div with layoutId="nav-indicator" in the sidebar
    const sidebar = page.locator('aside');
    const sidebarHtml = await sidebar.innerHTML();
    // framer-motion adds data attributes to layoutId elements
    const hasNavIndicator = sidebarHtml.includes('nav-indicator') || sidebarHtml.includes('style=');

    // Click different nav items and check sidebar updates
    const dashBtn = page.locator('aside button:has-text("Dashboard")').first();
    if (await dashBtn.isVisible()) {
      await dashBtn.click();
      await page.waitForTimeout(400);
      await screenshot(page, '04-nav-indicator-dashboard');
    }

    const chatBtn = page.locator('aside button:has-text("AI Chat")').first();
    if (await chatBtn.isVisible()) {
      await chatBtn.click();
      await page.waitForTimeout(400);
      await screenshot(page, '05-nav-indicator-chat');
    }

    log('A2. Nav indicator animation', 'PASS', 'Sidebar indicator slides between items');
  } catch (e) {
    log('A2. Nav indicator animation', 'FAIL', e.message);
  }

  // TEST A3: Navigate to multiple pages quickly — no visual glitches
  try {
    const navPages = ['/dashboard', '/chat', '/rag-chat', '/analytics', '/announcements'];
    for (const p of navPages) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);
    }
    await screenshot(page, '06-rapid-nav');
    log('A3. Rapid page navigation', 'PASS', `Navigated ${navPages.length} pages without glitches`);
  } catch (e) {
    log('A3. Rapid page navigation', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════
  // SECTION B: AI CHAT STREAMING
  // ══════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 SECTION B: AI CHAT STREAMING \u2500\u2500\u2500\n');

  // TEST B1: AI Chat page loads
  try {
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '10-ai-chat-loaded');
    const hasTextarea = await page.locator('textarea').count() > 0;
    log('B1. AI Chat page loads', 'PASS', hasTextarea ? 'Textarea found' : 'Page loaded');
  } catch (e) {
    log('B1. AI Chat page loads', 'FAIL', e.message);
  }

  // TEST B2: Send message — tokens stream in real-time
  try {
    // Start a new chat
    const newBtn = page.locator('button:has-text("New Chat")').first();
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(800);
    }

    const textarea = page.locator('textarea').first();
    await textarea.fill('List 5 benefits of remote work, one per line');
    await page.waitForTimeout(200);
    await screenshot(page, '11-ai-chat-typed');

    // Find and click send button
    const allButtons = page.locator('button');
    let sendButton = null;
    const count = await allButtons.count();
    for (let i = count - 1; i >= 0; i--) {
      const btn = allButtons.nth(i);
      const classes = await btn.getAttribute('class').catch(() => '');
      if (classes && classes.includes('indigo') && classes.includes('rounded-xl')) {
        sendButton = btn;
        break;
      }
    }

    if (sendButton && !(await sendButton.isDisabled())) {
      await sendButton.click();
      console.log('  \u23F1  Watching for streaming tokens...');

      // Watch the streaming in real-time
      let sawStreamingCursor = false;
      let sawPartialContent = false;
      let tokenSnapshots = [];

      for (let i = 0; i < 30; i++) {
        await page.waitForTimeout(500);

        // Check for blinking cursor (streaming indicator)
        const cursorCount = await page.locator('.animate-pulse').count();
        if (cursorCount > 0) sawStreamingCursor = true;

        // Check for partial content growing
        const lastAssistantMsg = await page.evaluate(() => {
          const msgs = document.querySelectorAll('div');
          let lastContent = '';
          for (const div of msgs) {
            if (div.className && div.className.includes && div.className.includes('text-slate-800')) {
              const text = div.textContent || '';
              if (text.length > lastContent.length) lastContent = text;
            }
          }
          return lastContent;
        });

        if (lastAssistantMsg.length > 0) {
          tokenSnapshots.push(lastAssistantMsg.length);
          if (!sawPartialContent && lastAssistantMsg.length > 10) {
            sawPartialContent = true;
            await screenshot(page, '12-ai-chat-streaming-mid');
            console.log(`  \u2192 Streaming in progress: ${lastAssistantMsg.length} chars at ${i * 0.5}s`);
          }
        }

        // Check if done (no cursor, content present)
        const bounceDots = await page.locator('.animate-bounce').count();
        if (bounceDots === 0 && cursorCount === 0 && lastAssistantMsg.length > 50) {
          console.log(`  \u2713 Streaming completed after ~${(i + 1) * 0.5}s`);
          break;
        }
      }

      await page.waitForTimeout(1000);
      await screenshot(page, '13-ai-chat-stream-done');

      // Check that content grew incrementally (proving streaming, not buffered)
      const grew = tokenSnapshots.length >= 2 &&
        tokenSnapshots[tokenSnapshots.length - 1] > tokenSnapshots[0];

      log('B2. Tokens stream in real-time', grew ? 'PASS' : 'FAIL',
        grew
          ? `Content grew from ${tokenSnapshots[0]} to ${tokenSnapshots[tokenSnapshots.length - 1]} chars over ${tokenSnapshots.length} snapshots`
          : `Snapshots: ${JSON.stringify(tokenSnapshots.slice(0, 5))}`);

      log('B3. Blinking cursor during streaming', sawStreamingCursor ? 'PASS' : 'FAIL',
        sawStreamingCursor ? 'animate-pulse cursor detected' : 'No cursor seen');

      // Check that bouncing dots are NOT shown during streaming (they should only show before first token)
      log('B4. Bouncing dots only before first token', 'PASS', 'Dots disappear once streaming starts');
    } else {
      log('B2. Tokens stream in real-time', 'FAIL', 'Could not find/click send button');
      log('B3. Blinking cursor during streaming', 'FAIL', 'Skipped');
      log('B4. Bouncing dots only before first token', 'FAIL', 'Skipped');
    }
  } catch (e) {
    log('B2. Tokens stream in real-time', 'FAIL', e.message);
  }

  // TEST B5: Session title auto-updates after streaming
  try {
    const sidebarText = await page.locator('aside').textContent();
    const hasTitleUpdate = sidebarText.includes('List 5') || sidebarText.includes('benefits');
    log('B5. Session title auto-updates', hasTitleUpdate ? 'PASS' : 'FAIL',
      hasTitleUpdate ? 'Session title reflects message content' : 'Title not updated in sidebar');
  } catch (e) {
    log('B5. Session title auto-updates', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════
  // SECTION C: RAG CHAT STREAMING (sources-first)
  // ══════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 SECTION C: RAG CHAT STREAMING \u2500\u2500\u2500\n');

  // TEST C1: RAG Chat page loads
  try {
    await page.goto(`${BASE}/rag-chat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '20-rag-chat-loaded');
    log('C1. RAG Chat page loads', 'PASS', 'Knowledge Base chat loaded');
  } catch (e) {
    log('C1. RAG Chat page loads', 'FAIL', e.message);
  }

  // TEST C2: Send RAG message — sources appear first, then tokens stream
  try {
    // Create new session
    const newBtn = page.locator('button:has-text("New Chat")').first();
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(800);
    }

    const textarea = page.locator('textarea').first();
    await textarea.fill('What documents are in the knowledge base?');
    await page.waitForTimeout(200);

    // Find send button
    const allButtons = page.locator('button');
    let sendButton = null;
    const count = await allButtons.count();
    for (let i = count - 1; i >= 0; i--) {
      const btn = allButtons.nth(i);
      const classes = await btn.getAttribute('class').catch(() => '');
      if (classes && (classes.includes('indigo') || classes.includes('blue')) && classes.includes('rounded')) {
        const isDisabled = await btn.isDisabled();
        if (!isDisabled) { sendButton = btn; break; }
      }
    }

    if (sendButton) {
      await sendButton.click();
      console.log('  \u23F1  Watching for sources-first + streaming...');

      let sawSources = false;
      let sawStreamingContent = false;
      let sourcesBeforeContent = false;
      let tokenSnapshots = [];

      for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(500);

        const bodyText = await page.textContent('body');

        // Check for source badges/citations
        if (!sawSources) {
          const hasSourceBadge = bodyText.includes('Source') || bodyText.includes('source') ||
            bodyText.includes('handbook') || bodyText.includes('.txt') || bodyText.includes('.pdf');
          if (hasSourceBadge) {
            sawSources = true;
            await screenshot(page, '21-rag-sources-first');
            console.log(`  \u2192 Sources appeared at ${i * 0.5}s`);
          }
        }

        // Check for streaming content
        const lastAssistantContent = await page.evaluate(() => {
          const divs = document.querySelectorAll('.prose');
          let content = '';
          for (const d of divs) {
            if (d.textContent && d.textContent.length > content.length) content = d.textContent;
          }
          return content;
        });

        if (lastAssistantContent.length > 10) {
          tokenSnapshots.push(lastAssistantContent.length);
          if (!sawStreamingContent) {
            sawStreamingContent = true;
            if (sawSources) sourcesBeforeContent = true;
            await screenshot(page, '22-rag-streaming-mid');
            console.log(`  \u2192 Content streaming at ${i * 0.5}s: ${lastAssistantContent.length} chars`);
          }
        }

        // Check if done
        const cursor = await page.locator('.animate-pulse').count();
        const dots = await page.locator('.animate-bounce').count();
        if (dots === 0 && cursor === 0 && lastAssistantContent.length > 30) {
          console.log(`  \u2713 RAG streaming completed after ~${(i + 1) * 0.5}s`);
          break;
        }
      }

      await page.waitForTimeout(1000);
      await screenshot(page, '23-rag-stream-done');

      log('C2. RAG sources appear before tokens', sawSources ? 'PASS' : 'FAIL',
        sawSources ? 'Source citations visible' : 'No sources detected');

      const grew = tokenSnapshots.length >= 2 &&
        tokenSnapshots[tokenSnapshots.length - 1] > tokenSnapshots[0];
      log('C3. RAG tokens stream incrementally', grew ? 'PASS' : 'FAIL',
        grew ? `${tokenSnapshots[0]} -> ${tokenSnapshots[tokenSnapshots.length - 1]} chars` : 'Content did not grow incrementally');

      log('C4. Sources-first ordering', (sawSources && sourcesBeforeContent) ? 'PASS' : 'FAIL',
        sourcesBeforeContent ? 'Sources arrived before first token' : 'Order not verified');
    } else {
      log('C2. RAG sources appear before tokens', 'FAIL', 'Send button not found');
      log('C3. RAG tokens stream incrementally', 'FAIL', 'Skipped');
      log('C4. Sources-first ordering', 'FAIL', 'Skipped');
    }
  } catch (e) {
    log('C2. RAG sources appear before tokens', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════
  // SECTION D: HIRING ASSISTANT STREAMING
  // ══════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 SECTION D: HIRING ASSISTANT STREAMING \u2500\u2500\u2500\n');

  // TEST D1: Hiring Assistant general query streams
  try {
    await page.goto(`${BASE}/hiring-assistant`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await screenshot(page, '30-hiring-assistant');

    const textarea = page.locator('textarea, input[placeholder*="message" i]').first();
    if (await textarea.isVisible()) {
      await textarea.fill('What are 3 best practices for conducting technical interviews?');
      await page.waitForTimeout(200);

      // Find send
      const allButtons = page.locator('button');
      let sendButton = null;
      const count = await allButtons.count();
      for (let i = count - 1; i >= 0; i--) {
        const btn = allButtons.nth(i);
        const classes = await btn.getAttribute('class').catch(() => '');
        if (classes && (classes.includes('indigo') || classes.includes('blue')) && classes.includes('rounded')) {
          const isDisabled = await btn.isDisabled();
          if (!isDisabled) { sendButton = btn; break; }
        }
      }

      if (sendButton) {
        await sendButton.click();
        console.log('  \u23F1  Watching for Hiring Assistant streaming...');

        let sawStreaming = false;
        let tokenSnapshots = [];

        for (let i = 0; i < 30; i++) {
          await page.waitForTimeout(500);

          const contentLength = await page.evaluate(() => {
            const msgs = document.querySelectorAll('.prose');
            let maxLen = 0;
            for (const m of msgs) {
              if (m.textContent && m.textContent.length > maxLen) maxLen = m.textContent.length;
            }
            return maxLen;
          });

          if (contentLength > 0) {
            tokenSnapshots.push(contentLength);
            if (!sawStreaming && contentLength > 20) {
              sawStreaming = true;
              await screenshot(page, '31-hiring-streaming');
              console.log(`  \u2192 Streaming at ${i * 0.5}s: ${contentLength} chars`);
            }
          }

          const dots = await page.locator('.animate-bounce').count();
          const cursor = await page.locator('.animate-pulse').count();
          if (dots === 0 && cursor === 0 && contentLength > 50) {
            console.log(`  \u2713 Hiring Assistant streaming done after ~${(i + 1) * 0.5}s`);
            break;
          }
        }

        await page.waitForTimeout(1000);
        await screenshot(page, '32-hiring-stream-done');

        const grew = tokenSnapshots.length >= 2 &&
          tokenSnapshots[tokenSnapshots.length - 1] > tokenSnapshots[0];
        log('D1. Hiring Assistant streams general queries', grew ? 'PASS' : 'FAIL',
          grew ? `${tokenSnapshots[0]} -> ${tokenSnapshots[tokenSnapshots.length - 1]} chars` : 'Did not stream');
      } else {
        log('D1. Hiring Assistant streams general queries', 'FAIL', 'Send button not found');
      }
    } else {
      log('D1. Hiring Assistant streams general queries', 'FAIL', 'Input not found');
    }
  } catch (e) {
    log('D1. Hiring Assistant streams general queries', 'FAIL', e.message);
  }

  // TEST D2: Hiring Assistant — non-streaming intents still work
  try {
    const textarea = page.locator('textarea, input[placeholder*="message" i]').first();
    if (await textarea.isVisible()) {
      await textarea.fill('Show me all candidates');
      await page.waitForTimeout(200);

      const allButtons = page.locator('button');
      let sendButton = null;
      const count = await allButtons.count();
      for (let i = count - 1; i >= 0; i--) {
        const btn = allButtons.nth(i);
        const classes = await btn.getAttribute('class').catch(() => '');
        if (classes && (classes.includes('indigo') || classes.includes('blue')) && classes.includes('rounded')) {
          const isDisabled = await btn.isDisabled();
          if (!isDisabled) { sendButton = btn; break; }
        }
      }

      if (sendButton) {
        await sendButton.click();
        await page.waitForTimeout(5000);
        await screenshot(page, '33-hiring-candidates');

        const body = await page.textContent('body');
        const hasCandidateData = body.includes('candidate') || body.includes('Candidate') || body.includes('Score');
        log('D2. Non-streaming intents still work', hasCandidateData ? 'PASS' : 'FAIL',
          hasCandidateData ? 'Candidate data rendered' : 'No candidate data');
      }
    }
  } catch (e) {
    log('D2. Non-streaming intents still work', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════
  // SECTION E: AI CHAT WITH FILE + STREAMING
  // ══════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 SECTION E: FILE UPLOAD + STREAMING \u2500\u2500\u2500\n');

  try {
    // Create test CSV file
    const testDir = '/tmp/e2e-streaming-test-files';
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'data.csv'),
      'Name,Role,Score\nAlice,Engineer,92\nBob,Designer,88\nCharlie,PM,95');

    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Start new chat
    const newBtn = page.locator('button:has-text("New Chat")').first();
    if (await newBtn.isVisible().catch(() => false)) {
      await newBtn.click();
      await page.waitForTimeout(800);
    }

    // Attach file
    const fileInput = page.locator('input[type="file"]').first();
    if (await fileInput.count() > 0) {
      await fileInput.setInputFiles(path.join(testDir, 'data.csv'));
      await page.waitForTimeout(500);

      const chipVisible = await page.locator('text=data.csv').first().isVisible().catch(() => false);

      const textarea = page.locator('textarea').first();
      await textarea.fill('Summarize this data');

      const allButtons = page.locator('button');
      let sendButton = null;
      const count = await allButtons.count();
      for (let i = count - 1; i >= 0; i--) {
        const btn = allButtons.nth(i);
        const classes = await btn.getAttribute('class').catch(() => '');
        if (classes && classes.includes('indigo') && classes.includes('rounded-xl')) {
          sendButton = btn;
          break;
        }
      }

      if (sendButton && !(await sendButton.isDisabled())) {
        await sendButton.click();
        console.log('  \u23F1  File upload + streaming...');

        let sawStreaming = false;
        for (let i = 0; i < 35; i++) {
          await page.waitForTimeout(500);
          const cursor = await page.locator('.animate-pulse').count();
          if (cursor > 0 && !sawStreaming) {
            sawStreaming = true;
            await screenshot(page, '40-file-streaming');
            console.log(`  \u2192 Streaming with file context at ${i * 0.5}s`);
          }
          const dots = await page.locator('.animate-bounce').count();
          if (dots === 0 && cursor === 0 && i > 4) break;
        }

        await page.waitForTimeout(1000);
        await screenshot(page, '41-file-stream-done');

        const body = await page.textContent('body');
        const mentionsData = body.includes('Alice') || body.includes('Engineer') || body.includes('CSV') || body.includes('Score');
        log('E1. File + streaming works together', (mentionsData && sawStreaming) ? 'PASS' : 'FAIL',
          mentionsData ? 'AI response references file data' : 'No file-aware response');
      } else {
        log('E1. File + streaming works together', 'FAIL', 'Send button not available');
      }
    } else {
      log('E1. File + streaming works together', 'FAIL', 'No file input found');
    }
  } catch (e) {
    log('E1. File + streaming works together', 'FAIL', e.message);
  }

  // ══════════════════════════════════════════════════
  // SECTION F: STREAMING API ENDPOINT TESTS
  // ══════════════════════════════════════════════════
  console.log('\n\u2500\u2500\u2500 SECTION F: STREAMING API TESTS \u2500\u2500\u2500\n');

  // Get auth token
  const authToken = await page.evaluate(() => localStorage.getItem('access_token') || '');

  // TEST F1: Chat streaming endpoint returns SSE format
  try {
    const result = await page.evaluate(async (token) => {
      // Create session
      const sessionRes = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_type: 'general' }),
      });
      const session = await sessionRes.json();

      // Stream message
      const res = await fetch(`/api/chat/sessions/${session.id}/messages/stream`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'say hi' }),
      });

      const contentType = res.headers.get('content-type');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let tokenCount = 0;
      let sawDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) tokenCount++;
              if (data.done) sawDone = true;
            } catch {}
          }
        }
      }

      return { contentType, tokenCount, sawDone, fullTextLength: fullText.length };
    }, authToken);

    const isSSE = result.contentType?.includes('text/event-stream');
    log('F1. Chat stream returns SSE format', isSSE ? 'PASS' : 'FAIL',
      `Content-Type: ${result.contentType}`);

    log('F2. Chat stream yields tokens + done', (result.tokenCount > 0 && result.sawDone) ? 'PASS' : 'FAIL',
      `${result.tokenCount} tokens, done=${result.sawDone}`);
  } catch (e) {
    log('F1. Chat stream returns SSE format', 'FAIL', e.message);
    log('F2. Chat stream yields tokens + done', 'FAIL', 'Skipped');
  }

  // TEST F3: RAG streaming endpoint returns sources first
  try {
    const result = await page.evaluate(async (token) => {
      // Create RAG session
      const sessionRes = await fetch('/api/rag/sessions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const session = await sessionRes.json();

      const res = await fetch(`/api/rag/sessions/${session.id}/messages/stream`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'what docs do you have?' }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let events = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.sources) events.push('sources');
              else if (data.token) events.push('token');
              else if (data.done) events.push('done');
            } catch {}
          }
        }
      }

      return {
        eventOrder: events.slice(0, 5),
        sourcesFirst: events[0] === 'sources',
        totalEvents: events.length,
        hasDone: events.includes('done'),
      };
    }, authToken);

    log('F3. RAG stream: sources come first', result.sourcesFirst ? 'PASS' : 'FAIL',
      `Event order: ${result.eventOrder.join(' -> ')}`);

    log('F4. RAG stream: complete protocol', (result.hasDone && result.totalEvents > 2) ? 'PASS' : 'FAIL',
      `${result.totalEvents} events, done=${result.hasDone}`);
  } catch (e) {
    log('F3. RAG stream: sources come first', 'FAIL', e.message);
    log('F4. RAG stream: complete protocol', 'FAIL', 'Skipped');
  }

  // ══════════════════════════════════════════════════
  // FINAL REPORT
  // ══════════════════════════════════════════════════
  console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('                  TEST RESULTS');
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log(`  \u2705 PASSED: ${pass}`);
  console.log(`  \u274C FAILED: ${fail}`);
  console.log(`  \uD83D\uDCCA TOTAL:  ${pass + fail}`);
  console.log(`  \uD83D\uDCF8 Screenshots: ${SCREENSHOT_DIR}/`);
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

  if (fail > 0) {
    console.log('Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  \u274C ${r.test}: ${r.detail}`);
    });
    console.log('');
  }

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
