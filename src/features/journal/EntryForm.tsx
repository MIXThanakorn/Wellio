import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  listDrafts,
  draftScope,
  draftKey,
  writeDraft,
  deleteDraft,
  draftMedia,
  type Draft,
} from "./drafts";
import {
  Check,
  Utensils,
  Footprints,
  Scale,
  Droplets,
  ImagePlus,
  Trash2,
  Camera,
  ChevronDown,
  RotateCcw,
  RotateCw,
  Crop,
} from "lucide-react";
import { Modal, ErrorBox } from "../../components/ui";
import { localInput, fromLocal, dayKey, thaiDate } from "../../lib/dates";
import {
  kindLabels,
  mealLabels,
  activityLabels,
  type EntryKind,
} from "../../lib/types";
import {
  mealSchema,
  activitySchema,
  checkinSchema,
  waterSchema,
} from "../../lib/validation";
import { useJournal } from "./useJournal";
import { useAuth } from "../auth/AuthProvider";
import {
  prepareMealPhoto,
  storeMealPhoto,
  removeMealPhoto,
  transformMealPhoto,
  mealPhotoUrl,
} from "../meals/photos";
import { MealPhoto } from "../meals/MealPhoto";
export { kindIcons } from "./kindIcons";
export function EntryForm({
  kind,
  initial: requestedInitial,
  onClose,
  onSaved,
}: {
  kind: EntryKind;
  initial?: Record<string, unknown>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const journal = useJournal();
  const { profile, demo } = useAuth();
  const [setup] = useState(() => {
    const scope = draftScope(profile!.user_id, demo);
    const drafts = listDrafts(scope);
    const pending = requestedInitial?._draftKey
      ? drafts.find((d) => d.key === requestedInitial._draftKey)
      : requestedInitial?.id
        ? drafts.find(
            (d) => d.kind === kind && d.initial?.id === requestedInitial.id,
          )
        : !requestedInitial
          ? drafts.find((d) => d.kind === kind && !d.initial?.id)
          : undefined;
    const source = pending?.initial || requestedInitial;
    const id = pending?.id || String(source?.id || crypto.randomUUID());
    return {
      pending,
      source,
      id,
      key:
        pending?.key || draftKey(scope, kind, source?.id ? `edit_${id}` : id),
    };
  });
  const initial = setup.source;
  const draft = setup.pending;
  const activeDraft = useRef(true);
  const mediaPersisted = useRef(true);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [sourcePhoto, setSourcePhoto] = useState<Blob | null>(null);
  const [removePhoto, setRemovePhoto] = useState(draft?.removePhoto || false);
  const [preparing, setPreparing] = useState(Boolean(draft?.photoKey));
  const [mediaReady, setMediaReady] = useState(!draft?.photoKey);
  const [draftStored, setDraftStored] = useState(true);
  const [uploaded, setUploaded] = useState<string | undefined>(draft?.uploaded);
  const [uploadId, setUploadId] = useState(
    draft?.photoKey?.split(":").at(-1) || crypto.randomUUID(),
  );
  const [progress, setProgress] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const existingPhoto =
    typeof initial?.photo_path === "string" ? initial.photo_path : null;
  const [error, setError] = useState("");
  const [name, setName] = useState(draft?.name ?? String(initial?.name || ""));
  const [category, setCategory] = useState(
    draft?.category ??
      String(
        initial?.meal_type ||
          initial?.activity_type ||
          (kind === "meal" ? "breakfast" : "walking"),
      ),
  );
  const [when, setWhen] = useState(
    draft?.when ??
      (kind === "weight"
        ? String(initial?.checkin_date || initial?._day || dayKey())
        : initial?._day
          ? `${String(initial._day)}T${localInput().slice(11)}`
          : localInput(
              String(
                initial?.eaten_at ||
                  initial?.started_at ||
                  initial?.consumed_at ||
                  new Date().toISOString(),
              ),
            )),
  );
  const [amount, setAmount] = useState(
    draft?.amount ??
      String(
        initial?.duration_minutes ||
          initial?.weight_kg ||
          initial?.amount_ml ||
          (kind === "water" ? 250 : ""),
      ),
  );
  const [notes, setNotes] = useState(
    draft?.notes ?? String(initial?.notes || ""),
  );
  const [portion, setPortion] = useState(
    draft?.portion ?? String(initial?.portion_text || ""),
  );
  const [effort, setEffort] = useState(
    draft?.effort ?? String(initial?.effort || "light"),
  );
  const [discarding, setDiscarding] = useState(false);
  const snapshot = JSON.stringify([
    name,
    category,
    when,
    amount,
    notes,
    portion,
    effort,
  ]);
  const [original] = useState(snapshot);
  const dirty =
    snapshot !== original || Boolean(photo) || removePhoto || Boolean(draft);
  useEffect(() => {
    if (!draft?.photoKey) return;
    let canceled = false;
    draftMedia<Blob | undefined>("readonly", (store) =>
      store.get(draft.photoKey!),
    )
      .then((blob) => {
        if (!canceled) {
          if (blob) {
            setPhoto(blob);
            setSourcePhoto(blob);
          } else setError("รูปที่แนบค้างไว้หายไป กรุณาเลือกรูปอีกครั้ง");
        }
      })
      .catch(() => {
        if (!canceled)
          setError("เปิดรูปที่แนบค้างไว้ไม่ได้ กรุณาเลือกรูปอีกครั้ง");
      })
      .finally(() => {
        if (!canceled) {
          setPreparing(false);
          setMediaReady(true);
        }
      });
    return () => {
      canceled = true;
    };
  }, []);
  useEffect(() => {
    if (!activeDraft.current || !mediaReady) return;
    if (!dirty) {
      deleteDraft(setup.key);
      return;
    }
    const current: Draft = {
      key: setup.key,
      kind,
      initial,
      id: setup.id,
      name,
      category,
      when,
      amount,
      notes,
      portion,
      effort,
      removePhoto,
      photoKey: photo ? `${setup.key}:photo:${uploadId}` : undefined,
      uploaded,
      updatedAt: Date.now(),
    };
    setDraftStored(writeDraft(current) && mediaPersisted.current);
  }, [snapshot, photo, removePhoto, uploaded, uploadId, mediaReady]);
  const discard = () => {
    activeDraft.current = false;
    deleteDraft(setup.key);
    if (photo)
      void draftMedia("readwrite", (s) =>
        s.delete(`${setup.key}:photo:${uploadId}`),
      ).catch(() => {});
    onClose();
  };
  const requestClose = () => {
    if (dirty) setDiscarding(true);
    else onClose();
  };
  async function choosePhoto(file: File) {
    setPreparing(true);
    setError("");
    try {
      const blob = await prepareMealPhoto(file);
      await persistPhoto(blob);
      setSourcePhoto(blob);
      setRemovePhoto(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เตรียมรูปไม่สำเร็จ");
    } finally {
      setPreparing(false);
    }
  }
  async function persistPhoto(blob: Blob) {
    const photoId = crypto.randomUUID();
    try {
      await draftMedia("readwrite", (store) =>
        store.put(blob, `${setup.key}:photo:${photoId}`),
      );
      mediaPersisted.current = true;
    } catch {
      mediaPersisted.current = false;
      setDraftStored(false);
    }
    setPhoto(blob);
    setUploadId(photoId);
    setUploaded(undefined);
  }
  async function adjustPhoto(rotation: number, square = false, reset = false) {
    if (!photo || preparing || submitting) return;
    setPreparing(true);
    setError("");
    try {
      await persistPhoto(
        reset && sourcePhoto
          ? sourcePhoto
          : await transformMealPhoto(photo, rotation, square),
      );
    } catch {
      setError("ปรับรูปไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setPreparing(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting || preparing) return;
    setSubmitting(true);
    setError("");
    let nextUploaded = uploaded;
    try {
      const raw =
        kind === "meal"
          ? {
              name,
              meal_type: category,
              eaten_at: fromLocal(when),
              portion_text: portion || null,
              notes: notes || null,
            }
          : kind === "activity"
            ? {
                activity_type: category,
                started_at: fromLocal(when),
                duration_minutes: amount,
                effort,
                notes: notes || null,
              }
            : kind === "weight"
              ? { checkin_date: when, weight_kg: amount, notes: notes || null }
              : { consumed_at: fromLocal(when), amount_ml: amount };
      const schema = {
        meal: mealSchema,
        activity: activitySchema,
        weight: checkinSchema,
        water: waterSchema,
      }[kind];
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        setError(parsed.error.issues[0].message);
        return;
      }
      if (kind === "meal" && photo && nextUploaded) {
        try {
          await mealPhotoUrl(nextUploaded, demo);
        } catch {
          nextUploaded = undefined;
          setUploaded(undefined);
        }
      }
      if (kind === "meal" && photo && !nextUploaded) {
        if (!profile) throw new Error("กรุณาเลือกบัญชีก่อน");
        setProgress(0);
        nextUploaded = await storeMealPhoto(
          photo,
          profile.user_id,
          demo,
          setProgress,
          uploadId,
        );
        setUploaded(nextUploaded);
      }
      setSending(true);
      await journal.save(
        (
          {
            meal: "meals",
            activity: "activities",
            weight: "checkins",
            water: "water",
          } as const
        )[kind],
        {
          ...parsed.data,
          ...(kind === "meal"
            ? {
                photo_path:
                  nextUploaded || (removePhoto ? null : existingPhoto),
              }
            : {}),
          id: setup.id,
        },
        { create: !initial?.id },
      );
      activeDraft.current = false;
      deleteDraft(setup.key);
      if (photo)
        void draftMedia("readwrite", (s) =>
          s.delete(`${setup.key}:photo:${uploadId}`),
        ).catch(() => {});
      if (existingPhoto && (nextUploaded || removePhoto) && profile) {
        try {
          await removeMealPhoto(existingPhoto, profile.user_id, demo);
        } catch {
          console.warn(
            "Previous meal photo will be removed by scheduled cleanup.",
          );
        }
      }
      onSaved();
    } catch (e) {
      // A lost response can follow a committed write. Retain its photo and stable row ID for safe retry.
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
      setSending(false);
      setProgress(null);
    }
  }
  return (
    <>
      <Modal
        title={`${initial?.id ? "แก้ไข" : "เพิ่ม"}${kindLabels[kind]}`}
        onClose={requestClose}
        busy={submitting || preparing}
      >
        <form onSubmit={submit} className="form-stack">
          <p className="entry-form-hint">
            บันทึกให้ <strong>{profile?.display_name}</strong> ·{" "}
            {initial?.id ? "แก้ไขรายการเดิม" : "วันที่และเวลาใส่ให้แล้ว"}
          </p>
          {error && <ErrorBox message={error} />}
          {dirty && (
            <p className="draft-hint" role="status">
              {draftStored
                ? "จำข้อมูลที่กรอกไว้บนอุปกรณ์นี้แล้ว ยังไม่ส่งเข้าบันทึกจนกว่าจะกดบันทึก"
                : "อุปกรณ์นี้ยังจำข้อมูลค้างไม่ได้ กรุณาอย่าปิดฟอร์มก่อนบันทึก"}
            </p>
          )}
          {submitting && (
            <div className="save-progress" role="status">
              {sending
                ? "กำลังยืนยันการบันทึก… กรุณารอสักครู่"
                : progress === null
                  ? "กำลังตรวจข้อมูลก่อนส่ง…"
                  : `กำลังส่งรูป ${progress}%`}
              {!sending && progress !== null && (
                <progress max="100" value={progress} />
              )}
            </div>
          )}
          <fieldset className="form-content" disabled={submitting}>
            {kind === "meal" && (
              <>
                <label>
                  ชื่ออาหาร
                  <input
                    autoFocus
                    required
                    maxLength={200}
                    placeholder="วันนี้กินอะไรอร่อยๆ?"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                {journal.data?.favorites.length !== 0 && (
                  <div className="favorite-pills">
                    {journal.data?.favorites.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className="chip"
                        onClick={() => {
                          setName(f.name);
                          setCategory(f.meal_type);
                          setPortion(f.portion_text || "");
                        }}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
                <label>
                  มื้ออาหาร
                  <select
                    aria-label="มื้ออาหาร"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {Object.entries(mealLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset className="photo-field">
                  <legend>
                    รูปอาหาร <span>(ไม่บังคับ)</span>
                  </legend>
                  {preview ? (
                    <div className="photo-preview">
                      <img src={preview} alt="ตัวอย่างรูปอาหารก่อนบันทึก" />
                      <div className="photo-edit-actions">
                        <button
                          type="button"
                          disabled={preparing}
                          onClick={() => void adjustPhoto(-90)}
                        >
                          <RotateCcw size={17} />
                          หมุนซ้าย
                        </button>
                        <button
                          type="button"
                          disabled={preparing}
                          onClick={() => void adjustPhoto(90)}
                        >
                          <RotateCw size={17} />
                          หมุนขวา
                        </button>
                        <button
                          type="button"
                          disabled={preparing}
                          onClick={() => void adjustPhoto(0, true)}
                        >
                          <Crop size={17} />
                          ตัดสี่เหลี่ยม
                        </button>
                        <button
                          type="button"
                          disabled={preparing}
                          onClick={() => void adjustPhoto(0, false, true)}
                        >
                          คืนรูปเดิม
                        </button>
                      </div>
                      <button
                        type="button"
                        className="text-button danger-text"
                        onClick={() => {
                          setPhoto(null);
                          setUploaded(undefined);
                        }}
                      >
                        <Trash2 size={16} />
                        นำรูปที่เลือกออก
                      </button>
                    </div>
                  ) : existingPhoto && !removePhoto ? (
                    <div className="photo-preview">
                      <MealPhoto
                        path={existingPhoto}
                        name={name || "มื้อนี้"}
                      />
                      <button
                        type="button"
                        className="text-button danger-text"
                        onClick={() => setRemovePhoto(true)}
                      >
                        <Trash2 size={16} />
                        นำรูปเดิมออก
                      </button>
                    </div>
                  ) : null}
                  {removePhoto && !photo && (
                    <p className="help">
                      รูปจะถูกนำออกเมื่อกดบันทึก{" "}
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setRemovePhoto(false)}
                      >
                        เก็บรูปเดิมไว้
                      </button>
                    </p>
                  )}
                  <div className="photo-source-options">
                    <label className="photo-upload-control camera-control">
                      <Camera size={20} />
                      <span>ถ่ายรูปอาหาร</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        aria-label="ถ่ายรูปอาหาร"
                        className="sr-only"
                        disabled={preparing || submitting}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void choosePhoto(file);
                        }}
                      />
                    </label>
                    <label className="photo-upload-control">
                      <ImagePlus size={20} />
                      <span>
                        {preparing
                          ? "กำลังเตรียมรูป…"
                          : preview || (existingPhoto && !removePhoto)
                            ? "เลือกรูปใหม่"
                            : "เลือกรูปอาหาร"}
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                        aria-label="แนบรูปอาหาร"
                        className="sr-only"
                        disabled={preparing || submitting}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) void choosePhoto(file);
                        }}
                      />
                    </label>
                  </div>
                  <small>
                    แนบได้ 1 รูป · JPG, PNG, WebP หรือ HEIC ไม่เกิน 10 MB
                    ระบบย่อรูปให้อัตโนมัติ
                  </small>
                  {demo && (
                    <small>โหมดทดลองเก็บรูปไว้ในเบราว์เซอร์นี้เท่านั้น</small>
                  )}
                  {preparing && (
                    <p className="help" role="status">
                      กำลังเตรียมรูป รอสักครู่…
                    </p>
                  )}
                </fieldset>
              </>
            )}
            {kind === "activity" && (
              <>
                <label>
                  ประเภทกิจกรรม
                  <select
                    aria-label="ประเภทกิจกรรม"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {Object.entries(activityLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  ความรู้สึกระหว่างทำ
                  <select
                    aria-label="ความรู้สึกระหว่างทำ"
                    value={effort}
                    onChange={(e) => setEffort(e.target.value)}
                  >
                    <option value="light">เบา สบายๆ</option>
                    <option value="moderate">ปานกลาง</option>
                    <option value="vigorous">ค่อนข้างหนัก</option>
                  </select>
                </label>
              </>
            )}
            {kind !== "meal" && (
              <>
                {(kind === "water" || kind === "activity") && (
                  <div
                    className="amount-presets"
                    role="group"
                    aria-label={
                      kind === "water" ? "เลือกปริมาณน้ำ" : "เลือกระยะเวลา"
                    }
                  >
                    {(kind === "water" ? [250, 500, 750] : [10, 20, 30]).map(
                      (value) => (
                        <button
                          type="button"
                          key={value}
                          className={amount === String(value) ? "selected" : ""}
                          aria-pressed={amount === String(value)}
                          onClick={() => setAmount(String(value))}
                        >
                          <b>{value}</b> {kind === "water" ? "มล." : "นาที"}
                        </button>
                      ),
                    )}
                  </div>
                )}
                <label>
                  {kind === "activity"
                    ? "ระยะเวลา (นาที)"
                    : kind === "weight"
                      ? "น้ำหนัก (กก.)"
                      : "ปริมาณน้ำ (มล.)"}
                  <input
                    autoFocus={kind !== "activity"}
                    required
                    type="number"
                    inputMode="decimal"
                    min={kind === "weight" ? 0.01 : 1}
                    max={
                      kind === "activity"
                        ? 1440
                        : kind === "weight"
                          ? 1000
                          : 5000
                    }
                    step={kind === "weight" ? "0.01" : "1"}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
              </>
            )}
            <details
              className="entry-details"
              open={
                kind === "weight" || Boolean(initial?.id) ? true : undefined
              }
            >
              <summary>
                <span>
                  รายละเอียดเพิ่มเติม{" "}
                  <small>
                    แก้วันที่
                    {kind === "meal"
                      ? " ปริมาณ หรือโน้ต"
                      : kind !== "water"
                        ? " หรือโน้ต"
                        : "และเวลา"}
                  </small>
                </span>
                <ChevronDown size={19} />
              </summary>
              <div className="form-stack">
                {kind === "meal" && (
                  <label>
                    ปริมาณ <span>(ไม่บังคับ)</span>
                    <input
                      maxLength={200}
                      placeholder="เช่น 1 จาน"
                      value={portion}
                      onChange={(e) => setPortion(e.target.value)}
                    />
                  </label>
                )}
                <label>
                  {kind === "weight" ? "วันที่" : "วันและเวลา (เวลาไทย)"}
                  <input
                    required
                    type={kind === "weight" ? "date" : "datetime-local"}
                    max={kind === "weight" ? dayKey() : localInput()}
                    value={when}
                    onChange={(e) => setWhen(e.target.value)}
                  />
                </label>
                {kind !== "water" && (
                  <label>
                    บันทึกเพิ่มเติม <span>(ไม่บังคับ)</span>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      placeholder="ความรู้สึก หรือสิ่งที่อยากจดไว้…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </label>
                )}
              </div>
            </details>
            {kind !== "weight" && (
              <p className="entry-date-summary">
                วันที่บันทึก:{" "}
                {when && Number.isFinite(new Date(`${when}:00+07:00`).getTime())
                  ? thaiDate(fromLocal(when), true)
                  : "กรุณาเลือกวันและเวลา"}
              </p>
            )}
            {kind === "weight" && (
              <p className="help">
                บันทึกเมื่อคุณสะดวก ตัวเลขเป็นเพียงข้อมูลหนึ่ง ไม่ใช่คะแนนของวัน
              </p>
            )}
            <div className="entry-save-bar">
              <button
                type="button"
                className="button secondary"
                onClick={requestClose}
                disabled={submitting || preparing}
              >
                ยกเลิก
              </button>
              <button
                className="button primary full"
                disabled={submitting || preparing || journal.saving}
              >
                <Check size={18} />
                {submitting
                  ? photo
                    ? "กำลังอัปโหลดและบันทึก…"
                    : "กำลังบันทึก…"
                  : "บันทึก"}
              </button>
            </div>
          </fieldset>
        </form>
      </Modal>
      {discarding && (
        <Modal title="ยังไม่ได้บันทึก" onClose={() => setDiscarding(false)}>
          <p>
            ข้อมูลที่กรอกไว้ยังไม่ถูกบันทึก ต้องการกลับไปกรอกต่อหรือปิดทิ้ง?
          </p>
          <div className="dialog-actions">
            <button
              className="button primary"
              onClick={() => setDiscarding(false)}
            >
              กลับไปกรอกต่อ
            </button>
            <button
              className="button secondary"
              disabled={!draftStored}
              onClick={onClose}
            >
              เก็บไว้แล้วปิด
            </button>
            <button className="button secondary" onClick={discard}>
              ปิดโดยไม่บันทึก
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
