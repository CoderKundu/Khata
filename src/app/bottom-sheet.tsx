"use client";

import { type ReactNode, useEffect, useRef } from "react";

/**
 * A bottom sheet built on the native <dialog>.
 *
 * Using the real element rather than a div means Escape, focus trapping, the
 * backdrop, and inertness of the page behind all come from the browser and
 * cannot drift out of sync with our own state. No component library, as the
 * spec requires — this is about fifty lines instead.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();

      /*
       * showModal() puts focus on the first focusable element in the dialog,
       * which here is the close button — it overrides React's autoFocus, and
       * the effect that would move focus runs before this one anyway. So the
       * sheet does it explicitly, afterwards: the field marked
       * data-autofocus gets focus, which on a phone is what raises the
       * keyboard. Without this, "Add goods" opens a sheet you then have to tap
       * again before you can type a number.
       */
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      // Escape and the close() call both fire this, so state follows the
      // browser rather than the other way round.
      onClose={onClose}
      onCancel={onClose}
      // A click landing on the dialog element itself is a click on the
      // backdrop: the content is in a child, so it never targets this node.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="inset-0 mx-auto mt-auto mb-0 w-full max-w-md rounded-t-2xl bg-surface p-0
                 max-h-[88dvh] backdrop:bg-black/40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex flex-col max-h-[88dvh]">
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 shrink-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="tap flex items-center justify-center text-2xl text-ink-soft"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto">{children}</div>
      </div>
    </dialog>
  );
}
