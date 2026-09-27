import type { ReactNode } from "react";

import { Link } from "react-router-dom";
import { Text, ActionIcon } from "@mantine/core";
import { Moon, Sun } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { useSiteConfig } from "@/hooks/use-site-config";
import { useThemeContext } from "@/themes/context";
export default function DefaultLayout({ children }: { children: ReactNode }) {
  const config = useSiteConfig();
  const { effectiveMode, setMode } = useThemeContext();

  return (
    <div className="auth-layout">
      <header className="auth-header">
        <Link className="flex items-center gap-3" to="/">
          <div className="app-brand-mark">
            <BrandLogo size={24} />
          </div>
          <Text fw={700}>{config.name}</Text>
        </Link>
        <ActionIcon
          aria-label="切换深浅色"
          color="gray"
          variant="subtle"
          onClick={() => setMode(effectiveMode === "dark" ? "light" : "dark")}
        >
          {effectiveMode === "dark" ? <Sun size={19} /> : <Moon size={19} />}
        </ActionIcon>
      </header>
      <main>{children}</main>
    </div>
  );
}
