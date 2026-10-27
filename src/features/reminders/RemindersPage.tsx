import { useState, type FormEvent } from "react";
import {
  Bell,
  BellOff,
  Clock3,
  ShieldCheck,
  Smartphone,
  Check,
} from "lucide-react";
import { useJournal } from "../journal/useJournal";
import { useAuth } from "../auth/AuthProvider";
import { useUI } from "../../components/AppShell";
import { supabase } from "../../lib/supabase";
import { reminderState, timeLabel, thaiDate } from "../../lib/dates";
import { preferenceSchema } from "../../lib/validation";
import { ErrorBox, Loading } from "../../components/ui";
import type { Preferences } from "../../lib/types";
import { useNow } from "../../lib/useNow";
const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
export function RemindersPage() {
  const journal = useJournal();
  if (journal.isPending) return <Loading />;
  if (journal.isError) return <ErrorBox message={journal.error.message} />;
  return (
    <ReminderEditor
      key={journal.data!.preferences.owner_user_id}
      preferences={journal.data!.preferences}
      lastMeal={
        journal.data!.meals.toSorted((a, b) =>
          b.eaten_at.localeCompare(a.eaten_at),
        )[0]?.eaten_at
      }
    />
  );
}
function ReminderEditor({
  preferences: p,
  lastMeal,
}: {
  preferences: Preferences;
  lastMeal?: string;
}) {
  const journal = useJournal();
  const { demo, profile } = useAuth();
  const now = useNow();
  const { notify } = useUI();
  const [enabled, setEnabled] = useState(p.enabled);
  const [gap, setGap] = useState(p.meal_gap_minutes);
  const [start, setStart] = useState(p.quiet_start.slice(0, 5));
  const [end, setEnd] = useState(p.quiet_end.slice(0, 5));
  const [error, setError] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const [permission, setPermission] = useState(
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const supported =
    typeof Notification !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  const state = reminderState(p, lastMeal, now);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const parsed = preferenceSchema.safeParse({
      enabled,
      meal_gap_minutes: gap,
      quiet_start: start,
      quiet_end: end,
      timezone: "Asia/Bangkok",
      snoozed_until: p.snoozed_until,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      await journal.save("preferences", parsed.data);
      notify("บันทึกการเตือนแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }
  async function subscribe() {
    setError("");
    setPushBusy(true);
    try {
      if (demo) throw new Error("เชื่อมบัญชีจริงก่อนเปิด push");
      if (!vapidPublic)
        throw new Error(
          "ยังไม่ได้ตั้งค่า Web Push ฝั่งเซิร์ฟเวอร์ ใช้การเตือนในแอปได้ก่อน",
        );
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted")
        throw new Error("ยังไม่ได้อนุญาตการแจ้งเตือน ใช้การเตือนในแอปได้เสมอ");
      const registration = await navigator.serviceWorker.ready;
      const padding = "=".repeat((4 - (vapidPublic.length % 4)) % 4);
      const bytes = Uint8Array.from(
        atob((vapidPublic + padding).replaceAll("-", "+").replaceAll("_", "/")),
        (c) => c.charCodeAt(0),
      );
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        }));
      const json = subscription.toJSON();
      const { error } = await supabase!.from("push_subscriptions").upsert(
        {
          owner_user_id: profile!.user_id,
          endpoint: json.endpoint,
          p256dh: json.keys!.p256dh,
          auth_secret: json.keys!.auth,
          device_label: `${navigator.platform || "Browser"} · ${new Date().toLocaleDateString("th-TH")}`,
          enabled: true,
        },
        { onConflict: "owner_user_id,endpoint" },
      );
      if (error) throw error;
      notify("เชื่อมต่อ push สำหรับอุปกรณ์นี้แล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เชื่อมต่อไม่สำเร็จ");
    } finally {
      setPushBusy(false);
    }
  }
  async function unsubscribe() {
    setPushBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        if (!demo) {
          const { error } = await supabase!
            .from("push_subscriptions")
            .delete()
            .eq("owner_user_id", profile!.user_id)
            .eq("endpoint", sub.endpoint);
          if (error) throw error;
        }
        await sub.unsubscribe();
      }
      notify("ปิด push ของอุปกรณ์นี้แล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ปิดไม่สำเร็จ");
    } finally {
      setPushBusy(false);
    }
  }
  async function testNotification() {
    try {
      if (Notification.permission !== "granted")
        throw new Error("กรุณาเปิดการแจ้งเตือนสำหรับอุปกรณ์นี้ก่อน");
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Wellio · ทดสอบการแจ้งเตือน", {
        body: "นี่คือการทดสอบบนอุปกรณ์นี้ ยังไม่ใช่การส่งจากเซิร์ฟเวอร์",
        icon: "/icon.svg",
      });
      notify("แสดงการแจ้งเตือนทดสอบแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทดสอบไม่สำเร็จ");
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A GENTLE NUDGE</span>
          <h1>เพื่อนเตือนเบาๆ</h1>
          <p>การชวนกลับมาบันทึก ในเวลาที่คุณสะดวก</p>
        </div>
      </div>
      {error && <ErrorBox message={error} />}
      <div className="settings-grid">
        <section className="card">
          <form className="form-stack" onSubmit={submit}>
            <div className="setting-toggle">
              <span className="setting-icon">
                <Bell size={23} />
              </span>
              <div>
                <h2>ชวนบันทึกมื้ออาหาร</h2>
                <p>เตือนจากเวลามื้ออาหารที่บันทึกล่าสุด</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="เปิดการเตือนมื้ออาหาร"
                className={`switch ${enabled ? "on" : ""}`}
                onClick={() => setEnabled(!enabled)}
              >
                <span />
              </button>
            </div>
            <label>
              ช่วงเวลาหลังมื้อที่บันทึกล่าสุด
              <select
                value={gap}
                onChange={(e) => setGap(Number(e.target.value))}
              >
                {[60, 120, 180, 240, 300, 360, 480, 720, 1440].map(
                  (minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes / 60} ชั่วโมง
                    </option>
                  ),
                )}
              </select>
            </label>
            <fieldset>
              <legend>เวลาพัก ไม่รบกวน</legend>
              <div className="form-row">
                <label>
                  เริ่ม
                  <input
                    required
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </label>
                <label>
                  สิ้นสุด
                  <input
                    required
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </label>
              </div>
              <small>
                เวลาไทย · ช่วงเวลาข้ามเที่ยงคืนได้ ·
                เวลาเริ่มและจบเท่ากันหมายถึงไม่มีช่วงพัก
              </small>
            </fieldset>
            <p className="help">
              ช่วงเวลานี้เป็นความชอบส่วนตัว ไม่ใช่คำแนะนำว่าควรกินเมื่อใด
              การไม่ได้บันทึกอาจทำให้เวลาเตือนไม่ตรงกับมื้อจริง
            </p>
            <button className="button primary" disabled={journal.saving}>
              <Check size={17} />
              บันทึกการตั้งค่า
            </button>
          </form>
        </section>
        <div>
          <section className="card reminder-status">
            <span className="setting-icon">
              <Clock3 size={24} />
            </span>
            <h2>สถานะการเตือน</h2>
            <p>
              {
                {
                  disabled: "ยังไม่ได้เปิดการเตือน",
                  "no-history": "ยังไม่มีมื้ออาหารที่บันทึก",
                  quiet: "อยู่ในช่วงเวลาพัก",
                  snoozed: "เลื่อนการเตือนไว้ชั่วคราว",
                  due: "ไม่ได้บันทึกมื้ออาหารมาสักพักแล้ว อยากอัปเดตบันทึกไหม?",
                  waiting: "ยังไม่ถึงช่วงเวลาเตือน",
                }[state]
              }
            </p>
            {lastMeal && (
              <small>
                มื้อล่าสุด {thaiDate(lastMeal, true)} {timeLabel(lastMeal)} น.
              </small>
            )}
            {state === "waiting" && lastMeal && (
              <p className="help">
                เริ่มช่วงเตือนประมาณ{" "}
                {thaiDate(
                  new Date(
                    new Date(lastMeal).getTime() + p.meal_gap_minutes * 60000,
                  ),
                  true,
                )}{" "}
                {timeLabel(
                  new Date(
                    new Date(lastMeal).getTime() + p.meal_gap_minutes * 60000,
                  ).toISOString(),
                )}{" "}
                น. ขึ้นอยู่กับช่วงพักและการเชื่อมต่อ
              </p>
            )}
            <div className="snooze-actions">
              <button
                className="button secondary"
                disabled={!p.enabled || journal.saving}
                onClick={async () => {
                  try {
                    await journal.save("preferences", {
                      ...p,
                      snoozed_until: new Date(
                        Date.now() + 3600000,
                      ).toISOString(),
                    });
                    notify("เลื่อนการเตือน 1 ชั่วโมงแล้ว");
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "บันทึกไม่สำเร็จ",
                    );
                  }
                }}
              >
                เลื่อน 1 ชั่วโมง
              </button>
              <button
                className="text-button"
                disabled={journal.saving}
                onClick={async () => {
                  try {
                    await journal.save("preferences", { ...p, enabled: false });
                    notify("พักการเตือนแล้ว");
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "บันทึกไม่สำเร็จ",
                    );
                  }
                }}
              >
                <BellOff size={16} />
                พักการเตือน
              </button>
            </div>
          </section>
        </div>
        <section className="card push-card">
          <Smartphone size={25} />
          <h2>แจ้งเตือนบนอุปกรณ์นี้</h2>
          <p>
            สถานะ:{" "}
            {permission === "granted"
              ? "อนุญาตแล้ว"
              : permission === "denied"
                ? "ถูกปิดในเบราว์เซอร์"
                : permission === "unsupported"
                  ? "อุปกรณ์นี้ไม่รองรับ"
                  : "ยังไม่ได้ขออนุญาต"}
          </p>
          <div className="info-box">
            <ShieldCheck size={19} />
            <p>
              {demo
                ? "โหมดทดลองใช้การเตือนในแอปเท่านั้น"
                : !vapidPublic
                  ? "การเตือนในแอปพร้อมใช้ ส่วน push ต้องตั้งค่า VAPID และงานส่งตามเวลาก่อนเปิดใช้งาน"
                  : "Push ต้องใช้ HTTPS และการเชื่อมต่ออินเทอร์เน็ต บน iPhone/iPad ให้ติดตั้งที่หน้าจอโฮมก่อน การส่งอาจล่าช้าตามระบบของอุปกรณ์"}
            </p>
          </div>
          <div className="button-row">
            <button
              className="button primary"
              disabled={
                !supported ||
                demo ||
                !vapidPublic ||
                pushBusy ||
                permission === "denied"
              }
              onClick={() => void subscribe()}
            >
              เปิด push อุปกรณ์นี้
            </button>
            <button
              className="button secondary"
              disabled={!supported || demo || permission !== "granted"}
              onClick={() => void testNotification()}
            >
              ทดสอบบนอุปกรณ์
            </button>
            <button
              className="text-button"
              disabled={!supported || demo || pushBusy}
              onClick={() => void unsubscribe()}
            >
              ยกเลิก push อุปกรณ์นี้
            </button>
          </div>
          <p className="help">
            ถ้าไม่รองรับหรือไม่อนุญาต ยังดูสถานะเตือนในแอปได้
            ไม่มีการส่งอีเมลหรือ SMS
          </p>
        </section>
      </div>
    </>
  );
}
