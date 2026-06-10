import { type ReactNode, useEffect, useId, useRef } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}): JSX.Element {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusables = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="report-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={onClose}>
      <div className="report-modal-box" ref={panelRef} onClick={(event) => event.stopPropagation()}>
        <div className="report-modal-header">
          <h2 className="report-modal-title" id={titleId}>
            {title}
          </h2>
          <button
            ref={closeRef}
            className="report-close"
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
          >
            ✕
          </button>
        </div>
        <div className="ui-modal-body">{children}</div>
      </div>
    </div>
  );
}
