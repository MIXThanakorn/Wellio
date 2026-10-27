import { useState } from "react";
import { Pencil, Trash2, Star } from "lucide-react";
import { dayKey, timeLabel } from "../../lib/dates";
import {
  activityLabels,
  mealLabels,
  type EntryKind,
  type Journal,
} from "../../lib/types";
import { kindIcons } from "./EntryForm";
import { useUI } from "../../components/AppShell";
import { useJournal } from "./useJournal";
import { Empty, Modal, ErrorBox } from "../../components/ui";
interface Item {
  id: string;
  kind: EntryKind;
  title: string;
  detail: string;
  at: string;
  notes: string | null;
  row: Record<string, unknown>;
}
export function timelineItems(data: Journal, day?: string): Item[] {
  return [
    ...data.meals
      .filter((r) => !day || dayKey(r.eaten_at) === day)
      .map((r) => ({
        id: r.id,
        kind: "meal" as const,
        title: r.name,
        detail: [mealLabels[r.meal_type], r.portion_text]
          .filter(Boolean)
          .join(" · "),
        at: r.eaten_at,
        notes: r.notes,
        row: { ...r },
      })),
    ...data.activities
      .filter((r) => !day || dayKey(r.started_at) === day)
      .map((r) => ({
        id: r.id,
        kind: "activity" as const,
        title: activityLabels[r.activity_type] || r.activity_type,
        detail: `${r.duration_minutes} นาที`,
        at: r.started_at,
        notes: r.notes,
        row: { ...r },
      })),
    ...data.water
      .filter((r) => !day || dayKey(r.consumed_at) === day)
      .map((r) => ({
        id: r.id,
        kind: "water" as const,
        title: "เติมความสดชื่น",
        detail: `น้ำดื่ม ${r.amount_ml.toLocaleString()} มล.`,
        at: r.consumed_at,
        notes: null,
        row: { ...r },
      })),
    ...data.checkins
      .filter((r) => !day || r.checkin_date === day)
      .map((r) => ({
        id: r.id,
        kind: "weight" as const,
        title: "เช็กอินน้ำหนัก",
        detail: `${r.weight_kg} กก.`,
        at: `${r.checkin_date}T12:00:00+07:00`,
        notes: r.notes,
        row: { ...r },
      })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
export function Timeline({
  data,
  day,
  filter,
  search = "",
  mealType = "all",
  showDate = false,
}: {
  data: Journal;
  day?: string;
  filter?: EntryKind;
  search?: string;
  mealType?: string;
  showDate?: boolean;
}) {
  const { add, notify } = useUI();
  const journal = useJournal();
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const items = timelineItems(data, day).filter(
    (r) =>
      (!filter || r.kind === filter) &&
      (!search ||
        `${r.title} ${r.notes || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (mealType === "all" || r.kind !== "meal" || r.row.meal_type === mealType),
  );
  async function remove() {
    if (!deleting) return;
    setError("");
    try {
      await journal.remove(
        (
          {
            meal: "meals",
            activity: "activities",
            weight: "checkins",
            water: "water",
          } as const
        )[deleting.kind],
        deleting.id,
      );
      setDeleting(null);
      notify("ลบบันทึกแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    }
  }
  async function favorite(item: Item) {
    try {
      await journal.save("favorites", {
        name: item.title,
        meal_type: item.row.meal_type,
        portion_text: item.row.portion_text,
      });
      notify("เก็บเป็นอาหารโปรดแล้ว");
    } catch (e) {
      notify(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }
  return (
    <>
      {!items.length ? (
        <Empty action="เพิ่มบันทึกแรก" onAction={() => add(filter)} />
      ) : (
        <div className="timeline">
          {items.map((item) => {
            const Icon = kindIcons[item.kind];
            return (
              <article
                className={`timeline-entry ${item.kind}`}
                key={`${item.kind}-${item.id}`}
              >
                <div className="timeline-time">
                  {showDate && <small>{dayKey(item.at).slice(5)}</small>}
                  {item.kind === "weight" ? "เช็กอิน" : timeLabel(item.at)}
                </div>
                <span className="entry-icon">
                  <Icon size={20} />
                </span>
                <div className="entry-copy">
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                  {item.notes && <small>{item.notes}</small>}
                </div>
                <div className="entry-actions">
                  {item.kind === "meal" &&
                    !data.favorites.some((f) => f.name === item.title) && (
                      <button
                        className="icon-button"
                        aria-label={`เก็บ ${item.title} เป็นอาหารโปรด`}
                        onClick={() => void favorite(item)}
                      >
                        <Star size={16} />
                      </button>
                    )}
                  <button
                    className="icon-button"
                    aria-label={`แก้ไข ${item.title}`}
                    onClick={() => add(item.kind, item.row)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button danger-text"
                    aria-label={`ลบ ${item.title}`}
                    onClick={() => setDeleting(item)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {deleting && (
        <Modal title="ลบบันทึกนี้?" onClose={() => setDeleting(null)}>
          <p>“{deleting.title}” จะถูกลบออกจากบันทึกของคุณ</p>
          {error && <ErrorBox message={error} />}
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
            >
              เก็บไว้
            </button>
            <button
              className="button danger"
              disabled={journal.saving}
              onClick={() => void remove()}
            >
              ยืนยันลบ
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
