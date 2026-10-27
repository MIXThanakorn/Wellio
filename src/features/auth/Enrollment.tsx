import { useState, type FormEvent } from "react";
import { Heart, ArrowRight, ShieldCheck, Mail } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { supabase } from "../../lib/supabase";
import { ErrorBox } from "../../components/ui";
export function Enrollment() {
  const { enterDemo, error: authError, session, leave } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!supabase)
        throw new Error("ยังไม่ได้ตั้งค่า Supabase กรุณาตรวจ .env.local");
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin,
        },
      });
      if (error)
        throw new Error(
          "ยังส่งลิงก์ไม่ได้ โปรดตรวจว่าอีเมลได้รับเชิญแล้ว หรือรอสักครู่แล้วลองใหม่",
        );
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="enrollment">
      <div className="enrollment-art">
        <div className="brand">
          <span className="brand-icon">
            <Heart size={25} />
          </span>
          FitLog<span className="brand-dot">.</span>
        </div>
        <span className="eyebrow">YOUR EVERYDAY WELLNESS</span>
        <h1>
          ดูแลตัวเอง
          <br />
          ทีละนิด <span>ทุกวัน</span>
        </h1>
        <p>
          บันทึกมื้อที่อร่อย การขยับตัวเล็กๆ
          <br />
          และทุกวันที่ได้ใส่ใจตัวเอง
        </p>
        <div className="enroll-decor">
          <Heart size={96} strokeWidth={1} />
          <span>small steps, better days</span>
        </div>
        <small>พื้นที่ส่วนตัวของมิกและเนม</small>
      </div>
      <section className="enrollment-form">
        <span className="badge">
          <ShieldCheck size={16} /> พื้นที่ส่วนตัวของคุณ
        </span>
        <h2>ยินดีต้อนรับสู่ FitLog</h2>
        <p>
          เชื่อมต่ออุปกรณ์ครั้งแรกด้วยลิงก์ส่วนตัว
          <br />
          ครั้งต่อไปเปิดแอปแล้วบันทึกต่อได้เลย
        </p>
        {(error || authError) && <ErrorBox message={error || authError} />}
        {session ? (
          <button className="button secondary" onClick={() => void leave()}>
            ออกจาก session นี้
          </button>
        ) : sent ? (
          <div className="success-box" role="status">
            <Mail />
            <h3>ตรวจกล่องอีเมลของคุณ</h3>
            <p>
              เปิดลิงก์ในเบราว์เซอร์นี้เพื่อยืนยันอุปกรณ์
              ลิงก์ใช้ได้ครั้งเดียวและมีเวลาจำกัด
            </p>
            <button className="text-button" onClick={() => setSent(false)}>
              ใช้อีเมลอื่น / ส่งอีกครั้ง
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>
              อีเมลที่ได้รับเชิญ
              <input
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button className="button primary full" disabled={busy}>
              {busy ? "กำลังส่ง…" : "รับลิงก์เชื่อมต่ออุปกรณ์"}
              <ArrowRight size={18} />
            </button>
            <small>
              เฉพาะสองบัญชีที่ผู้ดูแลเชิญไว้ ข้อมูลของแต่ละคนแยกจากกัน
            </small>
          </form>
        )}
        <div className="divider">
          <span>ลองดูก่อนได้</span>
        </div>
        <button className="button secondary full" onClick={enterDemo}>
          สำรวจแอปด้วยข้อมูลตัวอย่าง
          <ArrowRight size={18} />
        </button>
        <p className="fine-print">
          โหมดทดลองใช้ข้อมูลสมมติในเบราว์เซอร์นี้
          <br />
          ไม่บันทึกลงบัญชีจริง
        </p>
      </section>
    </main>
  );
}
