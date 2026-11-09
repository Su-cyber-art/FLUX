import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Button, Group, Stack, Text } from "@mantine/core";

import App from "./App.tsx";
import { Provider } from "./provider.tsx";

import toast from "@/lib/notifications";
import { RefreshApplicationButton } from "@/components/refresh-application-button";
import {
  registerApplicationUpdates,
  reloadForStaleAssets,
} from "@/utils/application-update";
import { BUILD_VERSION, onServerVersionChange } from "@/utils/version-sync";
import "@fontsource-variable/geist/wght.css";
import "@fontsource-variable/geist-mono/wght.css";
import "@/styles/globals.css";

registerApplicationUpdates();

// A lazily loaded page from the previous release no longer exists after an
// upgrade; reload once to pick up the new bundles.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForStaleAssets()) event.preventDefault();
});

onServerVersionChange(({ version, upgradedDuringSession }) => {
  toast(
    (t) => (
      <Stack gap="sm">
        <Text fw={500} size="sm">
          {upgradedDuringSession
            ? `面板已升级到 ${version}，刷新后即可使用新版本`
            : `当前页面版本 ${BUILD_VERSION} 与面板版本 ${version} 不一致，建议刷新`}
        </Text>
        {upgradedDuringSession && (
          <Text c="dimmed" size="xs">
            切换页面时也会自动加载新版本。
          </Text>
        )}
        <Group gap="xs" justify="flex-end">
          <RefreshApplicationButton size="xs">刷新</RefreshApplicationButton>
          <Button
            size="xs"
            variant="default"
            onClick={() => toast.dismiss(t.id)}
          >
            稍后
          </Button>
        </Group>
      </Stack>
    ),
    {
      id: "flux-frontend-update",
      duration: Infinity,
      position: "bottom-right",
    },
  );
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Provider>
      <App />
    </Provider>
  </BrowserRouter>,
);
