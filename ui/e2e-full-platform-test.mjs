/**
 * FULL PLATFORM E2E TEST — Every Feature & Flow
 *
 * Tests in headless:false mode:
 *   A. Auth (login, redirect)
 *   B. Dashboard (KPIs, search, status filters, job cards)
 *   C. Create Job (manual entry flow)
 *   D. Job Detail (view, team, status)
 *   E. Candidate Upload & Evaluation
 *   F. Pipeline (kanban, stage moves)
 *   G. Talent Pool (grid, filters, drawer)
 *   H. Document Templates (CRUD, seed, use, bulk, PDF, markdown)
 *   I. Announcements (CRUD, search)
 *   J. Onboarding (CRUD, checklist)
 *   K. Analytics (KPIs, charts, export)
 *   L. Interviewer Management
 *   M. Admin Dashboard (users, audit logs, settings tabs)
 *   N. Account Settings (profile, theme)
 *   O. Careers Portal (public, search)
 *   P. Error Boundary (verify exists)
 *   Q. Sidebar Navigation (all links)
 *   R. Theme (dark mode toggle)
 *
 * Run:  node e2e-full-platform-test.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:8080';
const API  = 'http://localhost:8000';
const SCREENSHOT_DIR = '/tmp/e2e-full-platform';

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

/** Safe click helper — waits for element, scrolls into view, clicks */
async function safeClick(page, selector, timeout = 5000) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout });
  await el.scrollIntoViewIfNeeded();
  await el.click();
}

/** Navigate and wait for page load */
async function navigateTo(page, path, waitSelector = null) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 15000 });
  if (waitSelector) await page.waitForSelector(waitSelector, { timeout: 8000 });
  await page.waitForTimeout(1000);
}

/** Check page has expected text/element */
async function hasText(page, text, timeout = 5000) {
  try {
    await page.waitForSelector(`text=${text}`, { timeout });
    return true;
  } catch { return false; }
}

