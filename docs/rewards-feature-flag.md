# Rewards release flag

Set `NEXT_PUBLIC_REWARDS_ENABLED=true` for the staging build only. Leave it absent
or set it to `false` for production. This is a build-time flag, not an admin setting.

The paired backend flag is `REWARDS_ENABLED`; it must also be true for rewards to
work. Backend-off rejects rewards APIs even if an old frontend still shows them.
Frontend-off hides wallet navigation, balances, campaigns and admin reward grants,
skips reward fetches, and returns the not-found screen for `/profile/wallet` and
`/admin/rewards`. Normal earnings and payouts are unaffected.

No rewards/referral records are deleted when disabled. The reward campaign feature
is gated; a separate coupon/discount implementation has not been identified.

## Verification

Build the frontend with the desired flag and start it locally on port 3002. With
Playwright available to Node and Google Chrome installed:

```powershell
$env:EXPECT_REWARDS_ENABLED='false' # Match the build under test.
node scripts/check-rewards-flags.cjs
```

Repeat against a rewards-enabled build with `EXPECT_REWARDS_ENABLED=true`.
`REWARDS_TEST_URL` can override the localhost URL. All API requests are mocked and
external traffic blocked. These checks do not validate live backend persistence.

The backend's `docs/main-develop-sync.md` records additional release gates. The
combined staging code includes a 20-percent service-fee migration that is not
controlled by this flag; it must not reach production without pricing approval.
