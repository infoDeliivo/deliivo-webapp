# Deliivo Web App

Standalone Next.js frontend for Deliivo.

## Local development

```bash
npm install
npm run dev
```

## Deploying to Vercel

1. Create a new Vercel project from this repository.
2. Set the root directory to this folder if the repo is nested, or import this folder as its own repo.
3. Add the environment variables from `.env.example`.
4. Set `BACKEND_URL` to the Railway backend URL.
5. Build command: `npm run build`
6. Output is managed by Next.js automatically.

## Required environment variables

Copy `.env.example` to `.env.local` for local work, or configure them in Vercel project settings.

For split deployments such as Railway web + Railway API:

- `BACKEND_URL` must be the backend service URL reachable from the Next.js server.
- `NEXT_PUBLIC_SOCKET_URL` should be the public backend URL used by the browser for Socket.IO.
- `NEXT_PUBLIC_BACKEND_URL` can be set to the same public backend URL as a fallback.
- The backend `ALLOWED_ORIGINS` must include the public webapp URL.
- `NEXT_PUBLIC_PLATFORM_FEE_PERCENT` should match the backend `PLATFORM_FEE_PERCENT` so publish previews match checkout pricing.
- `NEXT_PUBLIC_ENABLE_EMAIL_PHONE_AUTH=true` shows email and phone OTP sign-in/sign-up controls. Leave it unset or set it to `false` to keep only Google auth visible.
- Temporary admin fallback page: `/auth/admin-temp`. It only works when the backend temporary admin login env vars are enabled.