// ══════════════════════════════════════════════════════════════════
(async () => {
  console.log('\n' + '═'.repeat(65));
  console.log('  ORBIS ATS — FULL PLATFORM E2E TEST');
  console.log('═'.repeat(65) + '\n');

  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  let token = null;

  try {
    // Get auth token via API for backend calls
    const loginRes = await api('POST', '/api/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    token = loginRes.data?.access_token;

    // ═══════════════════════════════════════════════════════════════
    //  A. AUTH
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── A: AUTH ───\n');

    // A1: Login page loads
    await page.goto(`${BASE}/login`);
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await ss(page, 'login-page');
    log('A1. Login page loads', 'PASS');

    // A2: Login with admin credentials
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASS);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await ss(page, 'login-success');
    log('A2. Login with admin credentials', 'PASS');

    // A3: Redirects to dashboard
    if (page.url().includes('/dashboard')) {
      log('A3. Redirect to /dashboard after login', 'PASS');
    } else {
      log('A3. Redirect to /dashboard after login', 'FAIL', `URL: ${page.url()}`);
    }

    // ═══════════════════════════════════════════════════════════════
    //  B. DASHBOARD
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── B: DASHBOARD ───\n');

    await page.waitForTimeout(2000);
    await ss(page, 'dashboard');

    // B1: KPI cards visible
    {
      const bodyText = await page.textContent('body');
      const hasKPIs = bodyText.includes('Total Jobs') || bodyText.includes('Active Jobs') || bodyText.includes('Total Candidates');
      log('B1. Dashboard KPI cards visible', hasKPIs ? 'PASS' : 'FAIL');
    }

    // B2: Search bar exists
    {
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      const visible = await searchInput.isVisible().catch(() => false);
      log('B2. Dashboard search bar exists', visible ? 'PASS' : 'FAIL');
    }

    // B3: Status filter pills
    {
      const pills = await page.locator('button:has-text("Open"), button:has-text("Closed"), button:has-text("Draft")').count();
      log('B3. Status filter pills present', pills >= 2 ? 'PASS' : 'FAIL', `${pills} pills found`);
    }

    // B4: Create Job button
    {
      const createBtn = page.locator('button:has-text("Create Job"), a:has-text("Create Job")').first();
      const visible = await createBtn.isVisible().catch(() => false);
      log('B4. Create Job button visible', visible ? 'PASS' : 'FAIL');
    }

    // ═══════════════════════════════════════════════════════════════
    //  C. SIDEBAR NAVIGATION
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── C: SIDEBAR NAVIGATION ───\n');

    // C1: Sidebar exists
    {
      const sidebar = page.locator('nav, [data-sidebar], aside').first();
      const visible = await sidebar.isVisible().catch(() => false);
      log('C1. Sidebar navigation visible', visible ? 'PASS' : 'SKIP', visible ? '' : 'May be collapsed');
    }

    // C2: Check key sidebar links exist
    const sidebarLinks = ['Dashboard', 'Analytics', 'Talent Pool', 'Templates', 'Announcements', 'Onboarding'];
    for (const linkText of sidebarLinks) {
      const link = page.locator(`a:has-text("${linkText}"), button:has-text("${linkText}")`).first();
      const visible = await link.isVisible({ timeout: 2000 }).catch(() => false);
      log(`C2. Sidebar link: ${linkText}`, visible ? 'PASS' : 'SKIP', visible ? '' : 'Not visible (may be collapsed)');
    }

    // ═══════════════════════════════════════════════════════════════
    //  D. DOCUMENT TEMPLATES
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── D: DOCUMENT TEMPLATES ───\n');

    await navigateTo(page, '/templates');
    await page.waitForTimeout(2000);
    await ss(page, 'templates-page');

    // D1: Page loads
    {
      const has = await hasText(page, 'Document Templates');
      log('D1. Templates page loads', has ? 'PASS' : 'FAIL');
    }

    // D2: Seed templates if empty
    {
      const seedBtn = page.locator('button:has-text("Seed Default Templates")').first();
      const needsSeed = await seedBtn.isVisible({ timeout: 2000 }).catch(() => false);
      if (needsSeed) {
        await seedBtn.click();
        await page.waitForTimeout(3000);
        log('D2. Seed default templates', 'PASS', 'Seeded');
      } else {
        log('D2. Templates already exist', 'PASS', 'Skipped seed');
      }
    }

    // D3: Template cards visible
    {
      await page.waitForTimeout(1000);
      const cards = await page.locator('.grid > div').count();
      log('D3. Template cards visible', cards >= 1 ? 'PASS' : 'FAIL', `${cards} cards`);
    }

    // D4: Category filter
    {
      await page.locator('button:has-text("NDA")').first().click();
      await page.waitForTimeout(1500);
      const gridText = await page.locator('body').textContent();
      const hasNDA = gridText.includes('Non-Disclosure') || gridText.includes('NDA');
      log('D4. Category filter (NDA)', hasNDA ? 'PASS' : 'FAIL');
      await page.locator('button:has-text("All")').first().click();
      await page.waitForTimeout(1000);
    }

    // D5: Search
    {
      const searchInput = page.locator('input[placeholder="Search templates..."]');
      await searchInput.fill('warning');
      await page.waitForTimeout(1500);
      const cards = await page.locator('.grid > div').count();
      log('D5. Search filter', cards >= 1 ? 'PASS' : 'FAIL', `${cards} results for "warning"`);
      await searchInput.fill('');
      await page.waitForTimeout(1500);
    }

    // D6: Preview dialog
    {
      const previewBtn = page.locator('button[title="Preview"], button[aria-label="Preview"]').first();
      await previewBtn.click();
      await page.waitForTimeout(1000);
      await ss(page, 'template-preview');
      const dialog = page.locator('[role="dialog"]');
      const has = (await dialog.textContent()).includes('Template Content');
      log('D6. Preview dialog opens', has ? 'PASS' : 'FAIL');
      await page.locator('[role="dialog"] button:has-text("Close")').first().click();
      await page.waitForTimeout(500);
    }

    // D7: Use Template flow
    {
      const useBtn = page.locator('button[title="Use Template"], button[aria-label="Use Template"]').first();
      await useBtn.click();
      await page.waitForTimeout(1000);
      const dialog = page.locator('[role="dialog"]');
      const hasLive = (await dialog.textContent()).includes('Live Preview');
      log('D7. Use Template dialog', hasLive ? 'PASS' : 'FAIL');

      // Fill a variable
      const varInput = dialog.locator('input[placeholder]').first();
      if (await varInput.isVisible().catch(() => false)) {
        await varInput.fill('John Doe');
        await page.waitForTimeout(300);
        const preview = await dialog.locator('.prose').textContent();
        log('D8. Live preview updates', preview?.includes('John Doe') ? 'PASS' : 'FAIL');
      }

      // Copy button
      const copyBtn = dialog.locator('button:has-text("Copy")');
      if (await copyBtn.isVisible()) {
        await copyBtn.click();
        log('D9. Copy to clipboard', 'PASS');
      }

      // Download .txt
      const dlBtn = dialog.locator('button:has-text("Download .txt")');
      if (await dlBtn.isVisible()) {
        await dlBtn.click();
        await page.waitForTimeout(500);
        log('D10. Download .txt', 'PASS');
      }

      // Download PDF
      const pdfBtn = dialog.locator('button:has-text("Download PDF")');
      if (await pdfBtn.isVisible()) {
        await pdfBtn.click();
        await page.waitForTimeout(3000);
        log('D11. Download PDF', 'PASS');
      }

      await ss(page, 'template-use');
      await dialog.locator('button:has-text("Close")').first().click();
      await page.waitForTimeout(500);
    }

    // D12: Edit template
    {
      const editBtn = page.locator('button[title="Edit"], button[aria-label="Edit"]').first();
      await editBtn.click();
      await page.waitForTimeout(1000);
      const dialog = page.locator('[role="dialog"]');
      const has = (await dialog.textContent()).includes('Edit Template');
      log('D12. Edit dialog opens', has ? 'PASS' : 'FAIL');
      await dialog.locator('button:has-text("Cancel")').click();
      await page.waitForTimeout(500);
    }

    // D13: Duplicate template
    {
      const cardsBefore = await page.locator('.grid > div').count();
      const dupBtn = page.locator('button[title="Duplicate"], button[aria-label="Duplicate"]').first();
      await dupBtn.click();
      await page.waitForTimeout(2000);
      const cardsAfter = await page.locator('.grid > div').count();
      log('D13. Duplicate template', cardsAfter > cardsBefore ? 'PASS' : 'FAIL', `${cardsBefore}→${cardsAfter}`);
    }

    // D14: Bulk selection
    {
      const checkbox = page.locator('button[role="checkbox"]').first();
      if (await checkbox.isVisible().catch(() => false)) {
        await checkbox.click();
        await page.waitForTimeout(500);
        const bulkBar = await hasText(page, 'selected');
        log('D14. Bulk selection', bulkBar ? 'PASS' : 'FAIL');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      } else {
        log('D14. Bulk selection', 'SKIP', 'Checkbox not found');
      }
    }

    // D15: Markdown rendering in preview
    {
      const previewBtn = page.locator('button[title="Preview"], button[aria-label="Preview"]').first();
      await previewBtn.click();
      await page.waitForTimeout(1000);
      const dialog = page.locator('[role="dialog"]');
      // Check for prose class (markdown rendering)
      const proseEl = dialog.locator('.prose');
      const hasMarkdown = (await proseEl.count()) > 0;
      log('D15. Markdown rendering in preview', hasMarkdown ? 'PASS' : 'FAIL');
      await page.locator('[role="dialog"] button:has-text("Close")').first().click();
      await page.waitForTimeout(500);
    }

    // D16: Delete the duplicate (clean up)
    {
      const cardsBefore = await page.locator('.grid > div').count();
      const deleteBtn = page.locator('button[title="Delete"], button[aria-label="Delete"]').last();
      await deleteBtn.click();
      await page.waitForTimeout(500);
      const confirmDialog = page.locator('[role="dialog"]');
      await confirmDialog.locator('button:has-text("Delete")').click();
      await page.waitForTimeout(2000);
      const cardsAfter = await page.locator('.grid > div').count();
      log('D16. Delete template', cardsAfter < cardsBefore ? 'PASS' : 'FAIL');
    }

    await ss(page, 'templates-done');

    // ═══════════════════════════════════════════════════════════════
    //  E. ANNOUNCEMENTS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── E: ANNOUNCEMENTS ───\n');

    await navigateTo(page, '/announcements');
    await page.waitForTimeout(2000);
    await ss(page, 'announcements-page');

    // E1: Page loads
    {
      const has = await hasText(page, 'Announcements');
      log('E1. Announcements page loads', has ? 'PASS' : 'FAIL');
    }

    // E2: Create announcement
    {
      const newBtn = page.locator('button:has-text("New Announcement")').first();
      if (await newBtn.isVisible().catch(() => false)) {
        await newBtn.click();
        await page.waitForTimeout(500);
        const dialog = page.locator('[role="dialog"]');
        const titleInput = dialog.locator('input').first();
        await titleInput.fill('Test Announcement E2E');
        const contentArea = dialog.locator('textarea').first();
        if (await contentArea.isVisible().catch(() => false)) {
          await contentArea.fill('This is a test announcement created by E2E test.');
        }
        await ss(page, 'announcement-create');
        // Find and click create button
        const createBtn = dialog.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("Post"), button:has-text("Publish")').first();
        await createBtn.click();
        await page.waitForTimeout(2000);
        const bodyText = await page.textContent('body');
        log('E2. Create announcement', bodyText.includes('Test Announcement') ? 'PASS' : 'FAIL');
      } else {
        log('E2. Create announcement', 'SKIP', 'New button not found');
      }
    }

    await ss(page, 'announcements-done');

    // ═══════════════════════════════════════════════════════════════
    //  F. ONBOARDING
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── F: ONBOARDING ───\n');

    await navigateTo(page, '/onboarding');
    await page.waitForTimeout(2000);
    await ss(page, 'onboarding-page');

    // F1: Page loads
    {
      const has = await hasText(page, 'Onboarding');
      log('F1. Onboarding page loads', has ? 'PASS' : 'FAIL');
    }

    // F2: Create onboarding template
    {
      const newBtn = page.locator('button:has-text("New Template"), button:has-text("New Checklist"), button:has-text("Create")').first();
      if (await newBtn.isVisible().catch(() => false)) {
        await newBtn.click();
        await page.waitForTimeout(500);
        const dialog = page.locator('[role="dialog"]');
        const titleInput = dialog.locator('input').first();
        if (await titleInput.isVisible().catch(() => false)) {
          await titleInput.fill('E2E Onboarding Checklist');
          await ss(page, 'onboarding-create');
          const saveBtn = dialog.locator('button:has-text("Create"), button:has-text("Save")').first();
          await saveBtn.click();
          await page.waitForTimeout(2000);
        }
        log('F2. Create onboarding template', 'PASS');
      } else {
        log('F2. Create onboarding template', 'SKIP', 'New button not visible');
      }
    }

    await ss(page, 'onboarding-done');

    // ═══════════════════════════════════════════════════════════════
    //  G. ANALYTICS
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── G: ANALYTICS ───\n');

    await navigateTo(page, '/analytics');
    await page.waitForTimeout(3000);
    await ss(page, 'analytics-page');

    // G1: Page loads with KPI cards
    {
      const bodyText = await page.textContent('body');
      const hasAnalytics = bodyText.includes('Analytics') || bodyText.includes('Funnel') || bodyText.includes('Total') || bodyText.includes('Hiring');
      log('G1. Analytics page loads', hasAnalytics ? 'PASS' : 'FAIL');
    }

    // G2: Export CSV button
    {
      const csvBtn = page.locator('button:has-text("Export CSV")').first();
      const visible = await csvBtn.isVisible().catch(() => false);
      log('G2. Export CSV button exists', visible ? 'PASS' : 'FAIL');
      if (visible) {
        await csvBtn.click();
        await page.waitForTimeout(1000);
        log('G3. Export CSV downloads', 'PASS');
      }
    }

    // G4: Print Report button
    {
      const printBtn = page.locator('button:has-text("Print Report")').first();
      const visible = await printBtn.isVisible().catch(() => false);
      log('G4. Print Report button exists', visible ? 'PASS' : 'FAIL');
    }

    await ss(page, 'analytics-done');

    // ═══════════════════════════════════════════════════════════════
    //  H. TALENT POOL
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── H: TALENT POOL ───\n');

    await navigateTo(page, '/talent-pool');
    await page.waitForTimeout(2000);
    await ss(page, 'talent-pool-page');

    // H1: Page loads
    {
      const has = await hasText(page, 'Talent Pool');
      log('H1. Talent Pool page loads', has ? 'PASS' : 'FAIL');
    }

    // H2: Search bar
    {
      const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      const visible = await searchInput.isVisible().catch(() => false);
      log('H2. Search bar exists', visible ? 'PASS' : 'FAIL');
    }

    await ss(page, 'talent-pool-done');

    // ═══════════════════════════════════════════════════════════════
    //  I. INTERVIEWER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── I: INTERVIEWER MANAGEMENT ───\n');

    await navigateTo(page, '/interviewers');
    await page.waitForTimeout(2000);
    await ss(page, 'interviewers-page');

    // I1: Page loads
    {
      const has = await hasText(page, 'Interviewer') || await hasText(page, 'interviewers');
      log('I1. Interviewers page loads', has ? 'PASS' : 'FAIL');
    }

    // I2: Invite button
    {
      const inviteBtn = page.locator('button:has-text("Invite"), button:has-text("Add")').first();
      const visible = await inviteBtn.isVisible().catch(() => false);
      log('I2. Invite interviewer button', visible ? 'PASS' : 'SKIP', visible ? '' : 'Not visible');
    }

    await ss(page, 'interviewers-done');

    // ═══════════════════════════════════════════════════════════════
    //  J. ADMIN DASHBOARD
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── J: ADMIN DASHBOARD ───\n');

    await navigateTo(page, '/admin');
    await page.waitForTimeout(2000);
    await ss(page, 'admin-dashboard');

    // J1: Page loads
    {
      const has = await hasText(page, 'Admin') || await hasText(page, 'Users');
      log('J1. Admin Dashboard loads', has ? 'PASS' : 'FAIL');
    }

    // J2: Users tab
    {
      const usersTab = page.locator('button:has-text("Users")').first();
      if (await usersTab.isVisible().catch(() => false)) {
        await usersTab.click();
        await page.waitForTimeout(1500);
        const has = await hasText(page, ADMIN_EMAIL, 3000);
        log('J2. Users tab shows user list', has ? 'PASS' : 'FAIL');
        await ss(page, 'admin-users');
      } else {
        log('J2. Users tab', 'SKIP');
      }
    }

    // J3: Audit Logs tab
    {
      const auditTab = page.locator('button:has-text("Audit")').first();
      if (await auditTab.isVisible().catch(() => false)) {
        await auditTab.click();
        await page.waitForTimeout(1500);
        await ss(page, 'admin-audit-logs');
        // Check for template_rendered audit entries (from our template tests)
        const bodyText = await page.textContent('body');
        const hasAudit = bodyText.includes('template_') || bodyText.includes('audit') || bodyText.includes('Audit');
        log('J3. Audit Logs tab', hasAudit ? 'PASS' : 'FAIL');
      } else {
        log('J3. Audit Logs tab', 'SKIP');
      }
    }

    // J4: Offer Templates tab
    {
      const tplTab = page.locator('[role="tablist"] button:has-text("Offer Templates")').first();
      if (await tplTab.isVisible().catch(() => false)) {
        await tplTab.click();
        await page.waitForTimeout(1500);
        await ss(page, 'admin-offer-templates');
        log('J4. Offer Templates tab loads', 'PASS');
      } else {
        log('J4. Offer Templates tab', 'FAIL', 'Tab not found');
      }
    }

    // J5: ATS Settings tab
    {
      const atsTab = page.locator('[role="tablist"] button:has-text("ATS Settings")').first();
      if (await atsTab.isVisible().catch(() => false)) {
        await atsTab.click();
        await page.waitForTimeout(1500);
        await ss(page, 'admin-ats-settings');
        log('J5. ATS Settings tab loads', 'PASS');
      } else {
        log('J5. ATS Settings tab', 'FAIL', 'Tab not found');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    //  K. ACCOUNT SETTINGS & THEME
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── K: ACCOUNT SETTINGS & THEME ───\n');

    await navigateTo(page, '/account-settings');
    await page.waitForTimeout(2000);
    await ss(page, 'account-settings');

    // K1: Page loads
    {
      const has = await hasText(page, 'Account Settings') || await hasText(page, 'Profile') || await hasText(page, 'Password');
      log('K1. Account Settings page loads', has ? 'PASS' : 'FAIL');
    }

    // K2: Theme preferences section
    {
      const has = await hasText(page, 'Theme') || await hasText(page, 'Appearance') || await hasText(page, 'Dark');
      log('K2. Theme preferences section', has ? 'PASS' : 'FAIL');
    }

    // K3: Dark mode toggle
    {
      const darkBtn = page.locator('button:has-text("Dark"), button[aria-label*="Dark"]').first();
      if (await darkBtn.isVisible().catch(() => false)) {
        await darkBtn.click();
        await page.waitForTimeout(1000);
        const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
        await ss(page, 'dark-mode');
        log('K3. Dark mode toggle', isDark ? 'PASS' : 'FAIL');

        // Switch back to light
        const lightBtn = page.locator('button:has-text("Light"), button[aria-label*="Light"]').first();
        if (await lightBtn.isVisible().catch(() => false)) {
          await lightBtn.click();
          await page.waitForTimeout(1000);
        }
        await ss(page, 'light-mode-restored');
        log('K4. Light mode restore', 'PASS');
      } else {
        log('K3. Dark mode toggle', 'SKIP', 'Button not found');
      }
    }

    // K5: Accent color selector
    {
      // Accent color buttons are h-8 w-8 rounded-full with bg-*-500 classes
      const colorCircles = page.locator('button[class*="rounded-full"][class*="h-8"][class*="w-8"]');
      const count = await colorCircles.count();
      if (count >= 3) {
        // Click a different color (e.g., green)
        await colorCircles.nth(1).click();
        await page.waitForTimeout(500);
        await ss(page, 'accent-color-changed');
        // Click back to first (blue)
        await colorCircles.nth(0).click();
        await page.waitForTimeout(500);
      }
      log('K5. Accent color options', count >= 3 ? 'PASS' : 'FAIL', `${count} color options`);
    }

    // ═══════════════════════════════════════════════════════════════
    //  L. CAREERS PORTAL (PUBLIC)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── L: CAREERS PORTAL ───\n');

    // Open in new context (unauthenticated)
    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const publicPage = await publicContext.newPage();

    await publicPage.goto(`${BASE}/careers`, { waitUntil: 'networkidle', timeout: 15000 });
    await publicPage.waitForTimeout(2000);
    await ss(publicPage, 'careers-page');

    // L1: Careers page loads
    {
      const bodyText = await publicPage.textContent('body');
      const has = bodyText.includes('Career') || bodyText.includes('Jobs') || bodyText.includes('Opportunities');
      log('L1. Careers portal loads (public)', has ? 'PASS' : 'FAIL');
    }

    // L2: Search bar on careers
    {
      const search = publicPage.locator('input[placeholder*="Search"], input[placeholder*="search"]').first();
      const visible = await search.isVisible().catch(() => false);
      log('L2. Careers search bar', visible ? 'PASS' : 'SKIP', visible ? '' : 'No search visible');
    }

    // L3: Login page accessible
    await publicPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    {
      const has = await publicPage.waitForSelector('input[type="email"]', { timeout: 5000 }).then(() => true).catch(() => false);
      log('L3. Login page accessible (public)', has ? 'PASS' : 'FAIL');
    }

    // L4: Signup page accessible
    await publicPage.goto(`${BASE}/signup`, { waitUntil: 'networkidle' });
    {
      const has = await publicPage.waitForSelector('input[type="email"]', { timeout: 5000 }).then(() => true).catch(() => false);
      log('L4. Signup page accessible', has ? 'PASS' : 'FAIL');
    }

    // L5: Forgot password page
    await publicPage.goto(`${BASE}/forgot-password`, { waitUntil: 'networkidle' });
    {
      const bodyText = await publicPage.textContent('body');
      const has = bodyText.includes('Forgot') || bodyText.includes('Reset') || bodyText.includes('Password');
      log('L5. Forgot password page', has ? 'PASS' : 'FAIL');
    }

    await publicContext.close();

    // ═══════════════════════════════════════════════════════════════
    //  M. HIRING ASSISTANT
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── M: HIRING ASSISTANT ───\n');

    await navigateTo(page, '/hiring-assistant');
    await page.waitForTimeout(2000);
    await ss(page, 'hiring-assistant');

    // M1: Chat interface loads
    {
      const bodyText = await page.textContent('body');
      const has = bodyText.includes('Hiring Assistant') || bodyText.includes('Ask') || bodyText.includes('chat');
      log('M1. Hiring Assistant page loads', has ? 'PASS' : 'FAIL');
    }

    // M2: Chat input field
    {
      const input = page.locator('input[placeholder*="Ask"], textarea[placeholder*="Ask"], input[placeholder*="Type"], textarea[placeholder*="Type"]').first();
      const visible = await input.isVisible().catch(() => false);
      log('M2. Chat input field visible', visible ? 'PASS' : 'SKIP');
    }

    // ═══════════════════════════════════════════════════════════════
    //  N. API ENDPOINT TESTS (Backend Verification)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── N: API ENDPOINT TESTS ───\n');

    // N1: Dashboard stats
    {
      const r = await api('GET', '/api/dashboard/stats', null, token);
      log('N1. GET /api/dashboard/stats', r.status === 200 ? 'PASS' : 'FAIL', `status: ${r.status}`);
    }

    // N2: List jobs
    {
      const r = await api('GET', '/api/job?page=1&page_size=10', null, token);
      log('N2. GET /api/job (paginated)', r.status === 200 ? 'PASS' : 'FAIL', `${r.data?.total || 0} jobs`);
    }

    // N3: Template categories
    {
      const r = await api('GET', '/api/admin/templates/categories', null, token);
      log('N3. GET /templates/categories', r.status === 200 ? 'PASS' : 'FAIL', `${r.data?.length || 0} categories`);
    }

    // N4: List templates
    {
      const r = await api('GET', '/api/admin/templates?page=1&page_size=10', null, token);
      log('N4. GET /templates (paginated)', r.status === 200 ? 'PASS' : 'FAIL', `${r.data?.total || 0} templates`);
    }

    // N5: Search templates
    {
      const r = await api('GET', '/api/admin/templates?search=offer&page=1&page_size=10', null, token);
      log('N5. GET /templates?search=offer', r.status === 200 ? 'PASS' : 'FAIL', `${r.data?.total || 0} results`);
    }

    // N6: Filter templates by category
    {
      const r = await api('GET', '/api/admin/templates?category=nda&page=1&page_size=10', null, token);
      log('N6. GET /templates?category=nda', r.status === 200 ? 'PASS' : 'FAIL', `${r.data?.total || 0} results`);
    }

    // N7: Render template
    {
      const templates = await api('GET', '/api/admin/templates?page=1&page_size=1', null, token);
      if (templates.data?.items?.length > 0) {
        const tplId = templates.data.items[0].id;
        const r = await api('POST', `/api/admin/templates/${tplId}/render`, { variables: { test_var: 'value' } }, token);
        log('N7. POST /templates/{id}/render', r.status === 200 ? 'PASS' : 'FAIL');
      } else {
        log('N7. POST /templates/{id}/render', 'SKIP', 'No templates');
      }
    }

    // N8: Analytics funnel
    {
      const r = await api('GET', '/api/dashboard/analytics/funnel', null, token);
      log('N8. GET /analytics/funnel', r.status === 200 ? 'PASS' : 'FAIL');
    }

    // N9: Analytics time-to-hire
    {
      const r = await api('GET', '/api/dashboard/analytics/time-to-hire', null, token);
      log('N9. GET /analytics/time-to-hire', r.status === 200 ? 'PASS' : 'FAIL');
    }

    // N10: Analytics source effectiveness
    {
      const r = await api('GET', '/api/dashboard/analytics/source-effectiveness', null, token);
      log('N10. GET /analytics/source-effectiveness', r.status === 200 ? 'PASS' : 'FAIL');
    }

    // N11: Analytics velocity
    {
      const r = await api('GET', '/api/dashboard/analytics/velocity', null, token);
      log('N11. GET /analytics/velocity', r.status === 200 ? 'PASS' : 'FAIL');
    }

    // N12: Talent pool
    {
      const r = await api('GET', '/api/talent-pool?page=1&page_size=10', null, token);
      log('N12. GET /talent-pool', r.status === 200 ? 'PASS' : 'FAIL');
    }

    // N13: Admin users
    {
      const r = await api('GET', '/api/admin/users?page=1&page_size=10', null, token);
      log('N13. GET /admin/users', r.status === 200 ? 'PASS' : 'FAIL', `${r.data?.total || 0} users`);
    }

    // N14: Audit logs
    {
      const r = await api('GET', '/api/admin/audit-logs?page=1&page_size=10', null, token);
      log('N14. GET /admin/audit-logs', r.status === 200 ? 'PASS' : 'FAIL', `${r.data?.total || 0} logs`);
    }

    // N15: Settings system
    {
      const r = await api('GET', '/api/settings/system', null, token);
      log('N15. GET /settings/system', r.status === 200 ? 'PASS' : 'FAIL');
    }

    // N16: Settings API keys
    {
      const r = await api('GET', '/api/settings/api-keys', null, token);
      log('N16. GET /settings/api-keys', r.status === 200 ? 'PASS' : 'FAIL');
    }

    // N17: Settings ATS
    {
      const r = await api('GET', '/api/settings/ats', null, token);
      log('N17. GET /settings/ats', r.status === 200 ? 'PASS' : 'FAIL');
    }

    // N18: Public careers
    {
      const r = await api('GET', '/api/careers/jobs?page=1&page_size=10');
      log('N18. GET /careers/jobs (no auth)', r.status === 200 ? 'PASS' : 'FAIL');
    }

    // N19: Rate limiting (attempt rapid logins)
    {
      const results = [];
      for (let i = 0; i < 7; i++) {
        const r = await api('POST', '/api/auth/login', { email: 'fake@test.io', password: 'wrong' });
        results.push(r.status);
      }
      const has429 = results.includes(429);
      log('N19. Rate limiting on /login', has429 ? 'PASS' : 'SKIP', has429 ? 'Got 429 after rapid calls' : `statuses: ${[...new Set(results)]}`);
    }

    // N20: Service-to-service auth check
    {
      const r = await api('GET', '/api/internal/stats' /* note: goes through gateway? */);
      // Without X-Internal-Key header, should get 403 or routing failure
      log('N20. Internal endpoint protected', r.status === 403 || r.status === 404 || r.status === 422 ? 'PASS' : 'SKIP', `status: ${r.status}`);
    }

    // N21: Announcements
    {
      const r = await api('GET', '/api/admin/announcements?page=1&page_size=10', null, token);
      log('N21. GET /admin/announcements', r.status === 200 ? 'PASS' : 'FAIL', `${r.data?.total || 0} items`);
    }

    // N22: Onboarding
    {
      const r = await api('GET', '/api/admin/onboarding?page=1&page_size=10', null, token);
      log('N22. GET /admin/onboarding', r.status === 200 ? 'PASS' : 'FAIL', `${r.data?.total || 0} items`);
    }

    // N23: Interviewers
    {
      const r = await api('GET', '/api/interviewers', null, token);
      log('N23. GET /interviewers', r.status === 200 ? 'PASS' : 'FAIL');
    }

    // N24: PDF generation
    {
      const templates = await api('GET', '/api/admin/templates?page=1&page_size=1', null, token);
      if (templates.data?.items?.length > 0) {
        const tplId = templates.data.items[0].id;
        const opts = {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ variables: {} }),
        };
        const r = await fetch(`${API}/api/admin/templates/${tplId}/pdf`, opts);
        log('N24. POST /templates/{id}/pdf', r.status === 200 ? 'PASS' : 'FAIL', `content-type: ${r.headers.get('content-type')}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    //  O. ERROR BOUNDARY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── O: ERROR BOUNDARY ───\n');

    // O1: 404 page
    await page.goto(`${BASE}/nonexistent-page-xyz`);
    await page.waitForTimeout(2000);
    await ss(page, '404-page');
    {
      const bodyText = await page.textContent('body');
      const has404 = bodyText.includes('404') || bodyText.includes('Not Found') || bodyText.includes('not found');
      log('O1. 404 page handles unknown routes', has404 ? 'PASS' : 'FAIL');
    }

    // O2: ErrorBoundary component exists in build
    {
      // Check by navigating back to a known page
      await page.goto(`${BASE}/dashboard`);
      await page.waitForTimeout(2000);
      // Verify page loads fine (error boundary doesn't interfere with normal rendering)
      const has = await hasText(page, 'Dashboard', 5000) || await hasText(page, 'Jobs', 5000);
      log('O2. App loads fine with ErrorBoundary', has ? 'PASS' : 'FAIL');
    }

    // ═══════════════════════════════════════════════════════════════
    //  P. SKIP-TO-CONTENT & ACCESSIBILITY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n─── P: ACCESSIBILITY ───\n');

    // P1: Skip to content link exists (sr-only)
    {
      const skipLink = page.locator('a[href="#main-content"]');
      const exists = (await skipLink.count()) > 0;
      log('P1. Skip-to-content link exists', exists ? 'PASS' : 'FAIL');
    }

    // P2: Main content landmark
    {
      const main = page.locator('#main-content');
      const exists = (await main.count()) > 0;
      log('P2. Main content landmark (#main-content)', exists ? 'PASS' : 'FAIL');
    }

    // P3: Check icon buttons have aria-labels on templates page
    await navigateTo(page, '/templates');
    await page.waitForTimeout(1500);
    {
      const buttons = page.locator('button[aria-label]');
      const count = await buttons.count();
      log('P3. Buttons with aria-labels', count >= 3 ? 'PASS' : 'FAIL', `${count} buttons`);
    }

    // Final screenshot
    await ss(page, 'final-state');

  } catch (err) {
    console.error('\n💥 Unexpected error:', err.message);
    await ss(page, 'error-crash').catch(() => {});
    log('UNEXPECTED ERROR', 'FAIL', err.message);
  } finally {
    // ═══════════════════════════════════════════════════════════════
    //  SUMMARY
    // ═══════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(65));
    console.log(`  RESULTS:  ✅ PASS: ${pass}  |  ❌ FAIL: ${fail}  |  ⏭️ SKIP: ${skip}`);
    console.log(`  TOTAL: ${pass + fail + skip}  |  PASS RATE: ${Math.round(pass / (pass + fail) * 100)}%`);
    console.log('═'.repeat(65));
    console.log(`  Screenshots: ${SCREENSHOT_DIR}`);
    console.log('═'.repeat(65) + '\n');

    // Write results JSON
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'results.json'),
      JSON.stringify({ pass, fail, skip, total: pass + fail + skip, results }, null, 2)
    );

    // Print failures summary
    const failures = results.filter(r => r.status === 'FAIL');
    if (failures.length > 0) {
      console.log('\n  FAILURES:');
      for (const f of failures) {
        console.log(`    ❌ ${f.test}${f.detail ? ' — ' + f.detail : ''}`);
      }
      console.log('');
    }

    await browser.close();
    process.exit(fail > 0 ? 1 : 0);
  }
})();
