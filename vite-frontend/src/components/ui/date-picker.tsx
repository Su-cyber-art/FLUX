import type { FieldMetaProps } from "./shared";

import { DateInput } from "@mantine/dates";
interface CalendarDateLike {
  year: number;
  month: number;
  day: number;
}
export interface DatePickerProps extends FieldMetaProps {
  className?: string;
  isDisabled?: boolean;
  onChange?: (value: CalendarDateLike | null) => void;
  showMonthAndYearPickers?: boolean;
  value?: CalendarDateLike | null;
}
export function DatePicker({
  value,
  onChange,
  isDisabled,
  isRequired,
  isInvalid,
  errorMessage,
  showMonthAndYearPickers: _showPickers,
  ...props
}: DatePickerProps) {
  const date = value
    ? `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`
    : null;

  return (
    <DateInput
      {...props}
      clearable
      disabled={isDisabled}
      error={isInvalid ? errorMessage || true : undefined}
      placeholder="选择日期"
      popoverProps={{ withinPortal: true, zIndex: 450 }}
      required={isRequired}
      value={date}
      valueFormat="YYYY-MM-DD"
      onChange={(next) => {
        if (!next) {
          onChange?.(null);

          return;
        }
        const [year, month, day] = next.split("-").map(Number);

        onChange?.({ year, month, day });
      }}
    />
  );
}
