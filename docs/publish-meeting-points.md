# Publish meeting points

The regular `/publish` wizard uses `PublishMeetingPoints` for its second step.
This is separate from the feature-flagged ride-request offer flow.

## Driver flow

- Choose one pickup and one drop-off point. Selecting a search result adds it directly.
- Additional pickup/drop-off points are optional, with a maximum of three of each.
- Expand optional stopovers only when needed. Select a suggested route city, then an exact meeting point within it. Up to three stopovers can be removed or reordered.
- Open the route map on demand. Suggestions and map previews are fetched only when their sections are opened.
- Use the wizard's single Continue button. Failed saves stay on the same step with the selections intact and an error message.

## Validation and API compatibility

The existing draft endpoints and `LocationInput` payloads are unchanged, including parent city metadata and stopover order. Backend validation remains authoritative.

Client-side checks preserve the configured city radius (default 15 km), stopover city radius (5 km), and selected route corridor (10 km). Duplicate points within a category and selections beyond the three-point limit are rejected.

Place details must resolve to valid coordinates before a point can be added. Failed lookups never substitute zero coordinates. Changing the stopover city resets its search, and obsolete search/detail responses are ignored.

New helper messages use translation keys with English fallback. Existing translated labels are reused. There are no backend, payment, dependency, or deployment flag changes.

## Verification

Build and run the frontend locally on port 3002, then run:

```powershell
node scripts/check-publish-stops.cjs
```

The script requires Playwright resolvable by Node and installed Google Chrome. Set `NODE_PATH` if Playwright is installed outside this repository. No dependency is added by this change.

Optional environment variables:

- `PUBLISH_TEST_URL`: alternate local server URL (localhost or 127.0.0.1 only).
- `PUBLISH_TEST_SCREENSHOTS`: existing directory for desktop/mobile screenshots.

Coverage includes direct rides, optional stops, keyboard selection, failed lookup/search/save and retries, mandatory points, duplicates, distance limits, maximum pickups, changing stopover cities, stop order, parent metadata, back navigation, map toggling, and overflow checks at 320/390/768/1440 pixels.

All API requests are mocked and external requests blocked. This validates the UI and request payloads, not live Google Maps rendering or backend persistence. Before release, smoke-test a real route and meeting points against a test backend; no live ride needs to be published.
