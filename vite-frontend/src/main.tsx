import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Button, Group, Stack, Text } from "@mantine/core";

import App from "./App.tsx";
import { Provider } from "./provider.tsx";

import toast from "@/lib/notifications";
import { RefreshApplicationButton } from "@/components/refresh-application-button";
import { registerApplicationUpdates } from "@/utils/application-update";
import "@/styles/globals.css";

registerApplicationUpdates(() => {
  toast(
    (t) => (
      <Stack gap="sm">
        <Text fw={500} size="sm">
          发现新版本，是否立即刷新以应用更新？
        </Text>
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
