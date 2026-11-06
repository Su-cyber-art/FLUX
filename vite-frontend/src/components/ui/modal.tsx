import * as React from "react";
import { Modal as MantineModal } from "@mantine/core";

import { cn } from "@/lib/utils";

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "full";
interface ModalContextValue {
  classNames?: Record<string, string>;
}
const ModalContext = React.createContext<ModalContextValue>({});

export interface ModalProps {
  children: React.ReactNode;
  opened: boolean;
  onClose: () => void;
  size?: ModalSize;
  className?: string;
  classNames?: Record<string, string>;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  /** Raise above other open modals (default layer is 300). */
  zIndex?: number;
}
/**
 * Application dialog: Mantine Modal primitives with a fixed header/footer and a
 * scrolling body. Compose with ModalContent > ModalHeader / ModalBody / ModalFooter.
 */
export function Modal({
  children,
  opened,
  onClose,
  size = "md",
  classNames,
  className,
  closeOnClickOutside = true,
  closeOnEscape = true,
  zIndex = 300,
}: ModalProps) {
  return (
    <ModalContext.Provider value={{ classNames }}>
      <MantineModal.Root
        centered
        className={cn("app-modal", className)}
        classNames={{ inner: "app-modal-viewport" }}
        closeOnClickOutside={closeOnClickOutside}
        closeOnEscape={closeOnEscape}
        opened={opened}
        size={
          {
            sm: 420,
            md: 520,
            lg: 680,
            xl: 800,
            "2xl": 1000,
            "4xl": 1180,
            full: "95vw",
          }[size]
        }
        transitionProps={{
          duration: 220,
          exitDuration: 160,
          transition: "pop",
          timingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        zIndex={zIndex}
        onClose={onClose}
      >
        <MantineModal.Overlay backgroundOpacity={0.35} />
        {children}
      </MantineModal.Root>
    </ModalContext.Provider>
  );
}
export function ModalContent({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  const context = React.useContext(ModalContext);

  return (
    <MantineModal.Content
      {...props}
      // Mantine also forwards Content.className to its positioning container.
      // Assign the content slot explicitly so flex/size styles never leak there.
      classNames={{
        content: cn("app-modal-content", context.classNames?.base, className),
      }}
    >
      {children}
    </MantineModal.Content>
  );
}
export function ModalHeader({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  const context = React.useContext(ModalContext);

  return (
    <MantineModal.Header {...props} className="app-modal-header">
      <MantineModal.Title
        className={cn("min-w-0 flex-1", context.classNames?.header, className)}
        component="div"
      >
        {children}
      </MantineModal.Title>
      <MantineModal.CloseButton aria-label="关闭对话框" size="lg" />
    </MantineModal.Header>
  );
}
export function ModalBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const context = React.useContext(ModalContext);

  return (
    <MantineModal.Body
      {...props}
      className={cn(
        "app-modal-body space-y-4",
        context.classNames?.body,
        className,
      )}
      data-slot="modal-body"
    />
  );
}
export function ModalFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const context = React.useContext(ModalContext);

  return (
    <div
      {...props}
      className={cn("app-modal-footer", context.classNames?.footer, className)}
    />
  );
}
