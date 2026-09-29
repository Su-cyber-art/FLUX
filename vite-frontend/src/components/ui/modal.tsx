import * as React from "react";
import { Modal as MantineModal } from "@mantine/core";

import { cn } from "@/lib/utils";

type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "full";
interface ModalContextValue {
  onClose: () => void;
  classNames?: Record<string, string>;
}
const ModalContext = React.createContext<ModalContextValue>({
  onClose: () => {},
});

export function useDisclosure(options: { isOpen?: boolean } = {}) {
  const [isOpen, setOpen] = React.useState(Boolean(options.isOpen));
  const onOpen = React.useCallback(() => setOpen(true), []);
  const onClose = React.useCallback(() => setOpen(false), []);
  const onOpenChange = React.useCallback(
    (open?: boolean) => setOpen((previous) => open ?? !previous),
    [],
  );

  return { isOpen, onOpen, onClose, onOpenChange };
}
export interface ModalProps {
  children: React.ReactNode;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  size?: ModalSize;
  className?: string;
  classNames?: Record<string, string>;
  scrollBehavior?: "inside" | "outside";
  isDismissable?: boolean;
  backdrop?: "blur" | "opaque" | "transparent";
  placement?: "center" | "top" | "bottom";
}
export function Modal({
  children,
  isOpen = false,
  onClose,
  onOpenChange,
  size = "md",
  classNames,
  className,
  isDismissable = true,
  placement = "center",
}: ModalProps) {
  const close = React.useCallback(() => {
    onOpenChange?.(false);
    onClose?.();
  }, [onClose, onOpenChange]);

  return (
    <ModalContext.Provider value={{ onClose: close, classNames }}>
      <MantineModal.Root
        centered
        className={cn("app-modal", className)}
        classNames={{ inner: "app-modal-viewport" }}
        closeOnClickOutside={isDismissable}
        closeOnEscape={isDismissable}
        data-placement={placement}
        opened={isOpen}
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
        transitionProps={{ duration: 150, transition: "fade" }}
        zIndex={300}
        onClose={close}
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
}: Omit<React.ComponentProps<"div">, "children"> & {
  children?: React.ReactNode | ((onClose: () => void) => React.ReactNode);
}) {
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
      {typeof children === "function" ? children(context.onClose) : children}
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
