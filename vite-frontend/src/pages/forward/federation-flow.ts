import { getPeerRemoteUsageList, getPeerShareList } from "@/api";
import { Forward } from "@/pages/forward/presentation";

export const parseShareIdFromTunnelName = (
  tunnelName: string,
): number | null => {
  const normalized = (tunnelName || "").trim();

  if (!normalized.startsWith("Share-")) {
    return null;
  }

  const raw = normalized.slice("Share-".length);
  const idx = raw.indexOf("-Port-");

  if (idx <= 0) {
    return null;
  }

  const shareId = Number(raw.slice(0, idx).trim());

  return Number.isFinite(shareId) && shareId > 0 ? shareId : null;
};

/** Adds an estimated share of federated (remote) tunnel traffic to each rule. */
export const mergeFederationShareFlow = async (
  forwardsData: Forward[],
): Promise<Forward[]> => {
  if (forwardsData.length === 0) {
    return forwardsData;
  }

  try {
    const [usageRes, localShareRes] = await Promise.all([
      getPeerRemoteUsageList(),
      getPeerShareList(),
    ]);

    const flowByShare = new Map<number, number>();
    const shareIdsByTunnel = new Map<number, Set<number>>();

    if (usageRes.code === 0 && Array.isArray(usageRes.data)) {
      usageRes.data.forEach((item: Record<string, unknown>) => {
        const shareId = Number(item.shareId || 0);
        const currentFlow = Number(item.currentFlow || 0);

        if (
          Number.isFinite(shareId) &&
          shareId > 0 &&
          Number.isFinite(currentFlow) &&
          currentFlow > 0
        ) {
          const prev = flowByShare.get(shareId) || 0;

          flowByShare.set(shareId, Math.max(prev, currentFlow));
        }

        if (Number.isFinite(shareId) && shareId > 0) {
          const bindings = Array.isArray(item.bindings)
            ? (item.bindings as Array<Record<string, unknown>>)
            : [];

          bindings.forEach((binding) => {
            const tunnelId = Number(binding.tunnelId || 0);
            const chainType = Number(binding.chainType || 0);

            if (!Number.isFinite(tunnelId) || tunnelId <= 0) {
              return;
            }

            if (Number.isFinite(chainType) && chainType !== 1) {
              return;
            }

            let shareSet = shareIdsByTunnel.get(tunnelId);

            if (!shareSet) {
              shareSet = new Set<number>();
              shareIdsByTunnel.set(tunnelId, shareSet);
            }

            shareSet.add(shareId);
          });
        }
      });
    }

    if (localShareRes.code === 0 && Array.isArray(localShareRes.data)) {
      localShareRes.data.forEach((item: Record<string, unknown>) => {
        const shareId = Number(item.id || 0);
        const currentFlow = Number(item.currentFlow || 0);

        if (
          Number.isFinite(shareId) &&
          shareId > 0 &&
          Number.isFinite(currentFlow) &&
          currentFlow > 0
        ) {
          const prev = flowByShare.get(shareId) || 0;

          flowByShare.set(shareId, Math.max(prev, currentFlow));
        }
      });
    }

    if (flowByShare.size === 0) {
      return forwardsData;
    }

    const resolveShareIdForForward = (forward: Forward): number | null => {
      const candidates = new Set<number>();
      const shareIdFromName = parseShareIdFromTunnelName(
        forward.tunnelName || "",
      );

      if (shareIdFromName) {
        candidates.add(shareIdFromName);
      }

      const tunnelId = Number(forward.tunnelId || 0);
      const shareSetByTunnel = shareIdsByTunnel.get(tunnelId);

      if (shareSetByTunnel && shareSetByTunnel.size > 0) {
        shareSetByTunnel.forEach((shareId) => {
          if (Number.isFinite(shareId) && shareId > 0) {
            candidates.add(shareId);
          }
        });
      }

      if (candidates.size === 0) {
        return null;
      }

      let bestShareId: number | null = null;
      let bestFlow = 0;

      candidates.forEach((shareId) => {
        const shareFlow = flowByShare.get(shareId) || 0;

        if (shareFlow > bestFlow) {
          bestFlow = shareFlow;
          bestShareId = shareId;
        }
      });

      return bestShareId;
    };

    const resolvedShareByForwardId = new Map<number, number>();

    forwardsData.forEach((forward) => {
      const shareId = resolveShareIdForForward(forward);

      if (shareId) {
        resolvedShareByForwardId.set(forward.id, shareId);
      }
    });

    const forwardCountByShare = new Map<number, number>();

    forwardsData.forEach((forward) => {
      const shareId = resolvedShareByForwardId.get(forward.id) || null;

      if (!shareId || !flowByShare.has(shareId)) {
        return;
      }

      forwardCountByShare.set(
        shareId,
        (forwardCountByShare.get(shareId) || 0) + 1,
      );
    });

    return forwardsData.map((forward) => {
      const shareId = resolvedShareByForwardId.get(forward.id) || null;

      if (!shareId) {
        return { ...forward, federationShareFlow: undefined };
      }

      const shareFlow = flowByShare.get(shareId) || 0;

      if (shareFlow <= 0) {
        return { ...forward, federationShareFlow: undefined };
      }

      const directFlow = (forward.inFlow || 0) + (forward.outFlow || 0);

      if (directFlow > 0) {
        return { ...forward, federationShareFlow: undefined };
      }

      const count = forwardCountByShare.get(shareId) || 1;
      const estimated = Math.max(1, Math.floor(shareFlow / count));

      return { ...forward, federationShareFlow: estimated };
    });
  } catch {
    return forwardsData;
  }
};
