import { useEffect, useRef, type ReactNode } from "react";
import { X, Plus, ArrowRight, Sprout } from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = () => {
    if (!busy) onClose();
  };
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    const close = (e: Event) => {
      e.preventDefault();
      closeHandler.current();
    };
    dialog.addEventListener("cancel", close);
    return () => {
      dialog.removeEventListener("cancel", close);
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          aria-label="ปิด"
          className="icon-button"
          disabled={busy}
          onClick={onClose}
        >
          <X size={22} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Empty({
  title = "ยังไม่มีบันทึกในวันนี้",
  description = "เริ่มจากเรื่องเล็กๆ ที่อยากจดไว้ก็พอ",
  action,
  onAction,
}: {
  title?: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <Sprout size={34} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button className="button secondary" onClick={onAction}>
          <Plus size={18} />
          {action}
        </button>
      )}
    </div>
  );
}
export function SectionTitle({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
export function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      {message}
      {onRetry && (
        <button className="text-button" onClick={onRetry}>
          ลองอีกครั้ง
        </button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="skeleton-grid" aria-label="กำลังโหลด" aria-busy="true">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div className="skeleton" key={n} />
      ))}
    </div>
  );
}
