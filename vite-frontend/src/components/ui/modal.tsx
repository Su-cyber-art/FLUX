import * as React from "react";
import { Modal as MantineModal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";

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
}: ModalProps) {
  const mobile = useMediaQuery("(max-width: 47.99em)");
  const close = React.useCallback(() => {
    onOpenChange?.(false);
    onClose?.();
  }, [onClose, onOpenChange]);
  const positions = React.useRef<
    { element: HTMLElement; top: number; left: number }[]
  >([]);

  React.useLayoutEffect(() => {
    if (isOpen) {
      const frame = requestAnimationFrame(() =>
        positions.current.forEach(({ element, top, left }) => {
          element.scrollTop = top;
          element.scrollLeft = left;
        }),
      );

      return () => cancelAnimationFrame(frame);
    }

    return () => {
      positions.current = Array.from(
        document.querySelectorAll<HTMLElement>("main, [data-scroll-container]"),
      ).map((element) => ({
        element,
        top: element.scrollTop,
        left: element.scrollLeft,
      }));
    };
  }, [isOpen]);

  return (
    <ModalContext.Provider value={{ onClose: close, classNames }}>
      <MantineModal.Root
        centered
        className={className}
        closeOnClickOutside={isDismissable}
        closeOnEscape={isDismissable}
        fullScreen={Boolean(mobile && size !== "sm" && size !== "md")}
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
        transitionProps={{ duration: 150 }}
        yOffset={24}
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
      className={cn("app-modal-content", context.classNames?.base, className)}
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
      <MantineModal.CloseButton aria-label="关闭对话框" />
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
