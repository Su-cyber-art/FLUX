import { useState } from "react";
import { Button, type ButtonProps } from "@mantine/core";

import { toast } from "@/lib/notifications";
import { refreshApplication } from "@/utils/application-update";

export function RefreshApplicationButton({
  children = "刷新页面",
  ...props
}: Omit<ButtonProps, "loading" | "onClick">) {
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      await refreshApplication();
    } catch {
      setLoading(false);
      toast.error("新页面暂时无法加载，请检查网络后重试");
    }
  };

  return (
    <Button {...props} loading={loading} onClick={() => void refresh()}>
      {loading ? "正在加载新页面…" : children}
    </Button>
  );
}
