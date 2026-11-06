import type { ReactNode } from "react";

import { Text, type ComboboxItem, type SelectProps } from "@mantine/core";

export interface DescribedOption {
  value: string;
  label: string;
  description?: ReactNode;
  disabled?: boolean;
}

/**
 * Select `data` + `renderOption` for options that show a second, dimmed line.
 * Mantine's option items only carry value/label, so descriptions are looked up by value.
 */
export function describedSelectProps(
  options: DescribedOption[],
): Pick<SelectProps, "data" | "renderOption"> {
  const descriptions = new Map(
    options.map((option) => [option.value, option.description]),
  );

  return {
    data: options.map(
      ({ value, label, disabled }): ComboboxItem => ({
        value,
        label,
        disabled,
      }),
    ),
    renderOption: ({ option }) => {
      const description = descriptions.get(option.value);

      return (
        <div className="min-w-0">
          <Text size="sm">{option.label}</Text>
          {description ? (
            <Text c="dimmed" size="xs">
              {description}
            </Text>
          ) : null}
        </div>
      );
    },
  };
}
