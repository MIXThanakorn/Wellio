import { useState, type FormEvent } from "react";
import {
  Plus,
  Check,
  Pencil,
  Trash2,
  CalendarCheck2,
  Clock3,
  Pause,
  Play,
} from "lucide-react";
import { useJournal } from "../journal/useJournal";
import { useUI } from "../../components/AppShell";
import { dayKey } from "../../lib/dates";
import { planSchema } from "../../lib/validation";
import type { Plan } from "../../lib/types";
import { ErrorBox, Loading, Empty, Modal } from "../../components/ui";
const weekdays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
export function PlansPage() {
  const journal = useJournal();
  const { notify } = useUI();
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  if (journal.isPending) return <Loading />;
  if (journal.isError) return <ErrorBox message={journal.error.message} />;
  const data = journal.data!;
  const today = dayKey();
  async function toggle(plan: Plan) {
    try {
      const completed = data.completions.find(
        (c) => c.plan_id === plan.id && c.completed_date === today,
      );
      if (completed) await journal.remove("completions", completed.id);
      else
        await journal.save("completions", {
          plan_id: plan.id,
          completed_date: today,
          completed_at: new Date().toISOString(),
          notes: null,
        });
      notify(
        completed
          ? "ยกเลิกการทำสำเร็จแล้ว"
          : "บันทึกว่าได้ทำแล้ว เก่งมากที่ดูแลตัวเอง",
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR YOURSELF</span>
          <h1>แผนของฉัน</h1>
          <p>กิจวัตรที่ยืดหยุ่นได้ ตามจังหวะชีวิตของคุณ</p>
        </div>
        <button className="button primary" onClick={() => setEditing("new")}>
          <Plus size={18} />
          เพิ่มแผน
        </button>
      </div>
      <div className="gentle-note">
        ไม่จำเป็นต้องทำได้ทุกวัน ปรับแผนหรือพักได้เสมอ
      </div>
      {!data.plans.length ? (
        <section className="card">
          <Empty
            title="เว้นพื้นที่ให้เรื่องดีๆ"
            action="สร้างแผนแรก"
            onAction={() => setEditing("new")}
          />
        </section>
      ) : (
        <div className="plans-grid">
          {data.plans.map((plan) => {
            const completed = data.completions.some(
              (c) => c.plan_id === plan.id && c.completed_date === today,
            );
            return (
              <section
                className={`card plan-card ${!plan.is_active ? "paused" : ""}`}
                key={plan.id}
              >
                <div className="plan-card-top">
                  <span className="plan-icon">
                    <CalendarCheck2 size={23} />
                  </span>
                  <span className="badge">
                    {{
                      activity: "กิจกรรม",
                      meal: "มื้ออาหาร",
                      rest: "พักผ่อน",
                      sleep: "การนอน",
                    }[plan.category] || plan.category}
                  </span>
                  <button
                    className="icon-button"
                    aria-label={`แก้ไข ${plan.title}`}
                    onClick={() => setEditing(plan)}
                  >
                    <Pencil size={17} />
                  </button>
                </div>
                <h2>{plan.title}</h2>
                <p>
                  <Clock3 size={15} />
                  {plan.local_time?.slice(0, 5) || "เวลาที่สะดวก"}
                  {plan.duration_minutes
                    ? ` · ${plan.duration_minutes} นาที`
                    : ""}
                </p>
                <div className="plan-days">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <span
                      key={day}
                      className={
                        plan.days_of_week.includes(day) ? "active" : ""
                      }
                    >
                      {weekdays[day]}
                    </span>
                  ))}
                </div>
                <div className="plan-controls">
                  <button
                    className={`button ${completed ? "mint-button" : "secondary"}`}
                    disabled={!plan.is_active || journal.saving}
                    onClick={() => void toggle(plan)}
                  >
                    <Check size={17} />
                    {completed ? "วันนี้ทำแล้ว" : "ทำวันนี้แล้ว"}
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`${plan.is_active ? "พัก" : "เริ่ม"} ${plan.title}`}
                    onClick={async () => {
                      try {
                        await journal.save("plans", {
                          ...plan,
                          is_active: !plan.is_active,
                        });
                      } catch (e) {
                        notify(
                          e instanceof Error ? e.message : "แก้ไขไม่สำเร็จ",
                        );
                      }
                    }}
                  >
                    {plan.is_active ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button
                    className="icon-button danger-text"
                    aria-label={`ลบ ${plan.title}`}
                    onClick={() => setDeleting(plan)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
                {!plan.is_active && <small>พักแผนนี้อยู่</small>}
              </section>
            );
          })}
        </div>
      )}
      <section className="card template-card">
        <h2>เริ่มจากกิจวัตรเล็กๆ</h2>
        <p>เลือกแล้วแก้ไขวัน เวลา และระยะเวลาได้ตามใจคุณ</p>
        <div className="template-options">
          {[
            ["เดินเล่นสบายๆ", "activity"],
            ["เว้นเวลาให้มื้ออาหาร", "meal"],
            ["ยืดเหยียดและพักสายตา", "rest"],
            ["เตรียมตัวเข้านอน", "sleep"],
          ].map(([title, category]) => (
            <button
              className="button secondary"
              key={title}
              onClick={() =>
                setEditing({
                  id: "",
                  owner_user_id: "",
                  title,
                  category,
                  days_of_week: [1, 3, 5],
                  local_time: null,
                  duration_minutes: null,
                  is_active: true,
                })
              }
            >
              <Plus size={16} />
              {title}
            </button>
          ))}
        </div>
      </section>
      {editing && (
        <PlanForm
          initial={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            notify("บันทึกแผนแล้ว");
          }}
        />
      )}
      {deleting && (
        <Modal title="ลบแผนนี้?" onClose={() => setDeleting(null)}>
          <p>แผน “{deleting.title}” และประวัติการทำสำเร็จของแผนนี้จะถูกลบ</p>
          {error && <ErrorBox message={error} />}
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(null)}
            >
              ยกเลิก
            </button>
            <button
              className="button danger"
              disabled={journal.saving}
              onClick={async () => {
                try {
                  await journal.remove("plans", deleting.id);
                  setDeleting(null);
                  notify("ลบแผนแล้ว");
                } catch (e) {
                  setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
                }
              }}
            >
              ยืนยันลบ
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function PlanForm({
  initial,
  onClose,
  onSaved,
}: {
  initial?: Plan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const journal = useJournal();
  const [title, setTitle] = useState(initial?.title || "");
  const [category, setCategory] = useState(initial?.category || "activity");
  const [days, setDays] = useState(initial?.days_of_week || [1, 3, 5]);
  const [time, setTime] = useState(initial?.local_time?.slice(0, 5) || "");
  const [duration, setDuration] = useState(
    String(initial?.duration_minutes || ""),
  );
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = planSchema.safeParse({
      title,
      category,
      days_of_week: days,
      local_time: time || null,
      duration_minutes: duration || null,
      is_active: initial?.is_active ?? true,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      await journal.save("plans", {
        ...parsed.data,
        ...(initial?.id ? { id: initial.id } : {}),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }
  return (
    <Modal title={initial?.id ? "แก้ไขแผน" : "เพิ่มแผนใหม่"} onClose={onClose}>
      <form className="form-stack" onSubmit={submit}>
        {error && <ErrorBox message={error} />}
        <label>
          ชื่อแผน
          <input
            autoFocus
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="อยากเว้นเวลาให้กับอะไร?"
          />
        </label>
        <label>
          ประเภท
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="activity">กิจกรรม</option>
            <option value="meal">มื้ออาหาร</option>
            <option value="rest">พักผ่อน</option>
            <option value="sleep">การนอน</option>
          </select>
        </label>
        <fieldset>
          <legend>วันที่วางแผน</legend>
          <div className="day-picker">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={days.includes(day)}
                className={days.includes(day) ? "active" : ""}
                onClick={() =>
                  setDays(
                    days.includes(day)
                      ? days.filter((d) => d !== day)
                      : [...days, day],
                  )
                }
              >
                {weekdays[day]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="form-row">
          <label>
            เวลา (ไม่บังคับ)
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label>
            นาที (ไม่บังคับ)
            <input
              type="number"
              min={1}
              max={1440}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
        </div>
        <button className="button primary full" disabled={journal.saving}>
          บันทึกแผน
        </button>
      </form>
    </Modal>
  );
}
