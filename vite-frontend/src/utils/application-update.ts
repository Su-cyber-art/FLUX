const UPDATE_CHECK_TIMEOUT = 5000;
const STALE_RELOAD_KEY = "flux:stale-asset-reload";
const STALE_RELOAD_WINDOW = 30_000;
let registration: Promise<ServiceWorkerRegistration | undefined> | undefined;
let refreshTask: Promise<void> | undefined;
let staleReloadStarted = false;

/**
 * The worker only caches hashed bundles and an offline copy of the shell.
 * Navigations are network-first and a new worker activates immediately, so
 * there is no "waiting" worker to prompt for; version changes are detected
 * from the API instead (see version-sync.ts).
 */
export function registerApplicationUpdates() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  const base = new URL(import.meta.env.BASE_URL, window.location.href);

  registration = navigator.serviceWorker
    .register(new URL("sw.js", base), {
      scope: base.pathname,
      updateViaCache: "none",
    })
    .catch(() => undefined);
}

function bounded<T>(task: Promise<T>, timeout: number): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout>;

  return Promise.race([
    task,
    new Promise<undefined>((resolve) => {
      timer = setTimeout(() => resolve(undefined), timeout);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function applyUpdateAndReload() {
  // Not required for correctness (the reload fetches the new shell from the
  // network), but it lets the new worker start precaching the new bundles.
  try {
    const current = await bounded(
      registration ?? Promise.resolve(undefined),
      UPDATE_CHECK_TIMEOUT,
    );

    if (current) await bounded(current.update(), UPDATE_CHECK_TIMEOUT);
  } catch {
    // An unreachable sw.js must never block the reload.
  }
  window.location.reload();
}

export function refreshApplication(): Promise<void> {
  refreshTask ??= applyUpdateAndReload().catch((error: unknown) => {
    refreshTask = undefined;
    throw error;
  });

  return refreshTask;
}

/**
 * After an upgrade an open tab still references the previous release's
 * bundles, which the new frontend container no longer serves. Reload once so
 * the tab picks up the new release; a second failure within the window is a
 * real error and is left to the error boundary.
 */
export function reloadForStaleAssets(): boolean {
  // Several chunks can fail together; they all wait for the same reload.
  if (staleReloadStarted) return true;
  try {
    const last = Number(sessionStorage.getItem(STALE_RELOAD_KEY) || 0);

    if (Date.now() - last < STALE_RELOAD_WINDOW) return false;
    sessionStorage.setItem(STALE_RELOAD_KEY, String(Date.now()));
  } catch {
    // Without storage there is no loop guard, so do not reload automatically.
    return false;
  }
  staleReloadStarted = true;
  window.location.reload();

  return true;
}
