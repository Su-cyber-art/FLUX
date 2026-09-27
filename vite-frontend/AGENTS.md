# vite-frontend

React dashboard for the FLUX personal fork. React 18 + TypeScript + Mantine 8 + Tailwind v4 + rolldown-vite.

## Structure

| Dir/File | Role |
| --- | --- |
| `src/App.tsx` | Lazy routes, session guard, site configuration and optional wallpaper |
| `src/layouts/app-shell.tsx` | Persistent Mantine AppShell, responsive navigation, account menu and quick navigation |
| `src/config/navigation.ts` | Route titles, descriptions, menu groups and admin visibility |
| `src/components/ui/` | Mantine application components; shared field, selection, table and modal contracts |
| `src/themes/context.tsx` | MantineProvider, appearance mode, accent color and preference persistence |
| `src/styles/globals.css` | Layer order, semantic tokens and manual dark variant |
| `src/styles/tailwind-theme.pcss` | Tailwind semantic token mapping; keep imported by globals.css |
| `src/styles/application.css` | Layout, surface, table, dialog and responsive styles |
| `src/pages/` | Route controllers and views; domain presentation modules next to large pages |
| `src/api/` | Existing HTTP and diagnosis stream contracts |
| `src/lib/notifications.tsx` | Mantine notifications shared by all pages |

## Conventions

- Use Mantine primitives for new UI. Reuse `src/components/ui/*` for shared application contracts.
- All production controls are backed by Mantine; do not reintroduce the old shadcn/HeroUI bridge, Radix packages, or HeroUI/NextUI packages.
- Preserve the raw JWT Authorization header (no Bearer prefix) and `{code,msg,data,ts}` response envelope.
- Global colors come from Mantine and semantic tokens; retain the tailwind-theme.pcss import.
- Dark utilities follow `data-mantine-color-scheme`, not an independent system media query.
- Navigation/headers come from the shared app shell. Avoid repeated page-level account menus or nested application shells.
- Keep errors, empty states, disabled controls, batch results, permission checks and mobile form scrolling functional.
- Do not add frontend tests or a new testing framework. Use the existing build, lint and browser verification.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm run dev      # :3000; /api and /system-info proxy to :6365
pnpm run build    # TypeScript and production build
pnpm run lint     # eslint --fix
```

`VITE_API_PROXY` overrides the backend target for local development. `VITE_API_BASE` still supports deployments with a separate API origin.

If a checkout provides `../.flvx-build.local`, source it before commands to use its local build/cache locations. This optional local file and artifact symlinks are excluded from Git. Use the repository's pnpm 10.28.1 for installs and lockfile changes.
