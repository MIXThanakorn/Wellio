import { useState } from "react";
import { Download, Eye, EyeOff } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useJournal } from "../journal/useJournal";
import { useAuth } from "../auth/AuthProvider";
import { dayKey, shiftDay, thaiDate, weekStart } from "../../lib/dates";
import { downloadCSV } from "../../lib/export";
import { ErrorBox, Loading, Empty } from "../../components/ui";
export function ProgressPage() {
  const { profile } = useAuth();
  const [range, setRange] = useState(30);
  const [hidden, setHidden] = useState(profile?.hide_weight || false);
  const journal = useJournal();
  if (journal.isPending) return <Loading />;
  if (journal.isError) return <ErrorBox message={journal.error.message} />;
  const data = journal.data!;
  const today = dayKey();
  const start = shiftDay(today, -range + 1);
  const days = Array.from({ length: range }, (_, i) => shiftDay(start, i));
  const daily = days.map((day) => ({
    day,
    label: thaiDate(day + "T12:00:00+07:00", true),
    minutes: data.activities
      .filter((a) => dayKey(a.started_at) === day)
      .reduce((n, a) => n + a.duration_minutes, 0),
    meals: data.meals.filter((a) => dayKey(a.eaten_at) === day).length,
    water: data.water
      .filter((a) => dayKey(a.consumed_at) === day)
      .reduce((n, a) => n + a.amount_ml, 0),
  }));
  const weights = data.checkins
    .filter((w) => w.checkin_date >= start && w.checkin_date <= today)
    .toSorted((a, b) => a.checkin_date.localeCompare(b.checkin_date));
  const byWeek = new Map<string, (typeof weights)[number]>();
  weights.forEach((w) => byWeek.set(weekStart(w.checkin_date), w));
  const weeks = Array.from(
    {
      length:
        Math.floor(
          (new Date(`${weekStart(today)}T00:00:00+07:00`).getTime() -
            new Date(`${weekStart(start)}T00:00:00+07:00`).getTime()) /
            604800000,
        ) + 1,
    },
    (_, i) => shiftDay(weekStart(start), i * 7),
  );
  const weightChart = weeks.map((week) => {
    const item = byWeek.get(week);
    return {
      label: thaiDate((item?.checkin_date || week) + "T12:00:00+07:00", true),
      weight: item ? Number(item.weight_kg) : null,
    };
  });
  const activityTotal = daily.reduce((n, d) => n + d.minutes, 0);
  const mealDays = daily.filter((d) => d.meals > 0).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR JOURNEY, YOUR PACE</span>
          <h1>ความคืบหน้าของคุณ</h1>
          <p>มองเห็นความใส่ใจที่สะสมขึ้นทีละนิด</p>
        </div>
        <button className="button secondary" onClick={() => downloadCSV(data)}>
          <Download size={18} />
          ส่งออก CSV
        </button>
      </div>
      <div className="range-row">
        <div className="segmented">
          {[
            [7, "7 วัน"],
            [30, "30 วัน"],
            [90, "3 เดือน"],
            [365, "1 ปี"],
          ].map(([n, label]) => (
            <button
              key={n}
              className={range === n ? "active" : ""}
              onClick={() => setRange(Number(n))}
            >
              {label}
            </button>
          ))}
        </div>
        <span>
          {thaiDate(start + "T12:00:00+07:00", true)} –{" "}
          {thaiDate(today + "T12:00:00+07:00", true)}
        </span>
      </div>
      <div className="insight-summary">
        <div className="card">
          <span>กิจกรรมในช่วงนี้</span>
          <b>
            {activityTotal.toLocaleString()} <small>นาที</small>
          </b>
        </div>
        <div className="card">
          <span>วันที่บันทึกอาหาร</span>
          <b>
            {mealDays} <small>จาก {range} วัน</small>
          </b>
        </div>
        <div className="card">
          <span>เช็กอินตามสะดวก</span>
          <b>
            {weights.length} <small>ครั้ง</small>
          </b>
        </div>
      </div>
      <div className="chart-grid">
        <section className="card chart-card">
          <h2>เวลาขยับตัว</h2>
          <p>รวม {activityTotal.toLocaleString()} นาทีในช่วงที่เลือก</p>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="#e4ebf3"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  minTickGap={30}
                />
                <YAxis unit=" น." width={48} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value} นาที`, "กิจกรรม"]} />
                <Bar dataKey="minutes" fill="#278CF5" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card chart-card">
          <h2>การบันทึกมื้ออาหาร</h2>
          <p>บันทึกใน {mealDays} วัน · ไม่มีคะแนน ไม่มีการแข่งขัน</p>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="#e4ebf3"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  minTickGap={30}
                />
                <YAxis
                  allowDecimals={false}
                  width={35}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={(value) => [`${value} มื้อ`, "บันทึก"]} />
                <Bar dataKey="meals" fill="#e6a0b7" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card chart-card">
          <div className="section-title">
            <h2>เช็กอินน้ำหนักรายสัปดาห์</h2>
            <button className="text-button" onClick={() => setHidden(!hidden)}>
              {hidden ? <Eye size={17} /> : <EyeOff size={17} />}
              {hidden ? "แสดง" : "ซ่อน"}
            </button>
          </div>
          <p>ใช้รายการล่าสุดของแต่ละสัปดาห์ เว้นช่วงที่ไม่ได้บันทึก</p>
          {hidden ? (
            <Empty
              title="ซ่อนกราฟน้ำหนักอยู่"
              description="เลือกดูเฉพาะข้อมูลที่คุณรู้สึกสบายใจ"
            />
          ) : !weights.length ? (
            <Empty
              title="ยังไม่มีเช็กอินในช่วงนี้"
              description="บันทึกเมื่อคุณสะดวก ไม่มีความจำเป็นต้องบันทึกทุกวัน"
            />
          ) : (
            <>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightChart}>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      vertical={false}
                      stroke="#e4ebf3"
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      minTickGap={30}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      unit=" กก."
                      width={64}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value) => [`${value} กก.`, "น้ำหนัก"]}
                    />
                    <Line
                      type="linear"
                      dataKey="weight"
                      stroke="#9a8cc8"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      connectNulls={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="help">
                {weights
                  .map(
                    (w) =>
                      `${thaiDate(w.checkin_date + "T12:00:00+07:00", true)}: ${w.weight_kg} กก.`,
                  )
                  .join(" · ")}
              </p>
            </>
          )}
        </section>
        <section className="card chart-card">
          <h2>น้ำดื่มที่บันทึก</h2>
          <p>
            รวม {daily.reduce((n, d) => n + d.water, 0).toLocaleString()} มล.
            ในช่วงนี้
          </p>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="#e4ebf3"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  minTickGap={30}
                />
                <YAxis width={50} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => [
                    `${Number(value).toLocaleString()} มล.`,
                    "น้ำดื่ม",
                  ]}
                />
                <Bar dataKey="water" fill="#35B99A" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </>
  );
}
