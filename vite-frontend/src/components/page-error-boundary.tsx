import { Component, type ReactNode } from "react";
import { Alert, Button, Stack } from "@mantine/core";
import { RefreshCw } from "lucide-react";

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
          <Button
            color="red"
            leftSection={<RefreshCw size={14} />}
            size="xs"
            variant="light"
            onClick={() => window.location.reload()}
          >
            重新加载
          </Button>
        </Stack>
      </Alert>
    );
  }
}
