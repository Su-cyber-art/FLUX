const UPDATE_TIMEOUT = 20000;
const INSTALL_TIMEOUT = 120000;
let registration: Promise<ServiceWorkerRegistration | undefined> | undefined;
let refreshTask: Promise<void> | undefined;

export function registerApplicationUpdates(onNeedRefresh: () => void) {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  const base = new URL(import.meta.env.BASE_URL, window.location.href);

  registration = navigator.serviceWorker
    .register(new URL("sw.js", base), {
      scope: base.pathname,
      updateViaCache: "none",
    })
    .then((next) => {
      const notify = () => {
        if (next.waiting && navigator.serviceWorker.controller) onNeedRefresh();
      };
      const watchInstall = () => {
        const worker = next.installing;

        if (!worker) return;
        const changed = () => {
          if (worker.state === "installing") return;
          worker.removeEventListener("statechange", changed);
          notify();
        };

        worker.addEventListener("statechange", changed);
        changed();
      };

      next.addEventListener("updatefound", watchInstall);
      watchInstall();
      notify();

      return next;
    })
    .catch(() => undefined);
}

function bounded<T>(task: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;

  return Promise.race([
    task,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("更新加载超时")),
        UPDATE_TIMEOUT,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

function waitForWorker(worker: ServiceWorker, controlling = false) {
  return new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      worker.removeEventListener("statechange", changed);
      navigator.serviceWorker.removeEventListener("controllerchange", changed);
      if (error) reject(error);
      else resolve();
    };
    const changed = () => {
      if (worker.state === "redundant") {
        finish(new Error("新页面安装失败"));
      } else if (
        controlling
          ? navigator.serviceWorker.controller === worker
          : ["installed", "activating", "activated"].includes(worker.state)
      ) {
        finish();
      }
    };
    const timer = setTimeout(
      () => finish(new Error("更新加载超时")),
      controlling ? UPDATE_TIMEOUT : INSTALL_TIMEOUT,
    );

    worker.addEventListener("statechange", changed);
    navigator.serviceWorker.addEventListener("controllerchange", changed);
    changed();
  });
}

async function applyUpdateAndReload() {
  if ("serviceWorker" in navigator) {
    const current = await bounded(
      registration?.then(
        (value) => value ?? navigator.serviceWorker.getRegistration(),
      ) ?? navigator.serviceWorker.getRegistration(),
    );

    if (current) {
      // The upgrade can finish before the browser has checked or downloaded
      // the new worker. A normal reload would still use its old cached HTML.
      await bounded(current.update());
      if (current.installing) await waitForWorker(current.installing);

      const waiting = current.waiting;

      if (waiting) {
        const controlling = waitForWorker(waiting, true);

        waiting.postMessage({ type: "SKIP_WAITING" });
        await controlling;
      } else if (
        current.active &&
        navigator.serviceWorker.controller !== current.active
      ) {
        await waitForWorker(current.active, true);
      }
    }
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
