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
