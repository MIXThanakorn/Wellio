import { useEffect, useState } from "react";
import { useJournal } from "./useJournal";
import type { Journal } from "../../lib/types";
export type UndoTicket = {
  collection: Exclude<keyof Journal, "preferences">;
  id: string;
  title: string;
  expires: number;
};
export const undoKey = (scope: string) => `wellio:undo:${scope}`;
export function forgetDeletion(scope: string) {
  try {
    localStorage.removeItem(undoKey(scope));
  } catch {}
  window.dispatchEvent(new Event("wellio-undo"));
}
export function rememberDeletion(scope: string, ticket: UndoTicket) {
  try {
    localStorage.setItem(undoKey(scope), JSON.stringify(ticket));
  } catch {}
  window.dispatchEvent(new Event("wellio-undo"));
}
export function UndoNotice({
  scope,
  onDone,
}: {
  scope: string;
  onDone: (text: string) => void;
}) {
  const journal = useJournal();
  const [ticket, setTicket] = useState<UndoTicket | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        const t = JSON.parse(localStorage.getItem(undoKey(scope)) || "null");
        if (t && t.expires <= Date.now())
          localStorage.removeItem(undoKey(scope));
        setTicket(t && t.expires > Date.now() ? t : null);
      } catch {
        setTicket(null);
      }
    };
    read();
    const timer = setInterval(read, 1000);
    window.addEventListener("wellio-undo", read);
    return () => {
      clearInterval(timer);
      window.removeEventListener("wellio-undo", read);
    };
  }, [scope]);
  if (!ticket) return null;
  return (
    <div className="undo-notice" role="status">
      <span>{error || `ลบ “${ticket.title}” แล้ว`}</span>
      <button
        className="button secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await journal.restore(ticket.collection, ticket.id);
            forgetDeletion(scope);
            setTicket(null);
            onDone("กู้คืนบันทึกแล้ว");
          } catch {
            setError("กู้คืนยังไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "กำลังกู้คืน…" : "เลิกทำ"}
      </button>
    </div>
  );
}
