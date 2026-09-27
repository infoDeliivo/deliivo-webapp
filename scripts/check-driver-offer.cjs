// Requires Playwright and a local production build with ride requests enabled.
// Every API request is mocked; external network requests are blocked.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const base = process.env.DRIVER_OFFER_TEST_URL || 'http://localhost:3002';
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: 'en-GB',
      timezoneId: 'Europe/Berlin',
    });
    await context.addInitScript(() => {
      localStorage.setItem('deliivo_access_token', 'mock-only');
      localStorage.setItem('deliivo_refresh_token', 'mock-only');
    });
    const future = new Date(Math.ceil((Date.now() + 3 * 86400000) / 60000) * 60000).toISOString();
    const later = new Date(new Date(future).getTime() + 2 * 3600000).toISOString();
    const cars = [
      {
        id: 'car-one',
        brand: 'Toyota',
        model_name: 'Corolla',
        licenseNumber: 'TEST-01',
        verificationStatus: 'APPROVED',
      },
      {
        id: 'car-two',
        brand: 'Skoda',
        model_name: 'Octavia',
        licenseNumber: 'TEST-02',
        verificationStatus: 'PENDING',
      },
    ];
    let vehicleMode = 'one',
      flexible = false,
      status = 'OPEN',
      offerStatus = null,
      expiredOffer = false;
    let rejectOffer = false,
      posts = 0,
      withdrawals = 0,
      lastBody,
      delayOffer = false;
    function detail() {
      return {
        id: 'request',
        riderId: 'rider',
        rider: { id: 'rider', firstName: 'Alex' },
        isOwner: false,
        originAddress: 'Riga Central Station, Latvia',
        destinationAddress: 'Tallinn Central Station, Estonia',
        departureAfter: future,
        departureBefore: flexible ? later : future,
        expiresAt: new Date(new Date(future).getTime() - 30 * 60000).toISOString(),
        seats: 2,
        luggage: 1,
        budgetPerSeat: 25,
        notes: 'One medium suitcase. Meet at the main station entrance.',
        status,
        offers: offerStatus
          ? [
              {
                id: 'offer',
                driverId: 'driver',
                status: offerStatus,
                expiresAt: expiredOffer
                  ? '2000-01-01T00:00:00Z'
                  : new Date(Date.now() + (lastBody?.expiresInHours || 24) * 3600000).toISOString(),
                rideId: 'ride',
                driver: { id: 'driver', firstName: 'Marta' },
                ride: {
                  departureDate: (lastBody?.departureAt || future).slice(0, 10),
                  departureTime: (lastBody?.departureAt || future).slice(11, 16),
                  totalSeats: lastBody?.totalSeats || 2,
                  basePricePerSeat: lastBody?.pricePerSeat || 20,
                  currency: 'EUR',
                  vehicle: cars[0],
                },
                price: { subtotal: 40, serviceFee: 4, totalPrice: 44, currency: 'EUR' },
              },
            ]
          : [],
      };
    }
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.includes('/api/')) return route.continue();
      const p = url.pathname;
      let data = {};
      if (p.endsWith('/users/me'))
        data = {
          id: 'driver',
          firstName: 'Marta',
          lastName: 'Test',
          role: 'USER',
          salutation: 'MS',
          gender: 'FEMALE',
          dob: '1990-01-01',
          onboardingStatus: 'COMPLETED',
          preferredLocale: 'en',
          tosAcceptedAt: future,
          privacyAcceptedAt: future,
        };
      else if (p.endsWith('/vehicles')) {
        if (vehicleMode === 'error')
          return route.fulfill({
            status: 503,
            json: { message: 'Vehicles temporarily unavailable.' },
          });
        data = { vehicles: vehicleMode === 'none' ? [] : vehicleMode === 'one' ? [cars[0]] : cars };
      } else if (p.endsWith('/offers') && route.request().method() === 'POST') {
        posts++;
        lastBody = route.request().postDataJSON();
        if (rejectOffer)
          return route.fulfill({
            status: 400,
            json: { message: 'Choose a fare within the allowed route range.' },
          });
        if (delayOffer) await new Promise((resolve) => setTimeout(resolve, 500));
        offerStatus = 'OPEN';
      } else if (p.endsWith('/withdraw')) {
        withdrawals++;
        offerStatus = 'WITHDRAWN';
      } else if (p.endsWith('/ride-requests/request')) data = detail();
      else if (p.includes('notifications')) data = { notifications: [], unreadCount: 0 };
      return route.fulfill({ status: 200, json: { success: true, data } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => {
      if (!/stripe/i.test(error.message)) errors.push(error.message);
    });
    async function load() {
      await page.goto(`${base}/ride-requests/request`);
      await page.getByRole('complementary', { name: 'Rider request summary' }).waitFor();
      const rejectCookies = page.getByRole('button', { name: 'Reject all', exact: true });
      if (await rejectCookies.isVisible()) await rejectCookies.click();
    }
    async function formReady() {
      await page.getByLabel('Fare per seat (EUR)', { exact: false }).waitFor();
    }
    async function fill() {
      await page.getByLabel('Fare per seat (EUR)', { exact: false }).fill('20');
      await page.getByRole('checkbox', { name: /I can carry/ }).check();
    }
    async function screenshot(name) {
      if (process.env.DRIVER_OFFER_SCREENSHOTS)
        await page.screenshot({
          path: path.join(process.env.DRIVER_OFFER_SCREENSHOTS, `${name}.png`),
          fullPage: true,
        });
    }
    await load();
    await formReady();
    assert.equal(await page.getByRole('combobox', { name: 'Vehicle', exact: true }).count(), 0);
    assert.equal(await page.locator('input[name="departure"]').count(), 0);
    assert.equal(await page.getByText('Your offers', { exact: true }).count(), 0);
    assert.equal(await page.locator('select[name="seats"]').isVisible(), false);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `Overflow at ${width}px`,
      );
      await screenshot(`driver-offer-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await fill();
    await page.getByRole('button', { name: 'Send offer', exact: true }).click();
    await page.getByRole('heading', { name: 'Waiting for rider' }).waitFor();
    assert.deepEqual(lastBody, {
      vehicleId: 'car-one',
      departureAt: future,
      totalSeats: 2,
      pricePerSeat: 20,
      expiresInHours: 24,
      acceptsSharedJourney: true,
    });
    assert.equal(posts, 1);
    assert.equal(await page.getByText('total for your party', { exact: true }).count(), 0);
    await screenshot('driver-offer-sent');
    await page.getByRole('button', { name: 'Withdraw offer', exact: true }).click();
    assert.equal(withdrawals, 0);
    await page.getByRole('button', { name: 'Keep offer', exact: true }).click();
    await page.getByRole('button', { name: 'Withdraw offer', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, withdraw offer' }).click();
    await formReady();
    assert.equal(withdrawals, 1);

    vehicleMode = 'many';
    flexible = true;
    offerStatus = null;
    await load();
    await formReady();
    assert.ok(await page.getByRole('button', { name: 'Send offer', exact: true }).isDisabled());
    await page.getByRole('combobox', { name: 'Vehicle', exact: true }).selectOption('car-two');
    await page.getByText('This vehicle is awaiting approval.', { exact: false }).waitFor();
    await page.getByRole('combobox', { name: 'Vehicle', exact: true }).selectOption('car-one');
    await fill();
    const initialDeparture = await page.locator('input[name="departure"]').inputValue();
    assert.ok(new Date(initialDeparture).getTime() >= new Date(future).getTime());
    await page.getByText('Seats & offer settings', { exact: false }).click();
    await page.getByLabel('Total passenger seats', { exact: false }).selectOption('4');
    await page.getByLabel('Offer valid for', { exact: true }).selectOption('6');
    await page.getByText('2 spare seats open', { exact: false }).waitFor();
    await page.getByText('Seats & offer settings', { exact: false }).click();
    rejectOffer = true;
    await page.getByRole('button', { name: 'Send offer', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'allowed route range' }).waitFor();
    assert.equal(await page.getByLabel('Fare per seat (EUR)', { exact: false }).inputValue(), '20');
    assert.equal(await page.locator('select[name="seats"]').inputValue(), '4');
    assert.equal(lastBody.totalSeats, 4);
    assert.equal(lastBody.expiresInHours, 6);
    assert.equal(lastBody.departureAt, future);
    rejectOffer = false;
    delayOffer = true;
    const beforeRetry = posts;
    await page.getByRole('button', { name: 'Send offer', exact: true }).click();
    await page.getByRole('button', { name: 'Sending offer...' }).waitFor();
    assert.ok(await page.getByRole('button', { name: 'Sending offer...' }).isDisabled());
    await page.getByRole('heading', { name: 'Waiting for rider' }).waitFor();
    assert.equal(posts, beforeRetry + 1);

    offerStatus = 'SELECTED';
    status = 'CHECKOUT_PENDING';
    await load();
    await page.getByRole('heading', { name: 'Rider is checking out' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Withdraw offer' }).count(), 0);
    assert.equal(await page.getByText('Complete payment below', { exact: false }).count(), 0);
    offerStatus = 'ACCEPTED';
    status = 'MATCHED';
    await load();
    await page.getByRole('heading', { name: 'Ride confirmed' }).waitFor();
    assert.equal(
      await page.getByRole('link', { name: 'View confirmed ride' }).getAttribute('href'),
      '/rides/ride/manage',
    );
    offerStatus = 'OPEN';
    expiredOffer = true;
    status = 'OPEN';
    await load();
    await formReady();
    await page.getByText('Previous offers (1)', { exact: true }).click();
    await page.getByRole('heading', { name: 'Offer expired' }).waitFor();

    offerStatus = null;
    vehicleMode = 'error';
    await load();
    await page.getByRole('alert').filter({ hasText: 'Vehicles temporarily unavailable' }).waitFor();
    vehicleMode = 'one';
    await page.getByRole('button', { name: 'Try again' }).click();
    await formReady();
    vehicleMode = 'none';
    await load();
    await page.getByRole('heading', { name: 'Add a vehicle first' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Send offer', exact: true }).count(), 0);
    assert.equal(
      await page.getByRole('link', { name: 'Add a vehicle', exact: true }).getAttribute('href'),
      '/profile/vehicle',
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS: driver offer defaults, 4 viewports, vehicle selection/empty/error/retry, flexible time, seat/expiry settings, API error preservation, send lock, status/withdrawal, expired offer; mocked APIs only.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
