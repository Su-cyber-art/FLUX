import { Suspense, useEffect, useRef } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import ApplicationLayout from "@/layouts/app-shell";
import { PageLoadingState } from "@/components/page-state";
import { PageErrorBoundary } from "@/components/page-error-boundary";
import { isLoggedIn } from "@/utils/auth";
import { siteConfig, updateSiteConfig } from "@/config/site";
import { useSession } from "@/hooks/use-session";
import { useThemeContext } from "@/themes/context";
import { lazyPage } from "@/utils/lazy-page";
import { pendingServerVersion } from "@/utils/version-sync";

const IndexPage = lazyPage(() => import("@/pages/index"));
const ChangePasswordPage = lazyPage(() => import("@/pages/change-password"));
const DashboardPage = lazyPage(() => import("@/pages/dashboard"));
const MonitorPage = lazyPage(() => import("@/pages/monitor"));
const ForwardPage = lazyPage(() => import("@/pages/forward"));
const TunnelPage = lazyPage(() => import("@/pages/tunnel"));
const NodePage = lazyPage(() => import("@/pages/node"));
const UserPage = lazyPage(() => import("@/pages/user"));
const GroupPage = lazyPage(() => import("@/pages/group"));
const ProfilePage = lazyPage(() => import("@/pages/profile"));
const LimitPage = lazyPage(() => import("@/pages/limit"));
const ConfigPage = lazyPage(() => import("@/pages/config"));
const PanelSharingPage = lazyPage(() => import("@/pages/panel-sharing"));

function RequireSession() {
  const session = useSession();
  const location = useLocation();

  if (!isLoggedIn()) {
    const from =
      location.pathname === "/change-password"
        ? "/dashboard"
        : location.pathname;

    return <Navigate replace state={{ from }} to="/" />;
  }
  if (
    session.requirePasswordChange &&
    location.pathname !== "/change-password"
  ) {
    return <Navigate replace to="/change-password" />;
  }
  if (
    !session.requirePasswordChange &&
    location.pathname === "/change-password"
  ) {
    return <Navigate replace to="/dashboard" />;
  }

  return <Outlet />;
}
function LoginRoute() {
  const session = useSession();

  return isLoggedIn() ? (
    <Navigate
      replace
      to={session.requirePasswordChange ? "/change-password" : "/dashboard"}
    />
  ) : (
    <IndexPage />
  );
}
// Once the panel has been upgraded under an open tab, the next in-app
// navigation becomes a full page load so the new release is used without
// interrupting whatever the user is doing on the current page.
function useReloadOnNavigationAfterUpgrade() {
  const location = useLocation();
  const initial = useRef(true);

  useEffect(() => {
    if (initial.current) {
      initial.current = false;

      return;
    }
    if (pendingServerVersion()?.upgradedDuringSession) {
      window.location.reload();
    }
  }, [location.pathname]);
}

function App() {
  const { effectiveMode } = useThemeContext();

  useReloadOnNavigationAfterUpgrade();

  // 处理自定义背景图片
  useEffect(() => {
    const updateBg = () => {
      const customBg =
        (effectiveMode === "dark"
          ? siteConfig.app_bg_image_dark
          : siteConfig.app_bg_image_light) || siteConfig.app_bg_image;

      if (customBg) {
        if (customBg === "theme") {
          document.documentElement.style.removeProperty("--custom-bg-image");
          document.documentElement.style.removeProperty("--custom-bg-color");
          document.documentElement.classList.add("has-theme-bg");
          document.documentElement.classList.remove("has-custom-bg");
        } else if (
          customBg.startsWith("http") ||
          customBg.startsWith("data:") ||
          customBg.startsWith("/") ||
          customBg.startsWith("blob:")
        ) {
          document.documentElement.style.setProperty(
            "--custom-bg-image",
            `url(${customBg})`,
          );
          document.documentElement.style.setProperty(
            "--custom-bg-color",
            "transparent",
          );
          document.documentElement.classList.add("has-custom-bg");
          document.documentElement.classList.remove("has-theme-bg");
        } else {
          // Assume solid color like "#ffffff", "white", etc.
          document.documentElement.style.setProperty(
            "--custom-bg-image",
            "none",
          );
          document.documentElement.style.setProperty(
            "--custom-bg-color",
            customBg,
          );
          document.documentElement.classList.add("has-custom-bg");
          document.documentElement.classList.remove("has-theme-bg");
        }
      } else {
        document.documentElement.style.removeProperty("--custom-bg-image");
        document.documentElement.style.removeProperty("--custom-bg-color");
        document.documentElement.classList.remove("has-custom-bg");
        document.documentElement.classList.remove("has-theme-bg");
      }
    };

    updateBg();
    window.addEventListener("site-config-updated", updateBg);

    return () => {
      window.removeEventListener("site-config-updated", updateBg);
    };
  }, [effectiveMode]);

  // 立即设置页面标题（使用已从缓存读取的配置）
  useEffect(() => {
    document.title = siteConfig.name;

    void updateSiteConfig();

    const handleConfigUpdate = () => {
      void updateSiteConfig();
    };

    window.addEventListener("configUpdated", handleConfigUpdate);

    return () => {
      window.removeEventListener("configUpdated", handleConfigUpdate);
    };
  }, []);

  return (
    <PageErrorBoundary>
      <Suspense fallback={<PageLoadingState message="正在加载…" />}>
        <Routes>
          <Route element={<LoginRoute />} path="/" />
          <Route element={<RequireSession />}>
            <Route element={<ChangePasswordPage />} path="/change-password" />
            <Route element={<ApplicationLayout />}>
              <Route element={<DashboardPage />} path="/dashboard" />
              <Route element={<MonitorPage />} path="/monitor" />
              <Route element={<ForwardPage />} path="/forward" />
              <Route element={<TunnelPage />} path="/tunnel" />
              <Route element={<NodePage />} path="/node" />
              <Route element={<UserPage />} path="/user" />
              <Route element={<GroupPage />} path="/group" />
              <Route element={<ProfilePage />} path="/profile" />
              <Route element={<LimitPage />} path="/limit" />
              <Route element={<ConfigPage />} path="/config" />
              <Route element={<PanelSharingPage />} path="/panel-sharing" />
            </Route>
          </Route>
          <Route
            element={
              <Navigate replace to={isLoggedIn() ? "/dashboard" : "/"} />
            }
            path="*"
          />
        </Routes>
      </Suspense>
    </PageErrorBoundary>
  );
}
export default App;
