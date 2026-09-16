"use client";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * Toasts, in about a hundred lines and no dependency.
 *
 * Deliberately NOT the place for form validation. A wrong amount belongs next
 * to the amount field, where the user is looking and where it stays put.
 * Toasts here confirm something that already happened and then get out of the
 * way — "Entry saved" after the sheet has closed.
 *
 * That split also sidesteps a real constraint: a modal <dialog> renders in the
 * browser's top layer, above everything in normal DOM. A toast raised while a
 * sheet is open would be hidden behind it. Sheets keep their errors inline;
 * toasts fire once a sheet has closed.
 */

type Tone = "ok" | "error";

type Toast = {
  id: number;
  message: string;
  tone: Tone;
};

type ShowToast = (message: string, tone?: Tone) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

const VISIBLE_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback<ShowToast>((message, tone = "ok") => {
    nextId.current += 1;
    const id = nextId.current;
    // Only ever one on screen: this is a phone, and a stack of toasts covers
    // the very thing the user just changed.
    setToasts([{ id, message, tone }]);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        // polite, not assertive: these confirm rather than interrupt.
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col
                   items-center gap-2 px-4 pb-6"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <button
      type="button"
      onClick={() => onDismiss(toast.id)}
      role={toast.tone === "error" ? "alert" : "status"}
      className={`pointer-events-auto w-full max-w-sm rounded-xl px-4 py-3 text-left
                  text-base font-medium text-white shadow-lg ${
                    toast.tone === "error" ? "bg-due" : "bg-ink"
                  }`}
    >
      {toast.message}
    </button>
  );
}
