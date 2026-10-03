// Run against a local production build. All APIs are mocked; external requests are blocked.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const base = process.env.REWARDS_TEST_URL || 'http://localhost:3002';
  const enabled = process.env.EXPECT_REWARDS_ENABLED === 'true';
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      localStorage.setItem('deliivo_access_token', 'mock-only');
      localStorage.setItem('deliivo_refresh_token', 'mock-only');
    });
    let rewardCalls = 0;
    const user = {
      id: 'admin',
      firstName: 'Test',
      lastName: 'Admin',
      role: 'ADMIN',
      onboardingStatus: 'COMPLETED',
      preferredLocale: 'en',
      salutation: 'MS',
      gender: 'FEMALE',
      dob: '1990-01-01',
    };
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.includes('/api/')) return route.continue();
      let data = {};
      if (/rewards|campaigns/.test(url.pathname)) {
        rewardCalls++;
        data = url.pathname.endsWith('/campaigns')
          ? []
          : {
              userId: user.id,
              referralCode: 'DLV-TEST',
              totals: [],
              campaigns: [],
              history: [],
              ledgerIntegrity: { valid: true },
            };
      } else if (url.pathname.endsWith('/users/me')) data = user;
      else if (url.pathname.endsWith('/profile'))
        data = { ...user, user, stats: {}, verification: {}, vehicles: [] };
      else if (url.pathname.endsWith('/stats'))
        data = { totalUsers: 0, totalRides: 0, totalBookings: 0, totalRevenue: 0 };
      else if (url.pathname.endsWith('/ops/summary'))
        data = {
          checks: {},
          configuration: {},
          operations: {},
          content: { locales: [], total: 0, published: 0, drafts: 0 },
          uptimeSeconds: 0,
        };
      return route.fulfill({ status: 200, json: { success: true, data } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => {
      if (!/google|stripe/i.test(e.message)) errors.push(e.message);
    });
    await page.goto(`${base}/profile`);
    await page.getByText('Test Admin', { exact: true }).first().waitFor();
    await page.waitForTimeout(500);
    assert.equal((await page.locator('a[href="/profile/wallet"]').count()) > 0, enabled);
    assert.ok(
      (await page.locator('a[href="/profile/earnings"]').count()) > 0,
      'Normal earnings must stay visible',
    );
    for (const route of ['/profile/wallet', '/admin/rewards']) {
      const response = enabled
        ? page.waitForResponse((res) => /\/api\/.*(rewards|campaigns)/.test(res.url()))
        : null;
      await page.goto(`${base}${route}`);
      if (!enabled) await page.getByText('404', { exact: true }).waitFor();
      else {
        await response;
        assert.equal(await page.getByText('404', { exact: true }).count(), 0);
      }
    }
    await page.goto(`${base}/admin`);
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
    assert.equal((await page.locator('a[href="/admin/rewards"]').count()) > 0, enabled);
    assert.ok(
      (await page.locator('a[href="/admin/payouts"]').count()) > 0,
      'Normal payouts must stay visible',
    );
    assert.equal(rewardCalls > 0, enabled, 'Disabled UI must never fetch rewards');
    assert.deepEqual(errors, []);
    console.log(
      `PASS: rewards ${enabled ? 'on' : 'off'}; profile/navbar/admin links, direct pages, API calls, earnings and payouts.`,
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
