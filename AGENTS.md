# AGENTS.md

## Cursor Cloud specific instructions

### Architecture Overview

This is a monorepo with 4 sub-projects:

| Project | Path | Port | Purpose |
|---------|------|------|---------|
| Article Collector Bot | `/` (root `src/`) | 3000 | Feishu chatbot + HTTP API |
| MindFlow Backend | `mindflow-project/backend/` | 3001 | Express REST API for writing workflow |
| MindFlow Client | `mindflow-client/` | - | WeChat Mini Program (Taro) |
| Website | `website/` | 5173 | React + Vite landing page |

### Development Commands

Standard commands are in each `package.json`. Key ones:

- **Website**: `cd website && npm run dev` (Vite, port 5173)
- **MindFlow Backend**: `cd mindflow-project/backend && npm run dev` (tsx watch, port 3001)
- **Root Article Collector**: `npm run dev` (ts-node-dev, port 3000 — requires Feishu credentials)
- **Lint (root)**: `npm run lint` (tsc --noEmit)
- **Lint (website)**: `cd website && npm run lint`
- **Tests (root)**: `npm test` (Jest)
- **Tests (backend)**: `cd mindflow-project/backend && npm test`

### Important Caveats

1. **Prisma schema provider**: The `mindflow-project/backend/prisma/schema.prisma` must use `provider = "postgresql"` (the migration lock confirms this). If it shows `sqlite`, change it to `postgresql` — the schema uses `@db.Text` and `Json` types incompatible with SQLite.

2. **Database**: PostgreSQL 15 and Redis 7 run via Docker Compose at `mindflow-project/docker-compose.yml`. Start with:
   ```
   cd mindflow-project && docker compose up -d
   ```
   PostgreSQL connection: `postgresql://mindflow:mindflow_password@localhost:5432/mindflow`

3. **Docker in Cloud Agent VM**: Docker requires `fuse-overlayfs` storage driver and `iptables-legacy`. The daemon must be started manually:
   ```
   sudo dockerd &
   ```
   After starting, run `sudo chmod 666 /var/run/docker.sock` for non-root access.

4. **mindflow-client npm install**: Requires `--legacy-peer-deps` flag due to webpack/Taro peer dependency conflicts.

5. **Backend .env**: Must exist at `mindflow-project/backend/.env` with at minimum `DATABASE_URL` and `JWT_SECRET`. Template at `.env.example`.

6. **Pre-existing TypeScript errors**: The MindFlow backend has ~10 TypeScript errors (in `llm.ts`, `auth.ts`, `feishu.service.ts`, etc.) that do not prevent the server from running (tsx ignores type errors at runtime). The mindflow-client ESLint config has a `parserOptions.project` issue.

7. **Backend tests**: 125/128 pass. 3 failures are pre-existing (related to Prisma client mock setup in some test files).
