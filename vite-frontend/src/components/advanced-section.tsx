import type { ReactNode } from "react";

import { Accordion } from "@mantine/core";

/** Collapsed-by-default "advanced settings" block used at the end of long forms. */
export function AdvancedSection({
  title = "高级设置",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <Accordion className="px-0" variant="default">
      <Accordion.Item className="border-b-0" value="advanced">
        <Accordion.Control aria-label={title}>
          <span className="text-small text-default-500 font-medium">
            {title}
          </span>
        </Accordion.Control>
        <Accordion.Panel>{children}</Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
