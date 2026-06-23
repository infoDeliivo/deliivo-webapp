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
