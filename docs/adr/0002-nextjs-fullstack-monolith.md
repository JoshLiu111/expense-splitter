# Next.js full-stack monolith on Postgres

The app is a single Next.js (App Router, TypeScript) codebase on Vercel, backed by Postgres (Neon) through Drizzle, rather than a React SPA with a separate API service. This is a portfolio project aimed at full-stack + AI roles in business/finance, where shipping a production-grade product quickly matters more than showcasing a separate backend language; one deploy, same-origin auth cookies and SSR (landing < 2s, no theme flash) all come for free. To keep the backend legible, domain logic lives in a framework-free core, and Next.js only adapts it.
