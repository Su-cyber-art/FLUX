// Every API response carries the backend release in X-Flux-Version. Comparing
// it with the release this bundle was built as tells an open tab that the
// panel has been upgraded underneath it.

const RELEASE = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9][A-Za-z0-9.-]*)?$/;

function normalize(version: unknown): string | null {
  if (typeof version !== "string") return null;
  const value = version.trim().replace(/^v/, "");

  return RELEASE.test(value) ? value : null;
}

export const BUILD_VERSION = normalize(import.meta.env.VITE_APP_VERSION);

export interface ServerVersionChange {
  version: string;
  /**
   * True when the backend changed while this tab was open (an upgrade just
   * happened). False when the tab was loaded against a different release,
   * e.g. a custom build; that case is only reported, never auto-reloaded.
   */
  upgradedDuringSession: boolean;
}

type Listener = (change: ServerVersionChange) => void;

let firstSeen: string | null = null;
let pending: ServerVersionChange | null = null;
const listeners = new Set<Listener>();

export function reportServerVersion(header: unknown) {
  const version = normalize(header);

  // Development builds and backends without a release version are skipped.
  if (!version || !BUILD_VERSION) return;
  firstSeen ??= version;
  if (version === BUILD_VERSION) {
    pending = null;

    return;
  }
  if (version === pending?.version) return;
  pending = { version, upgradedDuringSession: version !== firstSeen };
  listeners.forEach((listener) => listener(pending!));
}

export function onServerVersionChange(listener: Listener) {
  listeners.add(listener);
  if (pending) listener(pending);

  return () => {
    listeners.delete(listener);
  };
}

export function pendingServerVersion() {
  return pending;
}
