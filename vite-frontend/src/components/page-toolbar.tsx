import type { ReactNode } from "react";

import { Badge, Button, SegmentedControl } from "@mantine/core";
import {
  LayoutGrid,
  List,
  SlidersHorizontal,
  SquareCheckBig,
} from "lucide-react";

export type ViewMode = "grid" | "list";

interface FilterControl {
  /** Number of active conditions, shown as a badge. */
  count?: number;
  disabled?: boolean;
  title?: string;
  onOpen: () => void;
  /** Shows a "清空条件" shortcut while conditions are active. */
  onClear?: () => void;
}

interface PrimaryAction {
  /** Verb shown on every screen, e.g. "新增". */
  label: string;
  /** Object appended on wider screens, e.g. "规则" → "新增规则". */
  noun?: string;
  icon: ReactNode;
  onClick: () => void;
}

interface PageToolbarProps {
  /** Segmented tabs that switch the dataset (local/remote, mine/remote…). */
  tabs?: ReactNode;
  search?: ReactNode;
  filter?: FilterControl;
  view?: { value: ViewMode; onChange: (value: ViewMode) => void };
  /** Extra controls placed before the primary action (batch mode, import/export…). */
  actions?: ReactNode;
  primary?: PrimaryAction;
}

/**
 * Shared list-page toolbar. Left: tabs, search, filter. Right: view toggle,
 * secondary actions, primary action — the same order on every page.
 */
export function PageToolbar({
  tabs,
  search,
  filter,
  view,
  actions,
  primary,
}: PageToolbarProps) {
  const filterCount = filter?.count ?? 0;

  return (
    <div className="page-toolbar">
      <div className="page-toolbar-start">
        {tabs}
        {search ? <div className="page-toolbar-search">{search}</div> : null}
        {filter ? (
          <>
            <Button
              aria-label="筛选"
              className="toolbar-icon-button"
              disabled={filter.disabled}
              leftSection={<SlidersHorizontal size={15} />}
              rightSection={
                !filter.disabled && filterCount > 0 ? (
                  <Badge size="xs">{filterCount}</Badge>
                ) : undefined
              }
              title={filter.title}
              variant="default"
              onClick={filter.onOpen}
            >
              <span className="hidden sm:inline">筛选</span>
            </Button>
            {filter.onClear && filterCount > 0 ? (
              <Button
                color="red"
                size="xs"
                variant="subtle"
                onClick={filter.onClear}
              >
                清空条件
              </Button>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="page-toolbar-end">
        {view ? (
          <ViewModeToggle value={view.value} onChange={view.onChange} />
        ) : null}
        {actions}
        {primary ? (
          <Button
            className="page-toolbar-primary"
            leftSection={primary.icon}
            onClick={primary.onClick}
          >
            {primary.label}
            {primary.noun ? (
              <span className="hidden sm:inline">{primary.noun}</span>
            ) : null}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  return (
    <SegmentedControl
      aria-label="显示方式"
      data={[
        {
          value: "grid",
          label: (
            <span className="flex items-center gap-1.5">
              <LayoutGrid size={15} />
              <span className="hidden sm:inline">卡片</span>
            </span>
          ),
        },
        {
          value: "list",
          label: (
            <span className="flex items-center gap-1.5">
              <List size={15} />
              <span className="hidden sm:inline">列表</span>
            </span>
          ),
        },
      ]}
      size="sm"
      value={value}
      onChange={(next) => onChange(next as ViewMode)}
    />
  );
}

/** Toggles multi-select mode on card/list pages. */
export function BatchModeButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      aria-label={active ? "完成批量操作" : "批量操作"}
      className="toolbar-icon-button"
      leftSection={<SquareCheckBig size={15} />}
      variant={active ? "light" : "default"}
      onClick={onToggle}
    >
      <span className="hidden sm:inline">{active ? "完成" : "批量"}</span>
    </Button>
  );
}
