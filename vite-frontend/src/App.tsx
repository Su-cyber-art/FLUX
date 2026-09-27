import { lazy, Suspense, useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import ApplicationLayout from "@/layouts/app-shell";
import { PageLoadingState } from "@/components/page-state";
import { PageErrorBoundary } from "@/components/page-error-boundary";
import { isLoggedIn } from "@/utils/auth";
import { siteConfig, updateSiteConfig } from "@/config/site";
import { useSession } from "@/hooks/use-session";
import { useThemeContext } from "@/themes/context";

const IndexPage = lazy(() => import("@/pages/index"));
const ChangePasswordPage = lazy(() => import("@/pages/change-password"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const MonitorPage = lazy(() => import("@/pages/monitor"));
const ForwardPage = lazy(() => import("@/pages/forward"));
const TunnelPage = lazy(() => import("@/pages/tunnel"));
const NodePage = lazy(() => import("@/pages/node"));
const UserPage = lazy(() => import("@/pages/user"));
const GroupPage = lazy(() => import("@/pages/group"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const LimitPage = lazy(() => import("@/pages/limit"));
const ConfigPage = lazy(() => import("@/pages/config"));
const PanelSharingPage = lazy(() => import("@/pages/panel-sharing"));

function RequireSession() {
  useSession();
  const location = useLocation();

  return isLoggedIn() ? (
    <Outlet />
  ) : (
    <Navigate replace state={{ from: location.pathname }} to="/" />
  );
}
function LoginRoute() {
  useSession();

  return isLoggedIn() ? <Navigate replace to="/dashboard" /> : <IndexPage />;
}
function App() {
  const { effectiveMode } = useThemeContext();

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
