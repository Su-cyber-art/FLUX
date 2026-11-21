import type { ReactNode } from "react";

import { Link } from "react-router-dom";
import { ActionIcon, Tooltip } from "@mantine/core";
import { Moon, Sun } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { VersionFooter } from "@/components/version-footer";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useWebViewMode } from "@/hooks/useWebViewMode";
import { useThemeContext } from "@/themes/context";

/** Unauthenticated shell: brand above a centered form card on a quiet canvas. */
export default function DefaultLayout({ children }: { children: ReactNode }) {
  const config = useSiteConfig();
  const isWebView = useWebViewMode();
  const { effectiveMode, setMode } = useThemeContext();
  const nextMode = effectiveMode === "dark" ? "浅色" : "深色";

  return (
    <div className="auth-shell">
      <div className="auth-toolbar">
        <Tooltip label={`切换到${nextMode}模式`} position="left">
          <ActionIcon
            aria-label="切换深浅色"
            color="gray"
            size="lg"
            variant="subtle"
            onClick={(event) =>
              setMode(effectiveMode === "dark" ? "light" : "dark", {
                x: event.clientX,
                y: event.clientY,
              })
            }
          >
            {effectiveMode === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </ActionIcon>
        </Tooltip>
      </div>
      <main className="auth-main">
        <Link className="auth-brand" to="/">
          <span className="app-brand-mark auth-brand-mark">
            <BrandLogo size={22} />
          </span>
          <span className="auth-brand-name">{config.name}</span>
        </Link>
        {children}
      </main>
      <VersionFooter
        containerClassName="auth-footer"
        poweredClassName="auth-footer-powered"
        version={isWebView ? config.app_version : config.version}
        versionClassName="auth-footer-version"
      />
    </div>
  );
}
