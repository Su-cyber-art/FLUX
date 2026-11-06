import { TextInput, Select } from "@mantine/core";

import {
  parseTrafficInput,
  TRAFFIC_UNIT_MIB,
  type TrafficUnit,
} from "@/utils/traffic";

const UNITS: TrafficUnit[] = ["MB", "GB", "TB", "PB"];

interface TrafficLimitFieldProps {
  label: string;
  value: string;
  unit: TrafficUnit;
  onChange: (value: string, unit: TrafficUnit) => void;
  description?: string;
  isRequired?: boolean;
}

export function TrafficLimitField({
  label,
  value,
  unit,
  onChange,
  description,
  isRequired,
}: TrafficLimitFieldProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
      <TextInput
        description={description}
        label={label}
        min="0"
        required={isRequired}
        step="any"
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value, unit)}
      />
      <Select
        aria-label={`${label}单位`}
        data={UNITS}
        label="单位"
        value={unit}
        onChange={(selected) => {
          const nextUnit = selected as TrafficUnit | null;

          if (!nextUnit) return;
          const mib = parseTrafficInput(value, unit);

          onChange(
            mib === null ? value : String(mib / TRAFFIC_UNIT_MIB[nextUnit]),
            nextUnit,
          );
        }}
      />
    </div>
  );
}
