# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # Install deps, generate Prisma client, run migrations (first-time setup)
npm run dev          # Start dev server with Turbopack (http://localhost:3000)
npm run build        # Production build
npm run lint         # Run ESLint
npm run test         # Run Vitest test suite
npm run db:reset     # Hard reset database
```

Run a single test file:
```bash
npx vitest run src/components/chat/__tests__/ChatInterface.test.tsx
```

## Environment

Copy `.env` and set:
- `ANTHROPIC_API_KEY` — optional; falls back to mock AI if absent (mock allows 4 steps, real allows 40)
- `JWT_SECRET` — optional; uses dev fallback if absent

## Architecture

UIGen is a Next.js 15 App Router application where users describe React components in a chat interface and Claude generates/edits them live.

### Request flow

1. User types in `ChatInterface` → sends to `/api/chat`
2. Chat API loads the virtual file system from the project, builds the system prompt (`src/lib/prompts/generation.tsx`), and streams a response from Claude via Vercel AI SDK
3. Claude calls two tools: `str_replace_editor` (targeted edits) and `file_manager` (create/delete/rename files), both operating on `VirtualFileSystem` instances
4. File changes stream back to the client through `file-system-context.tsx` and trigger a re-render in `PreviewFrame`
5. `PreviewFrame` uses Babel standalone + an import map to transform JSX in-browser and render in an iframe
6. On completion, if authenticated the project is saved to the DB (messages + serialized VFS as JSON strings)

### Key abstractions

- **`VirtualFileSystem`** (`src/lib/file-system.ts`) — in-memory file store, serialized to JSON for DB persistence. Shared between the AI tools and the preview renderer.
- **`file-system-context.tsx`** — React context wrapping VirtualFileSystem; drives both CodeEditor/FileTree and PreviewFrame.
- **`chat-context.tsx`** — wraps Vercel AI SDK's `useChat`; handles streaming tool-call callbacks that mutate the VFS context.
- **`provider.ts`** — returns either the real Anthropic model (`claude-haiku-4-5`) or a mock, based on `ANTHROPIC_API_KEY`.

### Auth

JWT sessions via Jose in HTTP-only cookies (7-day expiry). Passwords hashed with bcrypt. Server actions in `src/actions/index.ts` handle sign-up/sign-in/sign-out/getUser. Anonymous users have their in-progress work tracked in `sessionStorage` via `anon-work-tracker.ts` and can claim it after signing in.

### Database

Prisma + SQLite (default). Schema is in `prisma/schema.prisma`.

**User:** `id`, `email`, `password`, `createdAt`, `updatedAt`, `projects`

**Project:** `id`, `name`, `userId` (optional FK), `messages` (JSON string), `data` (serialized VFS JSON), `createdAt`, `updatedAt`, `user` (cascade delete)

### Routes

- `/` — home/auth page (`src/app/page.tsx`)
- `/[projectId]` — project workspace (`src/app/[projectId]/page.tsx`)
- `/api/chat` — streaming AI endpoint

## Code Style

- Use comments sparingly. Only comment complex code.

### Testing

Vitest with jsdom + `@testing-library/react`. Tests live alongside their modules in `__tests__/` subdirectories. Component tests mock contexts; transform tests run pure logic.
