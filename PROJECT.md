App: EDGE — AI-powered trading toolkit
AI Assistant: BULL-E (powered by Claude)

Stack: Next.js 14 App Router, TypeScript strict mode, Tailwind,
shadcn/ui, Supabase, Upstash Redis, lightweight-charts, Vercel AI SDK

Rules:

- Always use TypeScript, never JavaScript
- All DB queries must use Supabase with RLS — users only see their own data
- All API inputs validated with Zod
- All data fetching with TanStack Query
- Streaming AI responses via Vercel AI SDK only
- Never hardcode API keys, always use env vars
- Mobile responsive on every component
- Every component gets a loading skeleton and error state
