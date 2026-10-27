import { useState, type FormEvent } from "react";
import { Check, Utensils, Footprints, Scale, Droplets } from "lucide-react";
import { Modal, ErrorBox } from "../../components/ui";
import { localInput, fromLocal, dayKey } from "../../lib/dates";
import {
  kindLabels,
  mealLabels,
  activityLabels,
  type EntryKind,
} from "../../lib/types";
import {
  mealSchema,
  activitySchema,
  checkinSchema,
  waterSchema,
} from "../../lib/validation";
import { useJournal } from "./useJournal";
export const kindIcons = {
  meal: Utensils,
  activity: Footprints,
  weight: Scale,
  water: Droplets,
};
export function EntryForm({
  kind,
  initial,
  onClose,
  onSaved,
}: {
  kind: EntryKind;
  initial?: Record<string, unknown>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const journal = useJournal();
  const [error, setError] = useState("");
  const [name, setName] = useState(String(initial?.name || ""));
  const [category, setCategory] = useState(
    String(
      initial?.meal_type ||
        initial?.activity_type ||
        (kind === "meal" ? "breakfast" : "walking"),
    ),
  );
  const [when, setWhen] = useState(
    kind === "weight"
      ? String(initial?.checkin_date || dayKey())
      : localInput(
          String(
            initial?.eaten_at ||
              initial?.started_at ||
              initial?.consumed_at ||
              new Date().toISOString(),
          ),
        ),
  );
  const [amount, setAmount] = useState(
    String(
      initial?.duration_minutes ||
        initial?.weight_kg ||
        initial?.amount_ml ||
        (kind === "water" ? 250 : ""),
    ),
  );
  const [notes, setNotes] = useState(String(initial?.notes || ""));
  const [portion, setPortion] = useState(String(initial?.portion_text || ""));
  const [effort, setEffort] = useState(String(initial?.effort || "light"));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const raw =
        kind === "meal"
          ? {
              name,
              meal_type: category,
              eaten_at: fromLocal(when),
              portion_text: portion || null,
              notes: notes || null,
            }
          : kind === "activity"
            ? {
                activity_type: category,
                started_at: fromLocal(when),
                duration_minutes: amount,
                effort,
                notes: notes || null,
              }
            : kind === "weight"
              ? { checkin_date: when, weight_kg: amount, notes: notes || null }
              : { consumed_at: fromLocal(when), amount_ml: amount };
      const schema = {
        meal: mealSchema,
        activity: activitySchema,
        weight: checkinSchema,
        water: waterSchema,
      }[kind];
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
      await journal.save(
        (
          {
            meal: "meals",
            activity: "activities",
            weight: "checkins",
            water: "water",
          } as const
        )[kind],
        { ...parsed.data, ...(initial?.id ? { id: initial.id } : {}) },
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }
  return (
    <Modal
      title={`${initial?.id ? "แก้ไข" : "เพิ่ม"}${kindLabels[kind]}`}
      onClose={onClose}
    >
      <form onSubmit={submit} className="form-stack">
        {error && <ErrorBox message={error} />}
        {kind === "meal" && (
          <>
            <label>
              ชื่ออาหาร
              <input
                autoFocus
                required
                maxLength={200}
                placeholder="วันนี้กินอะไรอร่อยๆ?"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {journal.data?.favorites.length !== 0 && (
              <div className="favorite-pills">
                {journal.data?.favorites.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setName(f.name);
                      setCategory(f.meal_type);
                      setPortion(f.portion_text || "");
                    }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
            <label>
              มื้ออาหาร
              <select
                aria-label="มื้ออาหาร"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {Object.entries(mealLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ปริมาณ <span>(ไม่บังคับ)</span>
              <input
                maxLength={200}
                placeholder="เช่น 1 จาน"
                value={portion}
                onChange={(e) => setPortion(e.target.value)}
              />
            </label>
          </>
        )}
        {kind === "activity" && (
          <>
            <label>
              ประเภทกิจกรรม
              <select
                aria-label="ประเภทกิจกรรม"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {Object.entries(activityLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              ความรู้สึกระหว่างทำ
              <select
                aria-label="ความรู้สึกระหว่างทำ"
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
              >
                <option value="light">เบา สบายๆ</option>
                <option value="moderate">ปานกลาง</option>
                <option value="vigorous">ค่อนข้างหนัก</option>
              </select>
            </label>
          </>
        )}
        {kind !== "meal" && (
          <label>
            {kind === "activity"
              ? "ระยะเวลา (นาที)"
              : kind === "weight"
                ? "น้ำหนัก (กก.)"
                : "ปริมาณน้ำ (มล.)"}
            <input
              autoFocus={kind !== "activity"}
              required
              type="number"
              inputMode="decimal"
              min={kind === "weight" ? 0.01 : 1}
              max={kind === "activity" ? 1440 : kind === "weight" ? 1000 : 5000}
              step={kind === "weight" ? "0.01" : "1"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        )}
        <label>
          {kind === "weight" ? "วันที่" : "วันและเวลา (เวลาไทย)"}
          <input
            required
            type={kind === "weight" ? "date" : "datetime-local"}
            max={kind === "weight" ? dayKey() : localInput()}
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </label>
        {kind !== "water" && (
          <label>
            บันทึกเพิ่มเติม <span>(ไม่บังคับ)</span>
            <textarea
              rows={3}
              maxLength={2000}
              placeholder="ความรู้สึก หรือสิ่งที่อยากจดไว้…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        )}
        {kind === "weight" && (
          <p className="help">
            บันทึกเมื่อคุณสะดวก ตัวเลขเป็นเพียงข้อมูลหนึ่ง ไม่ใช่คะแนนของวัน
          </p>
        )}
        <button className="button primary full" disabled={journal.saving}>
          <Check size={18} />
          {journal.saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </form>
    </Modal>
  );
}
