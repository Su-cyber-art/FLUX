import { Component, type ReactNode } from "react";
import { Alert, Stack } from "@mantine/core";
import { RefreshCw } from "lucide-react";

import { RefreshApplicationButton } from "@/components/refresh-application-button";

export class PageErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <Alert color="red" m="md" title="页面暂时无法加载">
        <Stack gap="sm">
          <span>请重新加载页面后重试。</span>
          <RefreshApplicationButton
            color="red"
            leftSection={<RefreshCw size={14} />}
            size="xs"
            variant="light"
          >
            重新加载
          </RefreshApplicationButton>
        </Stack>
      </Alert>
    );
  }
}
