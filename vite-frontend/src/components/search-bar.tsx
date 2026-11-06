import { ActionIcon, TextInput } from "@mantine/core";
import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  /** Called on Enter, for lists that search on the server. */
  onSubmit?: () => void;
}

export function SearchBar({
  value,
  placeholder = "搜索",
  onChange,
  onSubmit,
}: SearchBarProps) {
  return (
    <TextInput
      aria-label={placeholder}
      className="w-full min-w-40"
      leftSection={<Search size={15} />}
      placeholder={placeholder}
      rightSection={
        value ? (
          <ActionIcon
            aria-label="清空搜索"
            color="gray"
            size="xs"
            variant="subtle"
            onClick={() => onChange("")}
          >
            <X size={13} />
          </ActionIcon>
        ) : undefined
      }
      size="sm"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit?.();
        }
      }}
    />
  );
}
