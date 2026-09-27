# AGENTS

FLUX — personally maintained fork of FLVX: Go admin API + Vite/React UI + Go agent.

## Structure

| Dir | Role | Entry |
|-----|------|-------|
| `go-backend/` | Admin API (GORM + SQLite/PG, net/http) | `cmd/paneld/main.go` |
| `go-gost/` | Forwarding agent (forked GOST) | `main.go` |
| `go-gost/x/` | Protocol handlers/dialers/listeners (own module) | — |
| `vite-frontend/` | React dashboard (Mantine + Tailwind v4) | `src/App.tsx` |

`go-gost/go.mod` uses `replace github.com/go-gost/x => ./x`.

## Commands

```bash
# Backend
(cd go-backend && go run ./cmd/paneld)        # SERVER_ADDR defaults to :6365
(cd go-backend && make build)
(cd go-backend && go test ./...)

# Frontend
(cd vite-frontend && pnpm install)
(cd vite-frontend && pnpm run dev)             # host 0.0.0.0:3000
(cd vite-frontend && pnpm run build)           # tsc && vite build
(cd vite-frontend && pnpm run lint)            # eslint --fix (no typecheck command)

# Agent
(cd go-gost && go run .)
```

## Conventions

- **Auth**: raw JWT in `Authorization` header — **no `Bearer` prefix** (both frontend and backend).
- **API envelope**: all responses `{code, msg, data, ts}` (code 0 = success).
- **Frontend UI**: use Mantine (`@mantine/core`) and shared application components in `src/components/ui/*`. Never add `@heroui/*`, `@nextui-org/*`, or the retired shadcn bridge.
- **Tailwind theme**: `globals.css` must import `tailwind-theme.pcss` or semantic classes break.
- **Backend DB**: handlers use Repository methods, never `repo.DB()` directly.
- **GORM models**: always define `TableName()` (GORM pluralizes by default).
- **GORM tags**: no `type:jsonb` or `type:serial` (SQLite incompatible).
- **Go versions**: `go.mod` says 1.25.0 for all three modules; CI builds with 1.25.x.

## Anti-patterns

- Don't edit `install.sh` or `panel_install.sh` locally. Release customization belongs in `scripts/prepare-release.py` and `scripts/release-image-loader.sh`; CI renders fork-specific scripts from the templates.
- Don't edit `go-gost/x/internal/util/grpc/proto/*.pb.go` (generated).
- Don't add frontend tests (no Vitest/Jest configured).
- Don't reintroduce `@heroui/*` or `@nextui-org/*` packages.

## Testing

- Backend: `(cd go-backend && go test ./...)` — includes contract tests in `tests/contract/`.
- Frontend: no test infrastructure.
- CI runs one PostgreSQL contract test: env var `FLVX_POSTGRES_TEST_DSN`.

## Build quirks

- `vite-frontend` uses `rolldown-vite` (Rust bundler), not standard Vite.
- `vite.config.ts`: production minification and tree-shaking enabled; route pages are lazy-loaded.
- Release CI builds native Linux amd64/arm64 images and agents, runs container smoke checks, and publishes checksummed binaries, Docker image archives, and generated installers.
