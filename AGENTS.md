# Repository Guidelines

## Project Structure & Module Organization
`paird` is a TypeScript app split into three source areas under `src/`:

- `src/client/` contains the React + Vite frontend, with screens in `screens/`, reusable UI in `components/`, and shared client state in `store.ts`.
- `src/server/` contains the Express + Socket.IO backend, PTY bridge, git helpers, and session state.
- `src/shared/types.ts` holds cross-boundary types used by both client and server.

Tests are colocated with code as `*.test.ts` or `*.test.tsx`. Production client assets build into `public/`; compiled server output goes to `dist/server/`.

## Build, Test, and Development Commands
- `npm run dev` starts the full local stack: Vite on `5173` and the server in watch mode.
- `npm run dev:client` runs only the frontend.
- `npm run dev:server` runs only the backend with `tsx watch`.
- `npm run build` builds the client into `public/` and compiles the server into `dist/server/`.
- `npm start` runs the production server from `dist/server/index.js`.
- `npm test` runs the full Vitest suite once.
- `npx vitest run src/server/gitHistory.test.ts` runs a single test file.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode expectations. Follow the existing style: ESM imports, single quotes, semicolons omitted, and concise functional React components. Use `PascalCase` for React components and screens, `camelCase` for functions and variables, and descriptive file names such as `gitStatusWatcher.ts` or `WorkspaceTabs.tsx`.

Keep shared contracts in `src/shared/types.ts` before duplicating types across layers.

## Testing Guidelines
Vitest is the test runner. Client tests under `src/client/` run in `jsdom`; server tests default to `node`. Add tests next to the code you change and mirror the target file name, for example `ChatPanel.test.tsx` for `ChatPanel.tsx`.

Prefer focused assertions around socket events, store mutations, and git/session flows. Run `npm test` before opening a PR.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit style: `feat(client): ...`, `fix(client): ...`, `test: ...`, `docs: ...`. Keep scopes specific when useful, and write commit subjects in the imperative mood.

PRs should include a short summary, affected areas (`client`, `server`, or `shared`), test evidence, and screenshots or terminal snippets for UI or workflow changes. Link related issues or spec docs from `docs/superpowers/` when applicable.
