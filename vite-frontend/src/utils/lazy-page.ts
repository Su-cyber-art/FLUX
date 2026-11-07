import { type ComponentType, lazy } from "react";

import { reloadForStaleAssets } from "@/utils/application-update";

/**
 * React.lazy for route pages. If the page's bundle is gone because the panel
 * was upgraded while this tab was open, reload into the new release instead
 * of showing a broken page.
 */
export function lazyPage<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    load().catch((error: unknown) => {
      if (reloadForStaleAssets()) return new Promise<never>(() => {});
      throw error;
    }),
  );
}
