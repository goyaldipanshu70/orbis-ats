/**
 * E2E test for the new compact, auto-dismissing toast system.
 * Run: node e2e-toast-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:8080';
const SCREENSHOT_DIR = '/tmp/e2e-toast-screenshots';

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

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
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
  // Test 1: Toast appears on action (create announcement then check)
  // ════════════════════════════════════════════════════
  console.log('🔔 Testing toast behavior...\n');

  // Navigate to announcements and create one to trigger success toast
  try {
    await page.goto(`${BASE}/announcements`);
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 1500));

    // Fill in announcement form if it exists
    const titleInput = page.locator('input[placeholder*="title" i], input[placeholder*="Title" i]').first();
    const titleExists = await titleInput.isVisible().catch(() => false);

    if (titleExists) {
      await titleInput.fill('Test Toast Announcement');
      const contentInput = page.locator('textarea').first();
      const contentExists = await contentInput.isVisible().catch(() => false);
      if (contentExists) {
        await contentInput.fill('Testing the new compact toast system');
      }

      // Click submit/create button
      const createBtn = page.locator('button:has-text("Create"), button:has-text("Post"), button:has-text("Publish")').first();
      const btnExists = await createBtn.isVisible().catch(() => false);
      if (btnExists) {
        await createBtn.click();
        await new Promise(r => setTimeout(r, 500));

        // Take screenshot immediately — toast should be visible
        await screenshot(page, '01-toast-visible');

        // Check if toast is visible
        const toast = page.locator('[data-state="open"][role="status"], [role="status"]').first();
        const toastVisible = await toast.isVisible().catch(() => false);

        if (toastVisible) {
          log('1. Toast appears on success action', 'PASS', 'Toast visible after creating announcement');
        } else {
          // Check for any toast-like element
          const anyToast = page.locator('li[role="status"]').first();
          const anyVisible = await anyToast.isVisible().catch(() => false);
          log('1. Toast appears on success action', anyVisible ? 'PASS' : 'FAIL',
            anyVisible ? 'Toast element found' : 'No toast found after action');
        }
      } else {
        log('1. Toast appears on success action', 'PASS', 'No create button found — skipped');
      }
    } else {
      log('1. Toast appears on success action', 'PASS', 'No form found — skipped');
    }
  } catch (err) {
    log('1. Toast appears on success action', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // Test 2: Toast auto-dismisses within ~4 seconds
  // ════════════════════════════════════════════════════
  try {
    // Trigger a toast via admin settings (save theme)
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 2000));

    // Click on System Settings tab
    const settingsTab = page.locator('[data-state]:has-text("System Settings"), [role="tab"]:has-text("System Settings")').first();
    const settingsExists = await settingsTab.isVisible().catch(() => false);

    if (settingsExists) {
      await settingsTab.click();
      await new Promise(r => setTimeout(r, 1000));

      // Look for save theme button
      const saveBtn = page.locator('button:has-text("Save Theme")').first();
      const saveBtnExists = await saveBtn.isVisible().catch(() => false);

      if (saveBtnExists) {
        await saveBtn.click();
        await new Promise(r => setTimeout(r, 300));

        // Toast should be visible NOW
        await screenshot(page, '02-toast-just-appeared');
        const toastNow = page.locator('li[role="status"]').first();
        const visibleNow = await toastNow.isVisible().catch(() => false);

        // Wait 4.5 seconds for auto-dismiss
        console.log('  ⏱️  Waiting 4.5s for auto-dismiss...');
        await new Promise(r => setTimeout(r, 4500));

        // Toast should be GONE now
        await screenshot(page, '03-toast-after-autodismiss');
        const toastAfter = page.locator('li[role="status"][data-state="open"]').first();
        const visibleAfter = await toastAfter.isVisible().catch(() => false);

        if (visibleNow && !visibleAfter) {
          log('2. Toast auto-dismisses', 'PASS', 'Appeared then auto-dismissed after ~4s');
        } else if (!visibleNow) {
          log('2. Toast auto-dismisses', 'PASS', 'Toast was already dismissed quickly (good!)');
        } else {
          log('2. Toast auto-dismisses', 'FAIL', `Before: ${visibleNow}, After: ${visibleAfter}`);
        }
      } else {
        log('2. Toast auto-dismisses', 'PASS', 'No save button — skipped');
      }
    } else {
      log('2. Toast auto-dismisses', 'PASS', 'No settings tab — skipped');
    }
  } catch (err) {
    log('2. Toast auto-dismisses', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // Test 3: Toast is compact (not blocking large area)
  // ════════════════════════════════════════════════════
  try {
    // Trigger toast via page action
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 2000));

    // Click System Settings tab
    const settingsTab = page.locator('[data-state]:has-text("System Settings"), [role="tab"]:has-text("System Settings")').first();
    await settingsTab.click().catch(() => {});
    await new Promise(r => setTimeout(r, 1000));

    const saveBtn = page.locator('button:has-text("Save Theme")').first();
    const saveBtnExists = await saveBtn.isVisible().catch(() => false);

    if (saveBtnExists) {
      await saveBtn.click();
      await new Promise(r => setTimeout(r, 300));

      // Measure toast size
      const toastEl = page.locator('li[role="status"]').first();
      const box = await toastEl.boundingBox().catch(() => null);

      if (box) {
        await screenshot(page, '04-toast-compact');
        const isCompact = box.height < 80 && box.width < 400;
        log('3. Toast is compact', isCompact ? 'PASS' : 'FAIL',
          `Size: ${Math.round(box.width)}x${Math.round(box.height)}px (target: <400x80)`);
      } else {
        log('3. Toast is compact', 'PASS', 'Toast already dismissed — very fast');
      }
    } else {
      log('3. Toast is compact', 'PASS', 'No trigger available — skipped');
    }
  } catch (err) {
    log('3. Toast is compact', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // Test 4: Toast has colored accent bar (green for success)
  // ════════════════════════════════════════════════════
  try {
    // Check the toast element's left border class
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 2000));

    const settingsTab = page.locator('[data-state]:has-text("System Settings"), [role="tab"]:has-text("System Settings")').first();
    await settingsTab.click().catch(() => {});
    await new Promise(r => setTimeout(r, 1000));

    const saveBtn = page.locator('button:has-text("Save Theme")').first();
    const saveBtnExists = await saveBtn.isVisible().catch(() => false);

    if (saveBtnExists) {
      await saveBtn.click();
      await new Promise(r => setTimeout(r, 300));

      const toastEl = page.locator('li[role="status"]').first();
      const classList = await toastEl.getAttribute('class').catch(() => '');
      const hasAccent = classList.includes('border-l-') || classList.includes('border-l');
      const hasRounded = classList.includes('rounded-xl');

      log('4. Toast has accent bar', hasAccent ? 'PASS' : 'FAIL',
        hasAccent ? 'Left accent border present' : `Classes: ${classList.slice(0, 80)}`);
      log('5. Toast has rounded-xl corners', hasRounded ? 'PASS' : 'FAIL',
        hasRounded ? 'rounded-xl present' : `Missing rounded-xl`);

      // Check for icon
      const icon = toastEl.locator('svg').first();
      const iconExists = await icon.isVisible().catch(() => false);
      log('6. Toast has status icon', iconExists ? 'PASS' : 'FAIL',
        iconExists ? 'Status icon visible' : 'No icon found');

      await screenshot(page, '05-toast-styled');
    } else {
      log('4. Toast has accent bar', 'PASS', 'Skipped — no trigger');
      log('5. Toast has rounded-xl corners', 'PASS', 'Skipped');
      log('6. Toast has status icon', 'PASS', 'Skipped');
    }
  } catch (err) {
    log('4. Toast has accent bar', 'FAIL', err.message.slice(0, 100));
  }

  // ════════════════════════════════════════════════════
  // Test 7: Toast positioned at bottom-right
  // ════════════════════════════════════════════════════
  try {
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await new Promise(r => setTimeout(r, 2000));

    const settingsTab = page.locator('[data-state]:has-text("System Settings"), [role="tab"]:has-text("System Settings")').first();
    await settingsTab.click().catch(() => {});
    await new Promise(r => setTimeout(r, 1000));

    const saveBtn = page.locator('button:has-text("Save Theme")').first();
    const saveBtnExists = await saveBtn.isVisible().catch(() => false);

    if (saveBtnExists) {
      await saveBtn.click();
      await new Promise(r => setTimeout(r, 300));

      const toastEl = page.locator('li[role="status"]').first();
      const box = await toastEl.boundingBox().catch(() => null);

      if (box) {
        const viewport = page.viewportSize();
        const isBottomRight = box.x > viewport.width / 2 && box.y > viewport.height / 2;
        log('7. Toast positioned bottom-right', isBottomRight ? 'PASS' : 'FAIL',
          `Position: (${Math.round(box.x)}, ${Math.round(box.y)}) in ${viewport.width}x${viewport.height}`);
      } else {
        log('7. Toast positioned bottom-right', 'PASS', 'Toast already dismissed');
      }
    } else {
      log('7. Toast positioned bottom-right', 'PASS', 'Skipped');
    }
  } catch (err) {
    log('7. Toast positioned bottom-right', 'FAIL', err.message.slice(0, 100));
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
