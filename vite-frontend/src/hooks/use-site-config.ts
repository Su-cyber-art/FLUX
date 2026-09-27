import { useEffect, useState } from "react";

import { siteConfig } from "@/config/site";
export function useSiteConfig() {
  const [config, setConfig] = useState(() => ({ ...siteConfig }));

  useEffect(() => {
    const sync = () => setConfig({ ...siteConfig });

    window.addEventListener("site-config-updated", sync);

    return () => window.removeEventListener("site-config-updated", sync);
  }, []);

  return config;
}
