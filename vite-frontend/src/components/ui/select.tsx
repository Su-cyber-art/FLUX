import * as React from "react";
import { Select as MantineSelect, MultiSelect, Text } from "@mantine/core";

import { extractText, type FieldMetaProps } from "./shared";

import { cn } from "@/lib/utils";

type SelectionValue = Iterable<React.Key>;
export interface SelectItemProps {
  children?: React.ReactNode;
  description?: React.ReactNode;
  textValue?: string;
}
export function SelectItem(_props: SelectItemProps) {
  return null;
}
export interface SelectProps<T = unknown> extends FieldMetaProps {
  "aria-label"?: string;
  children?: React.ReactNode | ((item: T) => React.ReactNode);
  items?: Iterable<T>;
  className?: string;
  classNames?: Record<string, string>;
  disabledKeys?: SelectionValue;
  selectedKeys?: SelectionValue;
  selectionMode?: "single" | "multiple";
  onSelectionChange?: (keys: Set<React.Key>) => void;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  isDisabled?: boolean;
  placeholder?: string;
  size?: "sm" | "md" | "lg";
  variant?: string;
  dropdownPlacement?: "bottom" | "top";
}
interface Option {
  value: string;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
}
function parseOptions(
  children: React.ReactNode,
  result: Option[] = [],
): Option[] {
  React.Children.forEach(children, (child, index) => {
    if (!React.isValidElement<SelectItemProps>(child)) return;
    if (child.type === React.Fragment) {
      parseOptions(child.props.children, result);

      return;
    }
    if (child.type === SelectItem)
      result.push({
        value: String(child.key ?? index),
        label: child.props.textValue || extractText(child.props.children),
        description: child.props.description,
      });
  });

  return result;
}
export function Select<T>({
  children,
  items,
  selectedKeys,
  disabledKeys,
  selectionMode = "single",
  onSelectionChange,
  onChange,
  onClick,
  isDisabled,
  isInvalid,
  errorMessage,
  isRequired,
  classNames,
  className,
  dropdownPlacement = "bottom",
  variant: _variant,
  size = "sm",
  ...props
}: SelectProps<T>) {
  const [internal, setInternal] = React.useState<string[]>([]);
  const values =
    selectedKeys === undefined ? internal : Array.from(selectedKeys, String);
  const options = React.useMemo(() => {
    const nodes =
      typeof children === "function"
        ? Array.from(items || [], children)
        : children;
    const disabled = new Set(Array.from(disabledKeys || [], String));

    return parseOptions(nodes).map((option) => ({
      ...option,
      disabled: disabled.has(option.value),
    }));
  }, [children, items, disabledKeys]);
  const update = (next: string[]) => {
    const disabled = new Set(Array.from(disabledKeys || [], String));
    const selection =
      selectionMode === "multiple"
        ? Array.from(
            new Set([
              ...next,
              ...values.filter((value) => disabled.has(value)),
            ]),
          )
        : next;

    setInternal(selection);
    onSelectionChange?.(new Set(selection));
    const target = {
      value: selection[0] || "",
      selectedOptions: selection.map((value) => ({ value })),
    } as unknown as HTMLSelectElement;

    onChange?.({
      target,
      currentTarget: target,
    } as React.ChangeEvent<HTMLSelectElement>);
  };
  const common = {
    ...props,
    classNames: { input: classNames?.trigger },
    data: options,
    disabled: isDisabled,
    required: isRequired,
    error: isInvalid ? errorMessage || true : undefined,
    size,
    searchable: options.length > 6,
    nothingFoundMessage: "没有匹配项",
    comboboxProps: {
      withinPortal: true,
      zIndex: 450,
      middlewares: { flip: true, shift: { padding: 12 } },
      position:
        dropdownPlacement === "top" ? ("top" as const) : ("bottom" as const),
    },
    renderOption: ({
      option,
    }: {
      option: { value: string; label: string };
    }) => (
      <div className="min-w-0">
        <Text size="sm">{option.label}</Text>
        {options.find((item) => item.value === option.value)?.description && (
          <Text c="dimmed" size="xs">
            {options.find((item) => item.value === option.value)?.description}
          </Text>
        )}
      </div>
    ),
  };

  return (
    <div
      className={cn("min-w-0 w-full", classNames?.base, className)}
      role="presentation"
      onClick={onClick}
    >
      {selectionMode === "multiple" ? (
        <MultiSelect
          {...common}
          clearable
          clearButtonProps={{ "aria-label": "清除选择" }}
          value={values}
          onChange={update}
        />
      ) : (
        <MantineSelect
          {...common}
          allowDeselect={false}
          clearButtonProps={{ "aria-label": "清除选择" }}
          clearable={!isRequired}
          value={values[0] ?? null}
          onChange={(value) => update(value === null ? [] : [value])}
        />
      )}
    </div>
  );
}
