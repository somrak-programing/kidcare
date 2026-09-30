import { useEffect, type RefObject } from "react";

/** Calls onClose when a pointerdown happens outside `ref` (only while `active`). */
export function useDismissOnOutside(ref: RefObject<HTMLElement>, onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [ref, onClose, active]);
}
