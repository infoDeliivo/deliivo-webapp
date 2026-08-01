<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Stripe

This project uses `@stripe/stripe-js` and `@stripe/react-stripe-js` (see `src/lib/stripe.tsx`). Stripe's SDKs, Elements APIs, and dashboard flows change often, and details may differ from your training data.

Before writing or changing any Stripe code, check the official docs first: https://docs.stripe.com/

Relevant sections:
- Stripe.js / Elements: https://docs.stripe.com/js
- React Stripe.js: https://docs.stripe.com/stripe-js/react
- Payment Element: https://docs.stripe.com/payments/payment-element
- Connect (driver payouts): https://docs.stripe.com/connect
- API reference: https://docs.stripe.com/api

Verify the API version, parameter names, and deprecation notices in the docs before implementing. Do not rely on memory.
