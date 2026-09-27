import { ActionIcon, TextInput } from "@mantine/core";
import { Search, X } from "lucide-react";
interface SearchBarProps {
  isVisible: boolean;
  value: string;
  placeholder?: string;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}
export function SearchBar({
  value,
  placeholder = "搜索",
  onChange,
  onOpen,
  onClose,
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
            onClick={() => {
              onChange("");
              onClose();
            }}
          >
            <X size={13} />
          </ActionIcon>
        ) : undefined
      }
      size="sm"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      onFocus={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit?.();
        }
      }}
    />
  );
}
