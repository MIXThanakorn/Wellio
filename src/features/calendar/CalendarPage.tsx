import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useJournal } from "../journal/useJournal";
import { useUI } from "../../components/AppShell";
import { Timeline, timelineItems } from "../journal/Timeline";
import { dayKey, shiftDay, thaiDate, weekStart } from "../../lib/dates";
import { ErrorBox, Loading } from "../../components/ui";
export function CalendarPage() {
  const [selected, setSelected] = useState(dayKey());
  const [month, setMonth] = useState(dayKey().slice(0, 7));
  const [view, setView] = useState<"month" | "week">("month");
  const journal = useJournal();
  const { add } = useUI();
  if (journal.isPending) return <Loading />;
  if (journal.isError) return <ErrorBox message={journal.error.message} />;
  const data = journal.data!;
  const first = `${month}-01`;
  const firstGrid = weekStart(first);
  const days = Array.from({ length: view === "month" ? 42 : 7 }, (_, i) =>
    shiftDay(view === "month" ? firstGrid : weekStart(selected), i),
  );
  function move(n: number) {
    if (view === "week") {
      setSelected(shiftDay(selected, n * 7));
      return;
    }
    const date = new Date(`${month}-15T12:00:00+07:00`);
    date.setUTCMonth(date.getUTCMonth() + n);
    setMonth(dayKey(date).slice(0, 7));
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE LOOK BACK</span>
          <h1>ปฏิทินของคุณ</h1>
          <p>มองย้อนวันดีๆ และวางแผนวันข้างหน้า</p>
        </div>
        <button className="button primary" onClick={() => add()}>
          <Plus size={18} />
          เพิ่มบันทึก
        </button>
      </div>
      <section className="card calendar-card">
        <div className="calendar-toolbar">
          <div>
            <button
              className="icon-button"
              aria-label="ช่วงก่อนหน้า"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <h2>
              {new Intl.DateTimeFormat("th-TH", {
                month: "long",
                year: "numeric",
                timeZone: "Asia/Bangkok",
              }).format(
                new Date(
                  `${view === "month" ? first : selected}T12:00:00+07:00`,
                ),
              )}
            </h2>
            <button
              className="icon-button"
              aria-label="ช่วงถัดไป"
              onClick={() => move(1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="segmented">
            <button
              className={view === "month" ? "active" : ""}
              onClick={() => setView("month")}
            >
              เดือน
            </button>
            <button
              className={view === "week" ? "active" : ""}
              onClick={() => setView("week")}
            >
              สัปดาห์
            </button>
          </div>
          <button
            className="button secondary"
            onClick={() => {
              setSelected(dayKey());
              setMonth(dayKey().slice(0, 7));
            }}
          >
            วันนี้
          </button>
        </div>
        <div className="calendar-grid">
          <div className="weekday-row">
            {["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."].map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
          <div className="calendar-days">
            {days.map((day) => {
              const items = timelineItems(data, day);
              return (
                <button
                  key={day}
                  aria-label={thaiDate(day + "T12:00:00+07:00")}
                  aria-pressed={selected === day}
                  className={`calendar-day ${day.slice(0, 7) !== month && view === "month" ? "other-month" : ""} ${day === selected ? "selected" : ""} ${day === dayKey() ? "today" : ""}`}
                  onClick={() => setSelected(day)}
                >
                  <span>{Number(day.slice(-2))}</span>
                  <div className="day-dots">
                    {(["meal", "activity", "weight", "water"] as const)
                      .filter((kind) => items.some((i) => i.kind === kind))
                      .map((kind) => (
                        <i key={kind} className={kind} />
                      ))}
                  </div>
                  {items.length > 0 && <small>{items.length} บันทึก</small>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="calendar-legend">
          <span>
            <i className="meal" />
            อาหาร
          </span>
          <span>
            <i className="activity" />
            กิจกรรม
          </span>
          <span>
            <i className="weight" />
            เช็กอิน
          </span>
          <span>
            <i className="water" />
            น้ำดื่ม
          </span>
        </div>
      </section>
      <section className="card">
        <h2>{thaiDate(selected + "T12:00:00+07:00")}</h2>
        <Timeline data={data} day={selected} />
      </section>
    </>
  );
}
