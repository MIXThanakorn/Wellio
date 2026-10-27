import { useNavigate } from "react-router-dom";
import {
  Plus,
  Utensils,
  Footprints,
  Droplets,
  Scale,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Bell,
  Check,
  Clock3,
  Sun,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useJournal } from "../journal/useJournal";
import { useUI } from "../../components/AppShell";
import { Empty, ErrorBox, Loading, SectionTitle } from "../../components/ui";
import { Timeline } from "../journal/Timeline";
import { useNow } from "../../lib/useNow";
import {
  dayKey,
  thaiDate,
  shiftDay,
  weekStart,
  reminderState,
  timeLabel,
} from "../../lib/dates";
export function Dashboard() {
  const { profile } = useAuth();
  const journal = useJournal();
  const { add, notify } = useUI();
  const navigate = useNavigate();
  const now = useNow();
  if (journal.isPending) return <Loading />;
  if (journal.isError)
    return (
      <ErrorBox
        message={journal.error.message}
        onRetry={() => void journal.refetch()}
      />
    );
  const data = journal.data!;
  const today = dayKey(now);
  const meals = data.meals.filter((r) => dayKey(r.eaten_at) === today);
  const minutes = data.activities
    .filter((r) => dayKey(r.started_at) === today)
    .reduce((n, r) => n + r.duration_minutes, 0);
  const water = data.water
    .filter((r) => dayKey(r.consumed_at) === today)
    .reduce((n, r) => n + r.amount_ml, 0);
  const latest = data.checkins.toSorted((a, b) =>
    b.checkin_date.localeCompare(a.checkin_date),
  )[0];
  const lastMeal = data.meals.toSorted((a, b) =>
    b.eaten_at.localeCompare(a.eaten_at),
  )[0];
  const state = reminderState(data.preferences, lastMeal?.eaten_at, now);
  const week = weekStart(today);
  const weeklyMinutes = data.activities
    .filter(
      (r) => dayKey(r.started_at) >= week && dayKey(r.started_at) <= today,
    )
    .reduce((n, r) => n + r.duration_minutes, 0);
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(week, i));
  const todayPlans = data.plans.filter(
    (p) =>
      p.is_active &&
      p.days_of_week.includes(new Date(`${today}T12:00:00+07:00`).getUTCDay()),
  );
  return (
    <>
      <div className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow">
            <Sun size={15} /> {thaiDate()}
          </div>
          <h1>
            สวัสดี {profile?.display_name}{" "}
            <span className="greeting-spark">✳</span>
          </h1>
          <p>บันทึกสุขภาพประจำวันของคุณ</p>
        </div>
        <button className="button primary" onClick={() => add()}>
          <Plus size={19} />
          เพิ่มบันทึก
        </button>
      </div>
      <section className="start-panel" aria-label="บันทึกด่วน">
        <div className="start-panel-heading">
          <div>
            <h2>อยากบันทึกอะไร?</h2>
            <p>แตะสิ่งที่ต้องการ แล้วกรอกเพียงนิดเดียว</p>
          </div>
          <button className="text-button" onClick={() => navigate("/guide")}>
            ดูวิธีใช้ <ArrowRight size={17} />
          </button>
        </div>
        <div className="start-actions">
          {(
            [
              ["meal", "บันทึกอาหาร", "จดชื่อ หรือถ่ายรูปมื้อที่กิน", Utensils],
              ["water", "บันทึกน้ำดื่ม", "เลือกปริมาณแล้วบันทึก", Droplets],
              [
                "activity",
                "บันทึกกิจกรรม",
                "เดิน ยืดเส้น หรือออกกำลัง",
                Footprints,
              ],
              ["weight", "บันทึกน้ำหนัก", "ไม่บังคับ บันทึกเมื่อสะดวก", Scale],
            ] as const
          ).map(([kind, label, description, Icon]) => (
            <button key={kind} className={kind} onClick={() => add(kind)}>
              <span className="entry-icon">
                <Icon size={24} />
              </span>
              <span>
                <b>{label}</b>
                <small>{description}</small>
              </span>
              <Plus size={19} />
            </button>
          ))}
        </div>
        <p className="start-panel-note">
          <Check size={16} /> วันที่และเวลาใส่ให้แล้ว แก้ไขย้อนหลังได้
        </p>
      </section>
      <div className="stats-grid">
        <Stat
          icon={Utensils}
          color="pink"
          title="มื้ออาหารวันนี้"
          value={String(meals.length)}
          unit="มื้อ"
          note="บันทึกมื้ออร่อยของคุณ"
          action={() => add("meal")}
        />
        <Stat
          icon={Footprints}
          color="blue"
          title="ขยับตัววันนี้"
          value={String(minutes)}
          unit="นาที"
          note={`สัปดาห์นี้รวม ${weeklyMinutes} นาที`}
          action={() => add("activity")}
        />
        <Stat
          icon={Droplets}
          color="mint"
          title="น้ำดื่มวันนี้"
          value={water.toLocaleString()}
          unit="มล."
          note={
            profile?.water_goal_ml
              ? `ความตั้งใจของคุณ ${profile.water_goal_ml.toLocaleString()} มล.`
              : "เติมความสดชื่นในแบบของคุณ"
          }
          action={() => add("water")}
        />
        <Stat
          icon={Scale}
          color="purple"
          title="เช็กอินล่าสุด"
          value={
            profile?.hide_weight
              ? "ซ่อนอยู่"
              : latest
                ? String(latest.weight_kg)
                : "—"
          }
          unit={profile?.hide_weight ? "" : "กก."}
          note={
            latest
              ? thaiDate(latest.checkin_date + "T12:00:00+07:00", true)
              : "เมื่อพร้อม ค่อยบันทึกก็ได้"
          }
          action={() => add("weight")}
        />
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-main">
          <section className="card timeline-card">
            <SectionTitle
              title="บันทึกของวันนี้"
              subtitle="เรื่องเล็กๆ ที่คุณได้ทำเพื่อตัวเอง"
              action="ดูทั้งหมด"
              onAction={() => navigate("/meals")}
            />
            <div className="timeline-date">
              <span className="badge">
                <span className="status-dot" />
                วันนี้
              </span>
              <span>{thaiDate(today + "T12:00:00+07:00", true)}</span>
            </div>
            <Timeline data={data} day={today} />
            <button className="add-line" onClick={() => add()}>
              <Plus size={18} />
              เพิ่มอีกหนึ่งเรื่องดีๆ ของวันนี้
            </button>
          </section>
          <section className="card">
            <SectionTitle
              title="ค่อยๆ ขยับ ในจังหวะของคุณ"
              subtitle="เวลาทำกิจกรรมในสัปดาห์นี้"
              action="ดูความคืบหน้า"
              onAction={() => navigate("/progress")}
            />
            <div className="weekly-overview">
              <div className="weekly-total">
                <b>{weeklyMinutes}</b>
                <span>นาทีในสัปดาห์นี้</span>
                <small>ทุกการขยับตัวมีความหมาย</small>
              </div>
              <div
                className="week-bars"
                role="img"
                aria-label={`กิจกรรมสัปดาห์นี้ ${weeklyMinutes} นาที`}
              >
                {days.map((day) => {
                  const total = data.activities
                    .filter((a) => dayKey(a.started_at) === day)
                    .reduce((n, a) => n + a.duration_minutes, 0);
                  const max = Math.max(
                    60,
                    ...days.map((d) =>
                      data.activities
                        .filter((a) => dayKey(a.started_at) === d)
                        .reduce((n, a) => n + a.duration_minutes, 0),
                    ),
                  );
                  return (
                    <div key={day} className={day === today ? "current" : ""}>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            height: `${Math.max((total / max) * 100, 3)}%`,
                          }}
                        >
                          <span>{total}</span>
                        </div>
                      </div>
                      <small>
                        {new Intl.DateTimeFormat("th-TH", {
                          weekday: "short",
                          timeZone: "Asia/Bangkok",
                        }).format(new Date(`${day}T12:00:00+07:00`))}
                      </small>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>
        <div className="dashboard-aside">
          <section className="card">
            <SectionTitle
              title="แผนวันนี้"
              action="จัดการ"
              onAction={() => navigate("/plans")}
            />
            {todayPlans.length ? (
              todayPlans.slice(0, 3).map((plan) => {
                const completed = data.completions.some(
                  (c) => c.plan_id === plan.id && c.completed_date === today,
                );
                return (
                  <div className="today-plan" key={plan.id}>
                    <span className="plan-icon">
                      <Footprints size={19} />
                    </span>
                    <div>
                      <b>{plan.title}</b>
                      <small>
                        <Clock3 size={12} />
                        {plan.local_time?.slice(0, 5) || "เวลาที่สะดวก"}
                        {plan.duration_minutes
                          ? ` · ${plan.duration_minutes} นาที`
                          : ""}
                      </small>
                    </div>
                    <button
                      className={`completion-button ${completed ? "completed" : ""}`}
                      aria-label={`${completed ? "ยกเลิกสำเร็จ" : "ทำสำเร็จ"} ${plan.title}`}
                      onClick={async () => {
                        try {
                          const existing = data.completions.find(
                            (c) =>
                              c.plan_id === plan.id &&
                              c.completed_date === today,
                          );
                          if (existing)
                            await journal.remove("completions", existing.id);
                          else
                            await journal.save("completions", {
                              plan_id: plan.id,
                              completed_date: today,
                              completed_at: new Date().toISOString(),
                              notes: null,
                            });
                        } catch (e) {
                          notify(
                            e instanceof Error ? e.message : "บันทึกไม่สำเร็จ",
                          );
                        }
                      }}
                    >
                      <Check size={16} />
                    </button>
                  </div>
                );
              })
            ) : (
              <Empty
                title="วันนี้เว้นที่ให้ตัวเอง"
                description="เพิ่มกิจวัตรเมื่อคุณพร้อม"
              />
            )}
            <button
              className="calendar-link"
              onClick={() => navigate("/calendar")}
            >
              <CalendarDays size={17} />
              เปิดปฏิทิน
              <ArrowUpRight size={16} />
            </button>
          </section>
          <section className="reminder-card">
            <div className="reminder-icon">
              <Bell size={21} />
            </div>
            <h3>เพื่อนเตือนเบาๆ</h3>
            <p>
              {state === "due"
                ? "ไม่ได้บันทึกมื้ออาหารมาสักพักแล้ว อยากอัปเดตบันทึกไหม?"
                : state === "disabled"
                  ? "เปิดการเตือนเมื่อคุณต้องการ ให้เราช่วยชวนกลับมาบันทึก"
                  : state === "no-history"
                    ? "เพิ่มมื้อแรกก่อน แล้วเราจะคอยชวนกลับมาบันทึก"
                    : state === "quiet"
                      ? "อยู่ในช่วงเวลาพัก เราจะไม่รบกวนคุณ"
                      : state === "snoozed"
                        ? "พักการเตือนไว้ชั่วคราวแล้ว"
                        : "ยังไม่ถึงช่วงเตือน ใช้วันของคุณได้ตามสบาย"}
            </p>
            {lastMeal && (
              <small>
                มื้อล่าสุด {timeLabel(lastMeal.eaten_at)} น. ·{" "}
                {thaiDate(lastMeal.eaten_at, true)}
              </small>
            )}
            <button
              className="text-button"
              onClick={() => navigate("/reminders")}
            >
              ตั้งค่าการเตือน
              <ArrowRight size={15} />
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
function Stat({
  icon: Icon,
  color,
  title,
  value,
  unit,
  note,
  action,
}: {
  icon: typeof Utensils;
  color: string;
  title: string;
  value: string;
  unit: string;
  note: string;
  action: () => void;
}) {
  return (
    <button className={`card stat-card ${color}`} onClick={action}>
      <div className="stat-top">
        <span className="stat-icon">
          <Icon size={21} />
        </span>
        <Plus size={16} />
      </div>
      <span className="stat-title">{title}</span>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <small>{note}</small>
    </button>
  );
}
