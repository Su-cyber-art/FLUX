import { useLayoutEffect } from "react";

// iOS keeps the layout viewport tall when the keyboard covers part of it.
// Overlay positioning follows the visible area while pinch zoom stays native.
export function useVisualViewport() {
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;

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
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.style.removeProperty("--app-viewport-height");
      root.style.removeProperty("--app-viewport-top");
    };
  }, []);
}
