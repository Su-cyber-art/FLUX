import { useLayoutEffect } from "react";

// iOS keeps the layout viewport tall when the keyboard covers part of it.
// Overlay positioning follows the visible area while pinch zoom stays native.
export function useVisualViewport() {
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    let revealFocusedField = false;

    const update = () => {
      if (viewport && Math.abs(viewport.scale - 1) > 0.01) return;

      root.style.setProperty(
        "--app-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      root.style.setProperty(
        "--app-viewport-top",
        `${viewport?.offsetTop ?? 0}px`,
      );
      // Safari may scroll to the focused field before the keyboard resize has
      // finished. Recheck against the modal body after applying its new height.
      if (revealFocusedField) {
        revealFocusedField = false;
        const field = document.activeElement;

        if (
          !(field instanceof HTMLElement) ||
          !field.matches("input, textarea, [contenteditable=true]")
        )
          return;
        const body = field.closest<HTMLElement>(".app-modal-body");

        if (!body) return;
        const fieldRect = field.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();

        if (fieldRect.bottom > bodyRect.bottom - 12) {
          body.scrollTop += fieldRect.bottom - bodyRect.bottom + 12;
        } else if (fieldRect.top < bodyRect.top + 12) {
          body.scrollTop -= bodyRect.top - fieldRect.top + 12;
        }
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const resize = () => {
      revealFocusedField = true;
      schedule();
    };

    update();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", resize);
    document.addEventListener("focusin", resize);

    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      document.removeEventListener("focusin", resize);
      root.style.removeProperty("--app-viewport-height");
      root.style.removeProperty("--app-viewport-top");
    };
  }, []);
}
