import type { SystemUpgradeJob } from "@/api/types";

import { useCallback, useEffect, useRef, useState } from "react";

import { getSystemUpgradeStatus } from "@/api";

const cacheKey = "flux:active-panel-upgrade";
const readCachedJob = (): SystemUpgradeJob | null => {
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey) || "null");

    return value?.status === "running" &&
      typeof value.id === "string" &&
      typeof value.stage === "string" &&
      typeof value.message === "string" &&
      Array.isArray(value.events)
      ? value
      : null;
  } catch {
    return null;
  }
};

function cacheJob(job: SystemUpgradeJob | null) {
  try {
    if (job?.status === "running")
      localStorage.setItem(cacheKey, JSON.stringify(job));
    else localStorage.removeItem(cacheKey);
  } catch {
    // The server remains the source of truth when browser storage is full.
  }
}

export function useSystemUpgrade(enabled: boolean) {
  const [job, setJob] = useState<SystemUpgradeJob | null>(readCachedJob);
  const lastJob = useRef(job);
  const [reconnecting, setReconnecting] = useState(false);
  const [revision, setRevision] = useState(0);

  const track = useCallback((next: SystemUpgradeJob) => {
    lastJob.current = next;
    cacheJob(next);
    setJob(next);
    setReconnecting(false);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const result = await getSystemUpgradeStatus();

      if (disposed) return;
      let active = lastJob.current?.status === "running";

      if (result.code === 0) {
        const latest = result.data ?? null;

        lastJob.current = latest;
        setJob(latest);
        setReconnecting(false);
        active = latest?.status === "running";
        cacheJob(latest);
      } else {
        setReconnecting(active);
      }
      timer = setTimeout(() => void poll(), active ? 1500 : 10000);
    };

    void poll();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
    };
  }, [enabled, revision]);

  return {
    job,
    track,
    reconnecting,
    refresh: () => setRevision((value) => value + 1),
  };
}
