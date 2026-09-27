# Ride request screens

This feature defaults to hidden. Set `NEXT_PUBLIC_RIDE_REQUESTS_ENABLED=true` at
build time and rebuild the webapp only after the backend migration, API and
maintenance worker are deployed with `RIDE_REQUESTS_ENABLED=true`.

For the initial disabled release, leave `NEXT_PUBLIC_RIDE_REQUESTS_ENABLED` unset
or set it to `false` in hosting settings. To hide the feature again after an
off-hours testing window, set it to `false` and rebuild/redeploy. This is a global
switch, not an administrator-only preview. It does not change Stripe payment mode.
Keep backend payment webhooks and checkout cleanup running for outstanding checkouts.

- `/ride-requests`: browse, my requests, my offers; filters and pagination.
- `/ride-requests/new`: public meeting points, travel window, 1-4 seats, bags,
  optional budget and notes. No payment when posting.
- `/ride-requests/[id]`: driver offers, vehicle selection, owner checkout and
  cancellation. Payment confirms the original seats and publishes the spare seats.
- `/admin/ride-requests`: admin listing and links to request details.

Links appear in navigation, the homepage, Your rides and empty search results.
Existing signed-in/onboarding and admin guards apply. The backend is authoritative
for ownership, eligibility, price, checkout expiry and successful payment.

No native mobile app changes are included. New screens currently use English copy.
Before production, test against a migrated staging backend and Stripe test mode;
mocked browser checks cannot validate real payments or database concurrency.
See backend `docs/ride-requests.md` for API details and release acceptance checks.

## Driver offer UX

The driver detail screen separates a compact rider-request summary from the offer
form. A single saved vehicle is selected automatically; multiple vehicles require
an explicit choice. Exact departure times are read-only; flexible windows allow
a time within the rider's range. Fare is entered by the driver, not inferred from
the rider's budget.

Passenger capacity defaults to the requesting party's size and offer validity to
24 hours (bounded by request expiry). Extra seats and expiry controls are under
"Seats & offer settings". Shared-journey commitment and any missing terms/privacy
consent still require explicit confirmation. No eligibility or pricing checks
are bypassed. API failures preserve entered details, and empty/error vehicle
states explain the next action.

After sending, the driver sees their per-seat fare and waiting/checkout/confirmed
status rather than the rider's payment total. Active offers refresh every 15
seconds. Withdrawal requires confirmation; closed offers are in a history section.

### Local smoke test

`scripts/check-driver-offer.cjs` exercises the driver screen against a local
production build with the feature enabled. It requires Playwright resolvable by
Node (installed locally or through `NODE_PATH`) and Google Chrome. Start the app
on port 3002, then run `node scripts/check-driver-offer.cjs`. Override the local
URL with `DRIVER_OFFER_TEST_URL`; optionally set `DRIVER_OFFER_SCREENSHOTS` to an
existing screenshot directory.

The script mocks every API call and blocks external requests. It covers single
and multiple vehicles, request defaults, flexible departures, extra seats,
expiry settings, submission failures, status transitions, withdrawal confirmation,
empty/error/retry states and 320/390/768/1440px layouts. It does not validate live
payments, routing, eligibility or database writes.
