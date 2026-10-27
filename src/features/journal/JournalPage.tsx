import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Search, ChevronLeft, ChevronRight, Star, X } from "lucide-react";
import { useJournal } from "./useJournal";
import { useUI } from "../../components/AppShell";
import { Timeline } from "./Timeline";
import { ErrorBox, Loading, Modal } from "../../components/ui";
import { dayKey, shiftDay, thaiDate } from "../../lib/dates";
import { mealLabels, type EntryKind, type Favorite } from "../../lib/types";
export function JournalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [day, setDay] = useState(dayKey());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<EntryKind | "all">(
    location.pathname === "/activities" ? "activity" : "all",
  );
  const [mealType, setMealType] = useState("all");
  const [allDates, setAllDates] = useState(false);
  const [deletingFavorite, setDeletingFavorite] = useState<Favorite | null>(
    null,
  );
  const journal = useJournal();
  const { add, notify } = useUI();
  if (journal.isPending) return <Loading />;
  if (journal.isError)
    return (
      <ErrorBox
        message={journal.error.message}
        onRetry={() => void journal.refetch()}
      />
    );
  const data = journal.data!;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR DAILY JOURNAL</span>
          <h1>บันทึกประจำวัน</h1>
          <p>เก็บเรื่องราวเล็กๆ ในแต่ละวันของคุณ</p>
        </div>
        <button
          className="button primary"
          onClick={() => add(filter === "all" ? undefined : filter)}
        >
          <Plus size={18} />
          เพิ่มบันทึก
        </button>
      </div>
      <section className="card">
        <div className="journal-toolbar">
          <div className="date-switcher">
            <button
              className="icon-button"
              aria-label="วันก่อนหน้า"
              onClick={() => setDay(shiftDay(day, -1))}
            >
              <ChevronLeft size={19} />
            </button>
            <label className="sr-only" htmlFor="journal-date">
              วันที่บันทึก
            </label>
            <input
              id="journal-date"
              type="date"
              max={dayKey()}
              value={day}
              onChange={(e) => {
                if (e.target.value) setDay(e.target.value);
              }}
            />
            <button
              className="icon-button"
              aria-label="วันถัดไป"
              disabled={day >= dayKey()}
              onClick={() => setDay(shiftDay(day, 1))}
            >
              <ChevronRight size={19} />
            </button>
            <button
              className="button secondary today-button"
              disabled={day === dayKey() && !allDates}
              onClick={() => {
                setDay(dayKey());
                setAllDates(false);
              }}
            >
              วันนี้
            </button>
          </div>
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="ค้นหาบันทึก"
              placeholder="ค้นหาบันทึกของคุณ…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={allDates}
              onChange={(e) => setAllDates(e.target.checked)}
            />
            ค้นหาทุกวัน
          </label>
        </div>
        <div className="tabs">
          {(
            [
              ["all", "ทั้งหมด"],
              ["meal", "มื้ออาหาร"],
              ["activity", "กิจกรรม"],
              ["water", "น้ำดื่ม"],
              ["weight", "เช็กอิน"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => {
                setFilter(key);
                if (key === "activity") navigate("/activities");
                else navigate("/meals");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {filter === "meal" && (
          <div className="filter-row">
            <button
              className={`chip ${mealType === "all" ? "selected" : ""}`}
              onClick={() => setMealType("all")}
            >
              ทุกมื้อ
            </button>
            {Object.entries(mealLabels).map(([key, label]) => (
              <button
                key={key}
                className={`chip ${mealType === key ? "selected" : ""}`}
                onClick={() => setMealType(key)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <h2 className="journal-date-title">
          {allDates ? "ประวัติทั้งหมด" : thaiDate(day + "T12:00:00+07:00")}
        </h2>
        <Timeline
          data={data}
          day={allDates ? undefined : day}
          filter={filter === "all" ? undefined : filter}
          search={search}
          mealType={filter === "meal" ? mealType : "all"}
          showDate={allDates}
        />
      </section>
      {data.favorites.length > 0 && (
        <section className="card favorites-card">
          <h2>
            <Star size={19} />
            มื้อโปรดของคุณ
          </h2>
          <p>แตะชื่ออาหารเพื่อเพิ่มเป็นบันทึกใหม่</p>
          <div className="favorite-pills">
            {data.favorites.map((f) => (
              <span className="favorite-item" key={f.id}>
                <button
                  className="chip"
                  onClick={() =>
                    add("meal", {
                      name: f.name,
                      meal_type: f.meal_type,
                      portion_text: f.portion_text,
                    })
                  }
                >
                  {f.name}
                  <Plus size={14} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`นำ ${f.name} ออกจากอาหารโปรด`}
                  onClick={() => setDeletingFavorite(f)}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </section>
      )}
      {deletingFavorite && (
        <Modal
          title="นำอาหารโปรดออก?"
          onClose={() => setDeletingFavorite(null)}
        >
          <p>
            นำ “{deletingFavorite.name}” ออกจากรายการโปรด
            บันทึกมื้ออาหารเดิมยังอยู่
          </p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setDeletingFavorite(null)}
            >
              ยกเลิก
            </button>
            <button
              className="button danger"
              disabled={journal.saving}
              onClick={async () => {
                try {
                  await journal.remove("favorites", deletingFavorite.id);
                  setDeletingFavorite(null);
                  notify("นำออกจากรายการโปรดแล้ว");
                } catch (e) {
                  notify(e instanceof Error ? e.message : "แก้ไขไม่สำเร็จ");
                }
              }}
            >
              ยืนยันนำออก
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
