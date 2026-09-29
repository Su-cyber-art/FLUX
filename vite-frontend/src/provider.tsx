import type { ReactNode } from "react";

import { Notifications } from "@mantine/notifications";
import { DatesProvider } from "@mantine/dates";

import "dayjs/locale/zh-cn";
import { ThemeProvider } from "@/themes/context";
import { useVisualViewport } from "@/hooks/use-visual-viewport";

export function Provider({ children }: { children: ReactNode }) {
  useVisualViewport();

  return (
    <ThemeProvider>
      <DatesProvider settings={{ locale: "zh-cn", firstDayOfWeek: 1 }}>
        {children}
        <Notifications limit={4} position="top-right" zIndex={600} />
      </DatesProvider>
    </ThemeProvider>
  );
}
