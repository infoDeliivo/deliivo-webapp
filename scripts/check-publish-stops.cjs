// Run against localhost with Playwright and Chrome available. All APIs are mocked.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

function encode(points) {
  let last = [0, 0],
    result = '';
  for (const point of points)
    for (let axis = 0; axis < 2; axis++) {
      const current = Math.round(point[axis] * 1e5);
      let delta = current - last[axis];
      last[axis] = current;
      delta = delta < 0 ? ~(delta << 1) : delta << 1;
      while (delta >= 32) {
        result += String.fromCharCode((32 | (delta & 31)) + 63);
        delta >>= 5;
      }
      result += String.fromCharCode(delta + 63);
    }
  return result;
}

(async () => {
  const base = process.env.PUBLISH_TEST_URL || 'http://localhost:3002';
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: 'en-GB',
    });
    await context.addInitScript(() => {
      localStorage.setItem('deliivo_access_token', 'mock-only');
      localStorage.setItem('deliivo_refresh_token', 'mock-only');
      localStorage.setItem('deliivo.publish.quick-guide.v1', 'hidden');
    });
    const places = {
      riga: { address: 'Riga, Latvia', lat: 56.95, lng: 24.1 },
      tallinn: { address: 'Tallinn, Estonia', lat: 59.44, lng: 24.75 },
      pickup: { address: 'Riga Central Station, Latvia', lat: 56.95, lng: 24.11 },
      pickup2: { address: 'Riga Park and Ride, Latvia', lat: 56.96, lng: 24.12 },
      pickup3: { address: 'Riga Bus Station, Latvia', lat: 56.951, lng: 24.112 },
      dropoff: { address: 'Tallinn Central Station, Estonia', lat: 59.441, lng: 24.751 },
      stop: { address: 'Coastal Bus Station, Estonia', lat: 58.01, lng: 24.38 },
      stop2: { address: 'North Bus Station, Estonia', lat: 58.5, lng: 24.51 },
      far: { address: 'Far Away Station, Estonia', lat: 60.0, lng: 27.0 },
      offroute: { address: 'Off Route Station, Latvia', lat: 56.95, lng: 23.87 },
    };
    const cities = [
      {
        placeId: 'coast',
        name: 'Coastal town',
        address: 'Coastal town, Estonia',
        lat: 58,
        lng: 24.375,
      },
      {
        placeId: 'north',
        name: 'Northern town',
        address: 'Northern town, Estonia',
        lat: 58.5,
        lng: 24.505,
      },
    ];
    const polyline = encode([
      [56.95, 24.1],
      [59.44, 24.75],
    ]);
    let detailsFail = false,
      suggestionsFail = false,
      saveFail = false,
      autocompleteFail = false;
    let mapCalls = 0,
      suggestionCalls = 0,
      saves = [],
      autocompleteQueries = [];
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== new URL(base).origin) return route.abort();
      if (!url.pathname.includes('/api/')) return route.continue();
      const p = url.pathname;
      let data = {};
      const fail = (message) => route.fulfill({ status: 400, json: { success: false, message } });
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
        };
      else if (p.endsWith('/eligibility')) data = { eligible: true, requirements: [] };
      else if (p.endsWith('/connect/status'))
        data = { onboardingComplete: true, payoutsEnabled: true };
      else if (p.endsWith('/autocomplete')) {
        autocompleteQueries.push(Object.fromEntries(url.searchParams));
        if (autocompleteFail) return fail('Search unavailable');
        const id = url.searchParams.get('input');
        data = places[id] ? [{ placeId: id, description: places[id].address }] : [];
      } else if (p.endsWith('/place-details')) {
        if (detailsFail) return fail('Location unavailable');
        const point = places[url.searchParams.get('placeId')];
        data = { location: { lat: point.lat, lng: point.lng } };
      } else if (p.endsWith('/draft/routes/compute'))
        data = {
          routes: [
            {
              index: 7,
              polyline,
              distanceText: '310 km',
              durationText: '4 hours',
              isPublishable: true,
            },
          ],
        };
      else if (p.endsWith('/stopovers/suggestions')) {
        suggestionCalls++;
        if (suggestionsFail) return fail('Suggestions unavailable');
        data = { suggestions: cities };
      } else if (p.endsWith('/maps/routes/compute')) {
        mapCalls++;
        data = [{ routes: [{ polyline: { encodedPolyline: polyline } }] }];
      } else if (/\/draft\/(pickups|dropoffs|stopovers)$/.test(p)) {
        if (saveFail) return fail('Meeting points could not be saved. Try again.');
        saves.push(route.request().postDataJSON());
      }
      return route.fulfill({ status: 200, json: { success: true, data } });
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => {
      if (!/google|stripe/i.test(error.message)) errors.push(error.message);
    });
    const next = () => page.getByRole('button', { name: 'Continue', exact: true });
    async function start() {
      await page.goto(`${base}/publish`);
      await page.getByPlaceholder('Leaving from...').fill('riga');
      await page.getByRole('button', { name: 'Riga, Latvia', exact: true }).click();
      await page.getByPlaceholder('Going to...').fill('tallinn');
      await page.getByRole('button', { name: 'Tallinn, Estonia', exact: true }).click();
      const cookies = page.getByRole('button', { name: 'Reject all', exact: true });
      if (await cookies.isVisible()) await cookies.click();
      await next().click();
      await page.getByRole('heading', { name: 'Choose rider meeting points' }).waitFor();
    }
    async function choose(label, id, keyboard = false) {
      const input = page.getByRole('combobox', { name: label, exact: true });
      await input.fill(id);
      await page.getByRole('option', { name: places[id].address, exact: true }).waitFor();
      if (keyboard) {
        await input.press('ArrowDown');
        await input.press('Enter');
      } else await page.getByRole('option', { name: places[id].address, exact: true }).click();
    }
    async function selected(id) {
      await page
        .getByRole('button', { name: `Remove ${places[id].address}`, exact: true })
        .waitFor();
    }
    async function screenshot(name) {
      if (process.env.PUBLISH_TEST_SCREENSHOTS)
        await page.screenshot({
          path: path.join(process.env.PUBLISH_TEST_SCREENSHOTS, `${name}.png`),
          fullPage: true,
        });
    }
    await start();
    assert.ok(await next().isDisabled());
    assert.equal(suggestionCalls, 0);
    assert.equal(mapCalls, 0);
    assert.equal(await page.getByRole('button', { name: 'Next', exact: true }).count(), 0);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `Overflow at ${width}`,
      );
      await screenshot(`publish-stops-${width}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    detailsFail = true;
    await choose('Search pickup point', 'pickup');
    await page.getByRole('alert').filter({ hasText: 'Could not confirm this location' }).waitFor();
    assert.ok(await next().isDisabled());
    assert.equal(
      await page
        .getByRole('button', { name: `Remove ${places.pickup.address}`, exact: true })
        .count(),
      0,
    );
    detailsFail = false;
    await choose('Search pickup point', 'pickup', true);
    await selected('pickup');
    assert.ok(await next().isDisabled());
    await choose('Search drop-off point', 'dropoff');
    await selected('dropoff');
    assert.ok(await next().isEnabled());
    await next().click();
    await page.getByRole('heading', { name: 'Select travel date' }).waitFor();
    assert.deepEqual(saves.at(-1), { stopovers: [] });
    assert.equal(saves[0].pickups[0].parentPlaceId, 'riga');
    assert.equal(saves[1].dropoffs[0].parentPlaceId, 'tallinn');
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await selected('pickup');
    await selected('dropoff');

    await page.getByRole('button', { name: 'Add pickup point', exact: true }).click();
    await choose('Search pickup point', 'pickup');
    await page.getByRole('alert').filter({ hasText: 'already selected' }).waitFor();
    await choose('Search pickup point', 'far');
    await page.getByRole('alert').filter({ hasText: 'km away' }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: `Remove ${places.far.address}`, exact: true }).count(),
      0,
    );
    await choose('Search pickup point', 'offroute');
    await page.getByRole('alert').filter({ hasText: 'from the selected route' }).waitFor();
    assert.equal(
      await page
        .getByRole('button', { name: `Remove ${places.offroute.address}`, exact: true })
        .count(),
      0,
    );
    await choose('Search pickup point', 'pickup2');
    await selected('pickup2');
    await page.getByRole('button', { name: 'Add pickup point', exact: true }).click();
    await choose('Search pickup point', 'pickup3');
    await selected('pickup3');
    assert.equal(
      await page.getByRole('button', { name: 'Add pickup point', exact: true }).count(),
      0,
    );

    suggestionsFail = true;
    await page.getByRole('button', { name: /Stopovers optional/ }).click();
    await page.getByRole('alert').filter({ hasText: 'Could not load stops' }).waitFor();
    assert.ok(await next().isEnabled());
    suggestionsFail = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByLabel('Choose a stop along your route', { exact: true }).selectOption('coast');
    await page.getByRole('combobox', { name: 'Search stopover point', exact: true }).fill('stop');
    await page.getByRole('option', { name: places.stop.address, exact: true }).waitFor();
    await page.getByLabel('Choose a stop along your route', { exact: true }).selectOption('north');
    assert.equal(
      await page.getByRole('combobox', { name: 'Search stopover point', exact: true }).inputValue(),
      '',
    );
    assert.equal(await page.getByRole('listbox').count(), 0);
    await choose('Search stopover point', 'stop2');
    await selected('stop2');
    await page.getByLabel('Choose a stop along your route', { exact: true }).selectOption('coast');
    await choose('Search stopover point', 'stop');
    await selected('stop');
    await page
      .getByRole('button', { name: `Move up: ${places.stop.address}`, exact: true })
      .click();
    await screenshot('publish-stops-selected');
    await page.setViewportSize({ width: 390, height: 900 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Selected stops overflow on mobile',
    );
    await screenshot('publish-stops-selected-mobile');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Preview route on map', exact: true }).click();
    await page.waitForResponse((response) => response.url().includes('/maps/routes/compute'));
    assert.equal(mapCalls, 1);
    await page.getByRole('button', { name: 'Hide route map', exact: true }).click();
    saveFail = true;
    await next().click();
    await page.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
    await selected('pickup');
    await selected('stop');
    saveFail = false;
    await next().click();
    await page.getByRole('heading', { name: 'Select travel date' }).waitFor();
    assert.deepEqual(
      saves.at(-1).stopovers.map((point) => point.placeId),
      ['stop', 'stop2'],
    );
    assert.deepEqual(
      saves.at(-1).stopovers.map((point) => point.parentPlaceId),
      ['coast', 'north'],
    );
    assert.ok(
      autocompleteQueries.some((query) => query.scope === 'europe' && query.radius === '5000'),
    );
    assert.ok(
      autocompleteQueries.some((query) => query.scope === 'baltic' && query.radius === '15000'),
    );
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page
      .getByRole('button', { name: `Remove ${places.dropoff.address}`, exact: true })
      .click();
    assert.ok(await next().isDisabled());
    autocompleteFail = true;
    await page
      .getByRole('combobox', { name: 'Search drop-off point', exact: true })
      .fill('dropoff');
    await page.getByRole('alert').filter({ hasText: 'Could not search places' }).waitFor();
    autocompleteFail = false;
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByRole('option', { name: places.dropoff.address, exact: true }).click();
    await selected('dropoff');
    assert.deepEqual(errors, []);
    console.log(
      'PASS: direct ride, optional stops, keyboard selection, radius/route/duplicate/max checks, lookup/retry failures, parent reset, reorder, payloads, remove, map toggle and 4 viewports. Mocked APIs only.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
