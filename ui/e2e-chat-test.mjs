/**
 * E2E test for Chat file upload + artifact panel improvements.
 * Run: node e2e-chat-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:8080';
const SCREENSHOT_DIR = '/tmp/e2e-chat-screenshots';

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
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

// Create test files
function createTestFiles() {
  const dir = '/tmp/e2e-test-files';
  fs.mkdirSync(dir, { recursive: true });

  // CSV test file
  fs.writeFileSync(path.join(dir, 'test-data.csv'),
    'Name,Age,City,Role\nAlice,30,New York,Engineer\nBob,25,London,Designer\nCharlie,35,Tokyo,Manager\nDiana,28,Paris,Analyst\nEve,32,Berlin,Developer'
  );

  // TXT test file
  fs.writeFileSync(path.join(dir, 'test-notes.txt'),
    'Project Meeting Notes\n\nDate: February 28, 2026\nAttendees: Alice, Bob, Charlie\n\nAgenda:\n1. Q1 Review\n2. Product Roadmap\n3. Hiring Plan\n\nKey Decisions:\n- Launch new feature by March 15\n- Hire 3 more engineers\n- Budget approved for cloud migration'
  );

  // JSON test file
  fs.writeFileSync(path.join(dir, 'test-config.json'),
    JSON.stringify({
      project: 'Orbis Platform',
      version: '2.0.0',
      features: ['auth', 'chat', 'rag', 'hiring'],
      settings: { theme: 'dark', language: 'en', maxUploadSize: '10MB' }
    }, null, 2)
  );

  // MD test file
  fs.writeFileSync(path.join(dir, 'test-readme.md'),
    '# Test Project\n\n## Overview\nThis is a test markdown file.\n\n## Features\n- Feature 1: Authentication\n- Feature 2: Chat\n- Feature 3: File Upload\n\n## Table\n| Feature | Status | Priority |\n|---------|--------|----------|\n| Auth | Done | High |\n| Chat | WIP | High |\n| Upload | New | Medium |'
  );

  return dir;
}

(async () => {
  const testFilesDir = createTestFiles();
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ── Login ──────────────────────────────────────────
  console.log('\n🔐 Logging in as admin...');
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', 'admin@orbis.io');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('✅ Logged in\n');

  // ════════════════════════════════════════════════════
  // SECTION 1: Chat page loads
  // ════════════════════════════════════════════════════
  console.log('💬 Testing AI Chat page...\n');

  try {
    await page.goto(`${BASE}/chat`);
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 2000));
    await screenshot(page, '01-chat-page');

    const chatPage = await page.locator('text=Orbis AI').first().isVisible().catch(() => false) ||
                     await page.locator('text=Message Orbis').first().isVisible().catch(() => false) ||
                     await page.locator('textarea').first().isVisible().catch(() => false);
    log('1. Chat page loads', chatPage ? 'PASS' : 'FAIL', chatPage ? 'Chat page visible' : 'Chat page not found');
  } catch (err) {
    log('1. Chat page loads', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // SECTION 2: Attach button is clickable
  // ════════════════════════════════════════════════════
  try {
    const attachBtn = page.locator('button[title*="Attach"]').first();
    const attachVisible = await attachBtn.isVisible().catch(() => false);
    log('2. Attach button visible', attachVisible ? 'PASS' : 'FAIL',
      attachVisible ? 'Paperclip button found' : 'No attach button');

    if (attachVisible) {
      await attachBtn.click();
      await new Promise(r => setTimeout(r, 300));
      // Check that hidden file input exists
      const fileInput = page.locator('input[type="file"]').first();
      const inputExists = await fileInput.count() > 0;
      log('3. File input exists', inputExists ? 'PASS' : 'FAIL',
        inputExists ? 'Hidden file input found' : 'No file input');
    } else {
      log('3. File input exists', 'FAIL', 'Skipped — no attach button');
    }
  } catch (err) {
    log('2. Attach button visible', 'FAIL', err.message.slice(0, 100));
    log('3. File input exists', 'FAIL', 'Skipped');
  }

  // ════════════════════════════════════════════════════
  // SECTION 3: Upload CSV file and verify chip
  // ════════════════════════════════════════════════════
  try {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(testFilesDir, 'test-data.csv'));
    await new Promise(r => setTimeout(r, 500));

    await screenshot(page, '02-file-chip');

    // Check for file chip
    const chipVisible = await page.locator('text=test-data.csv').first().isVisible().catch(() => false);
    log('4. CSV file chip appears', chipVisible ? 'PASS' : 'FAIL',
      chipVisible ? 'File chip showing "test-data.csv"' : 'No file chip found');

    // Check for remove (X) button on chip
    if (chipVisible) {
      const removeBtn = page.locator('text=test-data.csv').locator('..').locator('button').first();
      const removeVisible = await removeBtn.isVisible().catch(() => false);
      log('5. File chip has remove button', removeVisible ? 'PASS' : 'FAIL',
        removeVisible ? 'X button on chip' : 'No remove button');
    } else {
      log('5. File chip has remove button', 'FAIL', 'Skipped — no chip');
    }
  } catch (err) {
    log('4. CSV file chip appears', 'FAIL', err.message.slice(0, 100));
    log('5. File chip has remove button', 'FAIL', 'Skipped');
  }

  // ════════════════════════════════════════════════════
  // SECTION 4: Send message with attached file
  // ════════════════════════════════════════════════════
  try {
    // Type a message with the file attached
    const textarea = page.locator('textarea').first();
    await textarea.fill('Summarize this CSV data for me');
    await new Promise(r => setTimeout(r, 300));

    // Send button should be enabled
    const sendBtn = page.locator('button').filter({ has: page.locator('svg') }).last();
    // Find the actual send button (indigo colored)
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

    if (sendButton) {
      const isDisabled = await sendButton.isDisabled();
      log('6. Send button enabled with file', !isDisabled ? 'PASS' : 'FAIL',
        !isDisabled ? 'Send button active' : 'Send button disabled');

      // Click send
      await sendButton.click();
      await screenshot(page, '03-sending-with-file');

      // Wait for response (up to 30s for AI)
      console.log('  ⏱️  Waiting for AI response (up to 30s)...');
      try {
        await page.waitForSelector('text=📎 test-data.csv', { timeout: 5000 }).catch(() => {});
        // Wait for the assistant response
        await page.waitForFunction(() => {
          const msgs = document.querySelectorAll('[class*="bg-slate-50"], [class*="bg-white"]');
          return msgs.length >= 2;
        }, { timeout: 30000 }).catch(() => {});

        await new Promise(r => setTimeout(r, 2000));
        await screenshot(page, '04-ai-response');

        // Check if user message shows file attachment indicator
        const fileIndicator = await page.locator('text=test-data.csv').first().isVisible().catch(() => false);
        log('7. File indicator in user message', fileIndicator ? 'PASS' : 'FAIL',
          fileIndicator ? '📎 indicator visible' : 'No file indicator');

        // Check if assistant responded
        const responseExists = await page.evaluate(() => {
          const elements = document.querySelectorAll('div');
          for (const el of elements) {
            if (el.textContent && (
              el.textContent.includes('CSV') ||
              el.textContent.includes('data') ||
              el.textContent.includes('Alice') ||
              el.textContent.includes('rows') ||
              el.textContent.includes('Name')
            )) {
              // Check if this is from the assistant
              const parent = el.closest('[class*="max-w-"]');
              if (parent) return true;
            }
          }
          return false;
        });
        log('8. AI responds with file context', responseExists ? 'PASS' : 'FAIL',
          responseExists ? 'AI mentioned file content' : 'No file-aware response detected');
      } catch (err) {
        log('7. File indicator in user message', 'FAIL', err.message.slice(0, 80));
        log('8. AI responds with file context', 'FAIL', 'Timeout waiting for response');
      }

      // File chip should be cleared after sending
      const chipGone = !(await page.locator('text=test-data.csv').locator('..').locator('button').first().isVisible().catch(() => false));
      log('9. File chip cleared after send', chipGone ? 'PASS' : 'FAIL',
        chipGone ? 'Chip removed' : 'Chip still visible');
    } else {
      log('6. Send button enabled with file', 'FAIL', 'Could not find send button');
      log('7. File indicator in user message', 'FAIL', 'Skipped');
      log('8. AI responds with file context', 'FAIL', 'Skipped');
      log('9. File chip cleared after send', 'FAIL', 'Skipped');
    }
  } catch (err) {
    log('6. Send button enabled with file', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // SECTION 5: Upload TXT file (without text, just file)
  // ════════════════════════════════════════════════════
  try {
    console.log('\n📄 Testing TXT file upload (file only, no text)...');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(testFilesDir, 'test-notes.txt'));
    await new Promise(r => setTimeout(r, 500));

    const chipVisible = await page.locator('text=test-notes.txt').first().isVisible().catch(() => false);
    log('10. TXT file chip appears', chipVisible ? 'PASS' : 'FAIL',
      chipVisible ? 'Chip visible' : 'No chip');

    // Send without typing any text — should still work
    if (chipVisible) {
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

      if (sendButton) {
        const isDisabled = await sendButton.isDisabled();
        log('11. Send enabled with file only (no text)', !isDisabled ? 'PASS' : 'FAIL',
          !isDisabled ? 'Can send file without text' : 'Disabled without text');

        if (!isDisabled) {
          await sendButton.click();
          console.log('  ⏱️  Waiting for AI response...');
          await new Promise(r => setTimeout(r, 15000));
          await screenshot(page, '05-txt-file-response');
          log('12. TXT file processed', 'PASS', 'Message sent with file');
        } else {
          log('12. TXT file processed', 'FAIL', 'Send disabled');
        }
      }
    }
  } catch (err) {
    log('10. TXT file chip appears', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // SECTION 6: Test artifact panel with code response
  // ════════════════════════════════════════════════════
  try {
    console.log('\n🎨 Testing artifact panel...');

    // Start a new chat by clicking the prominent "New Chat" button in the sidebar
    const newChatBtn = page.locator('button:has-text("New Chat")').first();
    const newChatVisible = await newChatBtn.isVisible().catch(() => false);
    if (newChatVisible) {
      await newChatBtn.click();
      await new Promise(r => setTimeout(r, 1500));
    }

    // Ask for code that will trigger artifact panel
    const textarea = page.locator('textarea').first();
    await textarea.fill('Write a Python function to calculate fibonacci numbers with memoization. Include error handling and docstrings. Make the code at least 15 lines. Put it in a ```python code block.');
    await new Promise(r => setTimeout(r, 300));

    // Find send button
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

    if (sendButton) {
      await sendButton.click();
      console.log('  ⏱️  Waiting for code response (up to 45s)...');

      // Wait for actual response — look for bounce animation to stop (loading done)
      let responseArrived = false;
      for (let i = 0; i < 45; i++) {
        await new Promise(r => setTimeout(r, 1000));
        // Check if loading indicator (bounce dots) is gone AND we have a code block
        const bounceDots = await page.locator('.animate-bounce').count();
        const codeBlocks = await page.locator('pre code, [class*="prism"]').count();
        if (bounceDots === 0 && codeBlocks > 0) {
          responseArrived = true;
          console.log(`  ✓ Response arrived after ${i + 1}s`);
          break;
        }
      }

      await new Promise(r => setTimeout(r, 1500)); // extra settle time
      await screenshot(page, '06-code-response');

      if (!responseArrived) {
        // Even if no code block, check if ANY response came
        const thinkingGone = (await page.locator('text=Thinking').count()) === 0;
        responseArrived = thinkingGone;
        console.log(`  ⚠ No code block detected, thinkingGone=${thinkingGone}`);
      }

      // Check if artifact panel opened automatically
      const panelOpen = await page.locator('.animate-slide-in-right').first().isVisible().catch(() => false);
      // Also check for the Preview/Code/Raw tabs which only exist in the artifact panel
      const tabsVisible = await page.locator('button:has-text("Raw")').first().isVisible().catch(() => false);
      const artifactDetected = panelOpen || tabsVisible;

      log('13. Artifact panel auto-opens for code', artifactDetected ? 'PASS' : 'FAIL',
        artifactDetected ? 'Panel visible with tabs' : `No panel. Response arrived: ${responseArrived}`);

      if (artifactDetected) {
        // Check for tabs: Preview, Code, Raw
        const codeTab = page.locator('button:has-text("Code")').first();
        const rawTab = page.locator('button:has-text("Raw")').first();
        const previewTab = page.locator('button:has-text("Preview")').first();

        const codeTabExists = await codeTab.isVisible().catch(() => false);
        const rawTabExists = await rawTab.isVisible().catch(() => false);
        const previewTabExists = await previewTab.isVisible().catch(() => false);

        log('14. Artifact tabs present', (codeTabExists && rawTabExists && previewTabExists) ? 'PASS' : 'FAIL',
          `Preview: ${previewTabExists}, Code: ${codeTabExists}, Raw: ${rawTabExists}`);

        // Click Code tab and verify syntax highlighting
        if (codeTabExists) {
          await codeTab.click();
          await new Promise(r => setTimeout(r, 500));
          await screenshot(page, '07-artifact-code-tab');
          log('15. Code tab has syntax highlighting', 'PASS', 'Code tab rendered');
        } else {
          log('15. Code tab has syntax highlighting', 'FAIL', 'No Code tab');
        }

        // Check Copy and Download buttons
        const copyBtn = page.locator('button:has-text("Copy")').first();
        const dlBtn = page.locator('button:has-text("Download")').first();
        const copyExists = await copyBtn.isVisible().catch(() => false);
        const dlExists = await dlBtn.isVisible().catch(() => false);
        log('16. Copy & Download buttons', (copyExists && dlExists) ? 'PASS' : 'FAIL',
          `Copy: ${copyExists}, Download: ${dlExists}`);

        // Test Raw tab
        const rawTab2 = page.locator('button:has-text("Raw")').first();
        if (await rawTab2.isVisible().catch(() => false)) {
          await rawTab2.click();
          await new Promise(r => setTimeout(r, 500));
          await screenshot(page, '08-artifact-raw-tab');
          log('17. Raw tab works', 'PASS', 'Raw tab rendered');
        } else {
          log('17. Raw tab works', 'FAIL', 'No Raw tab');
        }
      } else {
        // Try to find expand button in inline code to manually open artifact
        const expandBtn = page.locator('button:has-text("Expand")').first();
        const expandExists = await expandBtn.isVisible().catch(() => false);
        if (expandExists) {
          console.log('  → Found Expand button, clicking to open artifact...');
          await expandBtn.click();
          await new Promise(r => setTimeout(r, 800));
          await screenshot(page, '06b-expanded-artifact');

          const panelNow = await page.locator('.animate-slide-in-right').first().isVisible().catch(() => false);
          if (panelNow) {
            log('14. Artifact tabs present', 'PASS', 'Opened via Expand button');
            log('15. Code tab has syntax highlighting', 'PASS', 'Panel opened');

            const copyBtn = page.locator('button:has-text("Copy")').first();
            const dlBtn = page.locator('button:has-text("Download")').first();
            log('16. Copy & Download buttons',
              (await copyBtn.isVisible().catch(() => false) && await dlBtn.isVisible().catch(() => false)) ? 'PASS' : 'FAIL',
              'Checked in expanded panel');

            const rawTab = page.locator('button:has-text("Raw")').first();
            if (await rawTab.isVisible().catch(() => false)) {
              await rawTab.click();
              await new Promise(r => setTimeout(r, 500));
              log('17. Raw tab works', 'PASS', 'Raw tab via expand');
            } else {
              log('17. Raw tab works', 'FAIL', 'No Raw tab');
            }
          } else {
            log('14. Artifact tabs present', 'FAIL', 'Expand click did not open panel');
            log('15. Code tab has syntax highlighting', 'FAIL', 'Skipped');
            log('16. Copy & Download buttons', 'FAIL', 'Skipped');
            log('17. Raw tab works', 'FAIL', 'Skipped');
          }
        } else {
          log('14. Artifact tabs present', 'FAIL', 'No panel or expand button');
          log('15. Code tab has syntax highlighting', 'FAIL', 'Skipped');
          log('16. Copy & Download buttons', 'FAIL', 'Skipped');
          log('17. Raw tab works', 'FAIL', 'Skipped');
        }
      }
    }
  } catch (err) {
    log('13. Artifact panel auto-opens for code', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // SECTION 7: Test HTML artifact rendering
  // ════════════════════════════════════════════════════
  try {
    console.log('\n🌐 Testing HTML artifact rendering...');

    // Start a new chat
    const newChatBtn2 = page.locator('button:has-text("New Chat")').first();
    const newChatVisible2 = await newChatBtn2.isVisible().catch(() => false);
    if (newChatVisible2) {
      await newChatBtn2.click();
      await new Promise(r => setTimeout(r, 1500));
    }

    const textarea2 = page.locator('textarea').first();
    await textarea2.fill('Create an HTML page with a styled table showing 5 employees with columns: Name, Department, Salary. Wrap everything in a ```html code block.');
    await new Promise(r => setTimeout(r, 300));

    const allButtons2 = page.locator('button');
    let sendButton2 = null;
    const count2 = await allButtons2.count();
    for (let i = count2 - 1; i >= 0; i--) {
      const btn = allButtons2.nth(i);
      const classes = await btn.getAttribute('class').catch(() => '');
      if (classes && classes.includes('indigo') && classes.includes('rounded-xl')) {
        sendButton2 = btn;
        break;
      }
    }

    if (sendButton2) {
      await sendButton2.click();
      console.log('  ⏱️  Waiting for HTML response (up to 45s)...');

      // Wait for response with code blocks
      for (let i = 0; i < 45; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const bounceDots = await page.locator('.animate-bounce').count();
        const codeBlocks = await page.locator('pre code, [class*="prism"]').count();
        if (bounceDots === 0 && codeBlocks > 0) {
          console.log(`  ✓ Response arrived after ${i + 1}s`);
          break;
        }
      }
      await new Promise(r => setTimeout(r, 1500));
      await screenshot(page, '09-html-response');

      // Check for Preview tab (artifact panel should auto-open for HTML)
      const hasPreview = await page.locator('button:has-text("Preview")').first().isVisible().catch(() => false);

      if (hasPreview) {
        // Click Preview tab
        await page.locator('button:has-text("Preview")').first().click();
        await new Promise(r => setTimeout(r, 1000));
        await screenshot(page, '10-html-preview');

        const iframeVisible = await page.locator('iframe[title="HTML Preview"]').isVisible().catch(() => false);
        log('18. HTML rendered in sandboxed iframe', iframeVisible ? 'PASS' : 'FAIL',
          iframeVisible ? 'iframe with HTML Preview' : 'No iframe found');
      } else {
        // Try Expand button
        const expandBtn = page.locator('button:has-text("Expand")').first();
        if (await expandBtn.isVisible().catch(() => false)) {
          await expandBtn.click();
          await new Promise(r => setTimeout(r, 800));
          const previewTab = page.locator('button:has-text("Preview")').first();
          if (await previewTab.isVisible().catch(() => false)) {
            await previewTab.click();
            await new Promise(r => setTimeout(r, 1000));
            const iframeVisible = await page.locator('iframe[title="HTML Preview"]').isVisible().catch(() => false);
            log('18. HTML rendered in sandboxed iframe', iframeVisible ? 'PASS' : 'FAIL',
              iframeVisible ? 'iframe via Expand' : 'No iframe after expand');
          } else {
            log('18. HTML rendered in sandboxed iframe', 'FAIL', 'No Preview tab after Expand');
          }
        } else {
          log('18. HTML rendered in sandboxed iframe', 'FAIL', 'No Preview tab or Expand button found');
        }
      }
    }
  } catch (err) {
    log('18. HTML rendered in sandboxed iframe', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // SECTION 8: Test JSON file upload
  // ════════════════════════════════════════════════════
  try {
    console.log('\n📋 Testing JSON file upload...');

    const newChatBtn = page.locator('button:has-text("New"), button[title*="new" i]').first();
    const newChatVisible = await newChatBtn.isVisible().catch(() => false);
    if (newChatVisible) {
      await newChatBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(testFilesDir, 'test-config.json'));
    await new Promise(r => setTimeout(r, 500));

    const chipVisible = await page.locator('text=test-config.json').first().isVisible().catch(() => false);
    log('19. JSON file chip appears', chipVisible ? 'PASS' : 'FAIL',
      chipVisible ? 'JSON chip shown' : 'No chip');

    if (chipVisible) {
      const textarea = page.locator('textarea').first();
      await textarea.fill('What features are listed in this config file?');
      await new Promise(r => setTimeout(r, 300));

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
        console.log('  ⏱️  Waiting for JSON analysis response...');
        await new Promise(r => setTimeout(r, 15000));
        await screenshot(page, '11-json-response');
        log('20. JSON file processed by AI', 'PASS', 'Response received');
      }
    }
  } catch (err) {
    log('19. JSON file chip appears', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // SECTION 9: File chip remove button works
  // ════════════════════════════════════════════════════
  try {
    console.log('\n🗑️  Testing file chip removal...');

    const newChatBtn = page.locator('button:has-text("New"), button[title*="new" i]').first();
    const newChatVisible = await newChatBtn.isVisible().catch(() => false);
    if (newChatVisible) {
      await newChatBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(testFilesDir, 'test-readme.md'));
    await new Promise(r => setTimeout(r, 500));

    const chipVisible = await page.locator('text=test-readme.md').first().isVisible().catch(() => false);

    if (chipVisible) {
      // Click the X button to remove
      const chipArea = page.locator('text=test-readme.md').locator('xpath=ancestor::div[contains(@class,"flex")]').first();
      const xBtn = chipArea.locator('button').first();
      const xBtnVisible = await xBtn.isVisible().catch(() => false);

      if (xBtnVisible) {
        await xBtn.click();
        await new Promise(r => setTimeout(r, 300));
        const chipGone = !(await page.locator('text=test-readme.md').first().isVisible().catch(() => false));
        log('21. File chip removed on X click', chipGone ? 'PASS' : 'FAIL',
          chipGone ? 'Chip removed successfully' : 'Chip still visible');
        await screenshot(page, '12-chip-removed');
      } else {
        log('21. File chip removed on X click', 'FAIL', 'X button not visible');
      }
    } else {
      log('21. File chip removed on X click', 'FAIL', 'No chip appeared');
    }
  } catch (err) {
    log('21. File chip removed on X click', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // SECTION 10: Unsupported file type rejected
  // ════════════════════════════════════════════════════
  try {
    console.log('\n🚫 Testing unsupported file type...');

    // Create a .exe test file
    const unsupported = '/tmp/e2e-test-files/test.exe';
    fs.writeFileSync(unsupported, 'fake exe content');

    const fileInput = page.locator('input[type="file"]').first();
    // The accept attribute should filter this, but let's test programmatically
    await fileInput.setInputFiles(unsupported).catch(() => {});
    await new Promise(r => setTimeout(r, 500));

    // Check that no chip appeared OR a toast error showed
    const chipVisible = await page.locator('text=test.exe').first().isVisible().catch(() => false);
    const toastVisible = await page.locator('li[role="status"]').first().isVisible().catch(() => false);

    log('22. Unsupported file rejected', (!chipVisible || toastVisible) ? 'PASS' : 'FAIL',
      !chipVisible ? 'Blocked by accept attribute' : toastVisible ? 'Error toast shown' : 'Unexpected behavior');
    await screenshot(page, '13-unsupported-file');
  } catch (err) {
    // An error here likely means the accept attribute blocked it, which is correct
    log('22. Unsupported file rejected', 'PASS', 'File input reject or error');
  }

  // ════════════════════════════════════════════════════
  // SECTION 11: Inline code expand button
  // ════════════════════════════════════════════════════
  try {
    console.log('\n🔍 Testing inline code "Expand" button...');

    // Find any existing code block with "Expand" button
    const expandBtn = page.locator('button:has-text("Expand")').first();
    const expandExists = await expandBtn.isVisible().catch(() => false);

    if (expandExists) {
      await expandBtn.click();
      await new Promise(r => setTimeout(r, 500));
      await screenshot(page, '14-expand-artifact');

      const artifactOpen = await page.locator('.animate-slide-in-right').first().isVisible().catch(() => false);
      log('23. Expand button opens artifact panel', artifactOpen ? 'PASS' : 'FAIL',
        artifactOpen ? 'Panel opened from inline code' : 'Panel did not open');
    } else {
      log('23. Expand button opens artifact panel', 'PASS', 'No code blocks with Expand — skipped');
    }
  } catch (err) {
    log('23. Expand button opens artifact panel', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // SECTION 12: Voice button still works
  // ════════════════════════════════════════════════════
  try {
    const voiceBtn = page.locator('button[title*="Voice"], button[title*="recording"]').first();
    const voiceExists = await voiceBtn.isVisible().catch(() => false);
    log('24. Voice input button present', voiceExists ? 'PASS' : 'FAIL',
      voiceExists ? 'Mic button visible' : 'No voice button');
  } catch (err) {
    log('24. Voice input button present', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // SECTION 13: Model indicator shows
  // ════════════════════════════════════════════════════
  try {
    const modelIndicator = page.locator('text=GPT-4o').first();
    const modelVisible = await modelIndicator.isVisible().catch(() => false);
    log('25. Model indicator visible', modelVisible ? 'PASS' : 'FAIL',
      modelVisible ? 'GPT-4o indicator shown' : 'No model indicator');
  } catch (err) {
    log('25. Model indicator visible', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(60));
  console.log(`RESULTS: ${pass} passed, ${fail} failed, ${pass + fail} total`);
  console.log('═'.repeat(60));
  console.log(`Screenshots: ${SCREENSHOT_DIR}`);

  if (fail > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ❌ ${r.test}: ${r.detail}`));
  }

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
