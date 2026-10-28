import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  lazy,
  Suspense,
} from "react";
import {
  Heart,
  LayoutDashboard,
  NotebookPen,
  CalendarDays,
  ChartNoAxesCombined,
  CalendarCheck2,
  Bell,
  Settings,
  Plus,
  UsersRound,
  ArrowRight,
  LogOut,
  X,
  BookOpen,
} from "lucide-react";
import { useAuth } from "../features/auth/AuthProvider";
import { kindIcons } from "../features/journal/kindIcons";
const EntryForm = lazy(() =>
  import("../features/journal/EntryForm").then((m) => ({
    default: m.EntryForm,
  })),
);
import { Modal } from "./ui";
import { kindLabels, type EntryKind } from "../lib/types";
import { dayKey } from "../lib/dates";
import { listDrafts, draftScope, type Draft } from "../features/journal/drafts";
import { UndoNotice } from "../features/journal/UndoNotice";
interface Actions {
  add: (kind?: EntryKind, initial?: Record<string, unknown>) => void;
  notify: (text: string) => void;
  setEntryDay: (day?: string) => void;
}
const UIContext = createContext<Actions | null>(null);
export function useUI() {
  return useContext(UIContext)!;
}
const nav = [
  ["/", "หน้าแรก", LayoutDashboard],
  ["/meals", "บันทึกประจำวัน", NotebookPen],
  ["/calendar", "ปฏิทิน", CalendarDays],
  ["/progress", "ความคืบหน้า", ChartNoAxesCombined],
  ["/plans", "แผนของฉัน", CalendarCheck2],
] as const;
export function AppShell() {
  const { profile, demo, leave } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sheet, setSheet] = useState(false);
  const [entryDay, setEntryDay] = useState<string | undefined>();
  const [sheetInitial, setSheetInitial] = useState<
    Record<string, unknown> | undefined
  >();
  const [entry, setEntry] = useState<{
    kind: EntryKind;
    initial?: Record<string, unknown>;
  } | null>(null);
  const [toast, setToast] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const scope = draftScope(profile!.user_id, demo);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  useEffect(() => {
    const read = () => setDrafts(listDrafts(scope));
    read();
    window.addEventListener("wellio-drafts", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("wellio-drafts", read);
      window.removeEventListener("storage", read);
    };
  }, [scope]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  const add: Actions["add"] = (kind, initial) => {
    if (!initial?.id && !initial?._draftKey && entryDay && entryDay > dayKey())
      return;
    if (!initial?.id && !initial?._draftKey && entryDay && !initial?._day)
      initial = { ...initial, _day: entryDay };
    if (kind) {
      setEntry({ kind, initial });
      setSheet(false);
    } else {
      setSheetInitial(initial);
      setSheet(true);
    }
  };
  const logout = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await leave();
      navigate("/");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "ออกจากระบบไม่สำเร็จ");
    } finally {
      setLeaving(false);
    }
  };
  return (
    <UIContext.Provider value={{ add, notify: setToast, setEntryDay }}>
      <div className="app-shell">
        <aside className="sidebar">
          <NavLink to="/" className="brand">
            <span className="brand-icon">
              <Heart size={23} />
            </span>
            Wellio<span className="brand-dot">.</span>
          </NavLink>
          <p className="sidebar-caption">พื้นที่เล็กๆ เพื่อสุขภาพที่ดี</p>
          <span className="nav-label">ทุกวันของคุณ</span>
          <nav>
            {nav.map(([path, label, Icon]) => (
              <NavLink key={path} to={path} end={path === "/"}>
                <Icon size={21} />
                {label}
              </NavLink>
            ))}
          </nav>
          <span className="nav-label">การตั้งค่า</span>
          <nav>
            <NavLink to="/reminders">
              <Bell size={21} />
              การแจ้งเตือน
            </NavLink>
            <NavLink to="/settings">
              <Settings size={21} />
              โปรไฟล์และตั้งค่า
            </NavLink>
            <NavLink to="/guide">
              <BookOpen size={21} />
              วิธีใช้ Wellio
            </NavLink>
          </nav>
          <div className="sidebar-note">
            <span className="little-leaf">✳</span>
            <h3>
              ไม่ต้องสมบูรณ์แบบ
              <br />
              แค่ใส่ใจตัวเองก็พอ
            </h3>
            <p>
              เริ่มต้นใหม่ได้ทุกวัน
              <br />
              ในแบบที่เป็นคุณ
            </p>
          </div>
          <button
            className="profile-mini"
            onClick={() => navigate("/settings")}
          >
            <span className="avatar">{profile?.display_name.slice(0, 1)}</span>
            <span>
              <b>{profile?.display_name}</b>
              <small>{demo ? "กำลังทดลองใช้งาน" : "บัญชีที่เลือก"}</small>
            </span>
            <ArrowRight size={17} />
          </button>
        </aside>
        <div className="main-area">
          <header className="topbar">
            <div className="breadcrumb">
              พื้นที่ของ {profile?.display_name}
              <span>/</span>
              <b>
                {nav.find((n) => n[0] === location.pathname)?.[1] ||
                  (
                    {
                      "/reminders": "การแจ้งเตือน",
                      "/settings": "โปรไฟล์และตั้งค่า",
                      "/activities": "กิจกรรม",
                      "/guide": "วิธีใช้ Wellio",
                    } as Record<string, string>
                  )[location.pathname] ||
                  "บันทึก"}
              </b>
            </div>
            <div className="topbar-actions">
              <button
                className="logout-button"
                aria-label="เปลี่ยนคนหรือออกจากบัญชี"
                disabled={leaving}
                onClick={() => void logout()}
              >
                <LogOut size={19} />
                <span>{leaving ? "กำลังออก…" : "เปลี่ยนคน / ออก"}</span>
              </button>
              <span className="privacy-tag current-account">
                <UsersRound size={15} />
                กำลังใช้: {profile?.display_name}
              </span>
              <NavLink className="topbar-help" to="/guide">
                <BookOpen size={18} />
                <span>วิธีใช้</span>
              </NavLink>
              <button
                className="icon-button notification-button"
                aria-label="การแจ้งเตือน"
                onClick={() => navigate("/reminders")}
              >
                <Bell size={20} />
              </button>
              <button
                className="avatar small"
                aria-label="เปิดโปรไฟล์"
                onClick={() => navigate("/settings")}
              >
                {profile?.display_name.slice(0, 1)}
              </button>
            </div>
          </header>
          {demo && (
            <div className="demo-banner">
              <span>
                โหมดทดลอง · ข้อมูลทั้งหมดเป็นข้อมูลสมมติ เก็บในเบราว์เซอร์นี้
              </span>
              <button onClick={() => void logout()}>
                เลือกบัญชีจริง
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          {!online && (
            <div className="offline-banner" role="status">
              อินเทอร์เน็ตขาดหาย · ดูข้อมูลที่เปิดไว้ได้
              เชื่อมต่ออีกครั้งก่อนบันทึก
            </div>
          )}
          <main className="page-content" id="main-content">
            {!entry && drafts.length > 0 && (
              <div className="draft-resume" role="status">
                <div>
                  <b>
                    มีบันทึกที่กรอกค้างไว้
                    {drafts.length > 1 ? ` ${drafts.length} รายการ` : ""}
                  </b>
                  <p>
                    {kindLabels[drafts[0].kind]}
                    {drafts[0].name ? ` · ${drafts[0].name}` : ""}
                  </p>
                </div>
                <button
                  className="button secondary"
                  onClick={() =>
                    add(drafts[0].kind, {
                      ...drafts[0].initial,
                      _draftKey: drafts[0].key,
                    })
                  }
                >
                  กรอกต่อ
                </button>
              </div>
            )}
            <Outlet />
          </main>
          <footer className="page-footer">
            <Heart size={13} />
            ดูแลตัวเองในจังหวะที่เป็นคุณ <span>Wellio · for your everyday</span>
          </footer>
        </div>
        <nav className="bottom-nav" aria-label="เมนูหลัก">
          <NavLink to="/" end>
            <LayoutDashboard size={21} />
            <span>หน้าแรก</span>
          </NavLink>
          <NavLink to="/meals">
            <NotebookPen size={21} />
            <span>บันทึก</span>
          </NavLink>
          <button
            className="mobile-add"
            disabled={Boolean(entryDay && entryDay > dayKey())}
            onClick={() => add()}
          >
            <span>
              <Plus size={25} />
            </span>
            เพิ่มบันทึก
          </button>
          <NavLink to="/plans">
            <CalendarCheck2 size={21} />
            <span>แผน</span>
          </NavLink>
          <NavLink to="/settings">
            <Settings size={21} />
            <span>ตั้งค่า</span>
          </NavLink>
        </nav>
        {sheet && (
          <Modal title="วันนี้อยากบันทึกอะไร?" onClose={() => setSheet(false)}>
            <div className="quick-add-options">
              {(Object.keys(kindLabels) as EntryKind[]).map((kind) => {
                const Icon = kindIcons[kind];
                return (
                  <button
                    key={kind}
                    className={`quick-option ${kind}`}
                    aria-label={`เพิ่ม${kindLabels[kind]}`}
                    onClick={() => add(kind, sheetInitial)}
                  >
                    <span className="entry-icon">
                      <Icon size={24} />
                    </span>
                    <span className="quick-option-copy">
                      <b>เพิ่ม{kindLabels[kind]}</b>
                      <small>
                        {
                          {
                            meal: "จดชื่ออาหาร หรือแนบรูปมื้อที่กิน",
                            water: "เลือกปริมาณน้ำที่เพิ่งดื่ม",
                            activity: "จดกิจกรรมและเวลาที่ทำ",
                            weight: "บันทึกเมื่อสะดวก ไม่บังคับ",
                          }[kind]
                        }
                      </small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                );
              })}
            </div>
          </Modal>
        )}
        {entry && (
          <Suspense
            fallback={
              <Modal title="กำลังเปิดแบบบันทึก…" onClose={() => setEntry(null)}>
                <p role="status">รอสักครู่ กำลังเตรียมแบบบันทึกให้คุณ</p>
              </Modal>
            }
          >
            <EntryForm
              kind={entry.kind}
              initial={entry.initial}
              onClose={() => setEntry(null)}
              onSaved={() => {
                setEntry(null);
                setToast("บันทึกเรียบร้อยแล้ว");
              }}
            />
          </Suspense>
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
            <button aria-label="ปิดข้อความ" onClick={() => setToast("")}>
              <X size={16} />
            </button>
          </div>
        )}
        <UndoNotice scope={scope} onDone={setToast} />
      </div>
    </UIContext.Provider>
  );
}
