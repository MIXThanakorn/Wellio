import { useState, type FormEvent } from "react";
import {
  Download,
  ShieldCheck,
  LogOut,
  Trash2,
  Smartphone,
  Heart,
  Check,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { useJournal } from "../journal/useJournal";
import { useUI } from "../../components/AppShell";
import { supabase } from "../../lib/supabase";
import { disableOtherPushDevices } from "../../lib/push";
import { downloadCSV } from "../../lib/export";
import { ErrorBox, Modal } from "../../components/ui";
export function SettingsPage() {
  const { profile, demo, leave, reloadProfile } = useAuth();
  const journal = useJournal();
  const { notify } = useUI();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.display_name || "");
  const [goal, setGoal] = useState(String(profile?.water_goal_ml || ""));
  const [hide, setHide] = useState(profile?.hide_weight || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [revoke, setRevoke] = useState(false);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (demo) {
        throw new Error(
          "การตั้งค่าโปรไฟล์จริงจะเปิดให้ใช้หลังยืนยันอุปกรณ์ โหมดทดลองใช้ค่าตัวอย่าง",
        );
      }
      if (!name.trim() || name.trim().length > 80)
        throw new Error("กรุณาระบุชื่อ 1–80 ตัวอักษร");
      const volume = goal ? Number(goal) : null;
      if (
        volume !== null &&
        (!Number.isInteger(volume) || volume < 1 || volume > 10000)
      )
        throw new Error("ระบุปริมาณน้ำ 1–10,000 มล. หรือเว้นว่าง");
      const { error } = await supabase!
        .from("profiles")
        .update({
          display_name: name.trim(),
          water_goal_ml: volume,
          hide_weight: hide,
        })
        .eq("user_id", profile!.user_id)
        .select()
        .single();
      if (error) throw error;
      await reloadProfile();
      notify("บันทึกความชอบแล้ว");
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  async function clear() {
    setBusy(true);
    setError("");
    try {
      if (confirmation !== "ลบข้อมูลของฉัน") return;
      if (demo) {
        localStorage.removeItem("fitlog-demo-data-v1");
        await leave();
        navigate("/");
        return;
      }
      const { error } = await supabase!.rpc("clear_my_journal");
      if (error) throw error;
      await client.invalidateQueries({ queryKey: ["journal"] });
      setDeleting(false);
      setConfirmation("");
      notify("ลบบันทึกทั้งหมดของคุณแล้ว โปรไฟล์ยังใช้งานได้");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR PERSONAL SPACE</span>
          <h1>โปรไฟล์และตั้งค่า</h1>
          <p>เลือกสิ่งที่เหมาะกับคุณได้เสมอ</p>
        </div>
      </div>
      {error && <ErrorBox message={error} />}
      <div className="settings-grid">
        <section className="card">
          <div className="settings-profile">
            <span className="avatar large">
              {profile?.display_name.slice(0, 1)}
            </span>
            <div>
              <h2>{profile?.display_name}</h2>
              <span className="badge">
                {demo ? "ข้อมูลตัวอย่าง" : "ยืนยันอุปกรณ์แล้ว"}
              </span>
            </div>
          </div>
          <form className="form-stack" onSubmit={save}>
            <label>
              ชื่อที่แสดง
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              ความตั้งใจในการดื่มน้ำ (มล. / วัน)
              <input
                type="number"
                min={1}
                max={10000}
                placeholder="เว้นว่างได้"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </label>
            <p className="help">เป็นค่าที่คุณเลือกเอง ไม่มีค่าเป้าหมายบังคับ</p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={hide}
                onChange={(e) => setHide(e.target.checked)}
              />
              ซ่อนน้ำหนักบนหน้าแรกและกราฟเริ่มต้น
            </label>
            <label>
              เขตเวลา
              <input readOnly value="Asia/Bangkok (UTC+07:00)" />
            </label>
            <button className="button primary" disabled={busy || demo}>
              <Check size={17} />
              บันทึกความชอบ
            </button>
            {demo && <small>เชื่อมบัญชีจริงเพื่อแก้ไขโปรไฟล์</small>}
          </form>
        </section>
        <div>
          <section className="card">
            <h2>
              <Smartphone size={21} />
              อุปกรณ์และความเป็นส่วนตัว
            </h2>
            <p>
              ข้อมูลผูกกับบัญชีที่ยืนยันแล้ว
              การเลือกชื่อคนอื่นไม่สามารถเปิดข้อมูลของเขาได้
            </p>
            <div className="settings-actions">
              <button
                className="settings-action"
                onClick={() => setPrivacy(true)}
              >
                <ShieldCheck size={19} />
                <span>ข้อมูลของคุณถูกดูแลอย่างไร</span>
                <ExternalLink size={16} />
              </button>
              <button
                className="settings-action"
                disabled={demo}
                onClick={() => setRevoke(true)}
              >
                <Smartphone size={19} />
                <span>ยกเลิก session อุปกรณ์อื่น</span>
              </button>
              <button
                className="settings-action"
                onClick={async () => {
                  try {
                    await leave();
                    navigate("/");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "ออกไม่สำเร็จ");
                  }
                }}
              >
                <LogOut size={19} />
                <span>
                  {demo ? "ออกจากโหมดทดลอง" : "ออกจากอุปกรณ์นี้ / เปลี่ยนบัญชี"}
                </span>
              </button>
            </div>
            <p className="help">
              อุปกรณ์ใหม่หรือการเปลี่ยนบัญชีต้องใช้ลิงก์ยืนยันใหม่ Session
              อื่นที่ยกเลิกแล้วอาจใช้ access token เดิมได้จนหมดอายุ
            </p>
          </section>
          <section className="card">
            <h2>จัดการข้อมูลของคุณ</h2>
            <p>ส่งออกบันทึกทั้งหมดของบัญชีนี้เป็น CSV</p>
            <button
              className="button secondary"
              disabled={!journal.data}
              onClick={() => journal.data && downloadCSV(journal.data)}
            >
              <Download size={17} />
              ดาวน์โหลดข้อมูล CSV
            </button>
            <hr />
            <button
              className="text-button danger-text"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={17} />
              ลบบันทึกทั้งหมดของฉัน
            </button>
          </section>
          <div className="app-about">
            <Heart size={20} />
            <b>FitLog</b>
            <p>
              พื้นที่เล็กๆ สำหรับการใส่ใจตัวเอง
              <br />
              เวอร์ชัน 1.0 · อาหาร กิจกรรม และวันธรรมดาที่ดี
            </p>
          </div>
        </div>
      </div>
      {deleting && (
        <Modal
          title={demo ? "ล้างข้อมูลทดลอง?" : "ลบบันทึกทั้งหมดของฉัน?"}
          onClose={() => setDeleting(false)}
        >
          <p>
            อาหาร กิจกรรม น้ำ น้ำหนัก แผน อาหารโปรด
            และการเตือนของคุณจะถูกลบอย่างถาวร โปรไฟล์ของคุณยังอยู่
            และไม่กระทบข้อมูลอีกคน
          </p>
          <p>แนะนำให้ส่งออก CSV ก่อนลบ</p>
          <label>
            พิมพ์ “ลบข้อมูลของฉัน” เพื่อยืนยัน
            <input
              autoFocus
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          </label>
          {error && <ErrorBox message={error} />}
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setDeleting(false)}
            >
              ยกเลิก
            </button>
            <button
              className="button danger"
              disabled={confirmation !== "ลบข้อมูลของฉัน" || busy}
              onClick={() => void clear()}
            >
              ยืนยันลบถาวร
            </button>
          </div>
        </Modal>
      )}
      {revoke && (
        <Modal
          title="ยกเลิก session อุปกรณ์อื่น?"
          onClose={() => setRevoke(false)}
        >
          <p>
            อุปกรณ์อื่นจะต่ออายุ session ไม่ได้ และต้องยืนยันใหม่หลัง access
            token หมดอายุ อุปกรณ์นี้ยังใช้งานต่อได้ และระบบจะปิด push
            ของอุปกรณ์อื่นด้วย
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setRevoke(false)}
            >
              ยกเลิก
            </button>
            <button
              className="button primary"
              onClick={async () => {
                try {
                  await disableOtherPushDevices(profile!.user_id);
                  const { error } = await supabase!.auth.signOut({
                    scope: "others",
                  });
                  if (error) setError(error.message);
                  else {
                    setRevoke(false);
                    notify("ยกเลิก session อื่นแล้ว");
                  }
                } catch (e) {
                  setError(e instanceof Error ? e.message : "ยกเลิกไม่สำเร็จ");
                }
              }}
            >
              ยืนยัน
            </button>
          </div>
        </Modal>
      )}
      {privacy && (
        <Modal title="ความเป็นส่วนตัวของคุณ" onClose={() => setPrivacy(false)}>
          <div className="privacy-copy">
            <p>
              FitLog เก็บชื่อ บันทึกอาหาร กิจกรรม น้ำดื่ม น้ำหนัก แผน
              และการตั้งค่าใน Supabase โปรเจ็กต์ lessweight โดยมี RLS
              แยกข้อมูลตามบัญชี
            </p>
            <p>
              มิกและเนมเห็นเฉพาะข้อมูลของตัวเอง ผู้ดูแลโปรเจ็กต์ Supabase
              ที่มีสิทธิ์จัดการฐานข้อมูลสามารถเข้าถึงข้อมูลได้
              ไม่มีแผนที่แชร์กันโดยอัตโนมัติ
            </p>
            <p>
              Session เก็บไว้ในเบราว์เซอร์ของอุปกรณ์นี้ ไม่ควรใช้อุปกรณ์สาธารณะ
              สำหรับข้อมูลทดลอง เก็บแยกใน localStorage และล้างได้
            </p>
            <p>
              Push เป็นตัวเลือก หากเปิดไว้ ระบบจะเก็บ endpoint
              และกุญแจของอุปกรณ์เพื่อส่งข้อความเตือนทั่วไป
              ไม่มีรายละเอียดน้ำหนักหรือมื้ออาหารในข้อความ push
            </p>
            <p>
              แอปนี้ไม่ใช่บริการการแพทย์
              คุณส่งออกหรือลบข้อมูลบันทึกได้ในหน้าตั้งค่า
              ข้อมูลสำรองของผู้ให้บริการเป็นไปตามนโยบายสำรองข้อมูลของ Supabase
            </p>
          </div>
          <button
            className="button primary full"
            onClick={() => setPrivacy(false)}
          >
            เข้าใจแล้ว
          </button>
        </Modal>
      )}
    </>
  );
}
