import { Heart, ArrowRight, UsersRound } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { ErrorBox } from "../../components/ui";
import { AccountPicker, type AccountSlug } from "./AccountPicker";
import { selectAccount } from "../../lib/accountSession";
export function Enrollment() {
  const { enterDemo, error: authError, session, leave } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<AccountSlug | null>(null);
  const choose = async (slug: AccountSlug) => {
    if (busy) return;
    setBusy(slug);
    setError("");
    try {
      await selectAccount(slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เปิดบัญชีไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  };
  return (
    <main className="enrollment">
      <div className="enrollment-art">
        <div className="brand">
          <span className="brand-icon">
            <Heart size={25} />
          </span>
          Wellio<span className="brand-dot">.</span>
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
        <small>บันทึกสุขภาพของมิกและเนม</small>
      </div>
      <section className="enrollment-form">
        <span className="badge">
          <UsersRound size={16} />
          พื้นที่ของมิกและเนม
        </span>
        <h2>ยินดีต้อนรับสู่ Wellio</h2>
        <p>
          วันนี้ใครกำลังใช้งาน? เลือกชื่อเพื่อเริ่มบันทึก
          <br />
          ครั้งต่อไป Wellio จะจำบัญชีเดิมให้เอง
        </p>
        {(error || authError) && <ErrorBox message={error || authError} />}
        {!session && (
          <AccountPicker onSelect={(slug) => void choose(slug)} busy={busy} />
        )}
        <p className="help">
          ไม่ต้องกรอกอีเมล รหัสผ่าน หรือ PIN เปลี่ยนบัญชีได้โดยกดออกจาก session
          แล้วเลือกชื่อใหม่
        </p>
        {session && (
          <button
            className="button secondary full"
            onClick={async () => {
              try {
                await leave();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "ออกจากอุปกรณ์ไม่สำเร็จ",
                );
              }
            }}
          >
            ออกจาก session นี้
          </button>
        )}
        <div className="divider">
          <span>ลองดูก่อนได้</span>
        </div>
        <button
          className="button secondary full"
          disabled={Boolean(busy)}
          onClick={enterDemo}
        >
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
