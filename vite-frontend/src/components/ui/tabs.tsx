import * as React from "react";
import { Tabs as MantineTabs } from "@mantine/core";
export interface TabProps {
  children: React.ReactNode;
  title: React.ReactNode;
}
export function Tab(_props: TabProps) {
  return null;
}
export interface TabsProps {
  "aria-label"?: string;
  children: React.ReactNode;
  disableCursorAnimation?: boolean;
  onSelectionChange?: (key: React.Key) => void;
  selectedKey?: React.Key;
}
export function Tabs({
  children,
  selectedKey,
  onSelectionChange,
  "aria-label": label,
}: TabsProps) {
  const tabs: {
    value: string;
    title: React.ReactNode;
    content: React.ReactNode;
  }[] = [];

  React.Children.forEach(children, (child, index) => {
    if (React.isValidElement<TabProps>(child) && child.type === Tab)
      tabs.push({
        value: String(child.key ?? index),
        title: child.props.title,
        content: child.props.children,
      });
  });
  const [internal, setInternal] = React.useState<string | null>(
    tabs[0]?.value ?? null,
  );

  return (
    <MantineTabs
      value={selectedKey === undefined ? internal : String(selectedKey)}
      onChange={(value) => {
        setInternal(value);
        if (value !== null) onSelectionChange?.(value);
      }}
    >
      <MantineTabs.List aria-label={label}>
        {tabs.map((tab) => (
          <MantineTabs.Tab key={tab.value} value={tab.value}>
            {tab.title}
          </MantineTabs.Tab>
        ))}
      </MantineTabs.List>
      {tabs.map((tab) => (
        <MantineTabs.Panel key={tab.value} pt="lg" value={tab.value}>
          {tab.content}
        </MantineTabs.Panel>
      ))}
    </MantineTabs>
  );
}
