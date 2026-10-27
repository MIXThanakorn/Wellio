import { supabase } from "../../lib/supabase";
import { validatePhotoFile } from "./photoValidation";
export const PHOTO_BUCKET = "meal-photos";
export async function prepareMealPhoto(file: File): Promise<Blob> {
  validatePhotoFile(file);
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > 60_000_000
    )
      throw new Error("รูปมีขนาดภาพใหญ่เกินไป กรุณาเลือกรูปที่เล็กลง");
    const ratio = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("อุปกรณ์นี้ยังเตรียมรูปไม่ได้ กรุณาลองเบราว์เซอร์อื่น");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("เตรียมรูปไม่สำเร็จ กรุณาเลือกรูปใหม่")),
        "image/webp",
        0.84,
      ),
    );
    if (blob.size > 5 * 1024 * 1024)
      throw new Error("รูปยังใหญ่เกิน 5 MB หลังย่อ กรุณาเลือกรูปอื่น");
    return blob;
  } catch (error) {
    if (error instanceof DOMException)
      throw new Error("เปิดไฟล์รูปนี้ไม่ได้ กรุณาลองรูป JPG หรือ PNG ใหม่");
    throw error;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
async function demoPhotoStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("wellio-demo-media", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("photos");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("ยังเก็บรูปในเบราว์เซอร์ไม่ได้"));
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction("photos", mode);
      const request = run(transaction.objectStore("photos"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () =>
        reject(new Error("พื้นที่เก็บรูปในเบราว์เซอร์ไม่เพียงพอ"));
      transaction.onabort = () =>
        reject(new Error("ยังเก็บรูปในเบราว์เซอร์ไม่ได้"));
    });
  } finally {
    db.close();
  }
}
export async function clearDemoPhotos() {
  await demoPhotoStore("readwrite", (store) => store.clear());
}
export async function storeMealPhoto(
  blob: Blob,
  owner: string,
  demo: boolean,
): Promise<string> {
  const extension =
    blob.type === "image/png"
      ? "png"
      : blob.type === "image/jpeg"
        ? "jpg"
        : "webp";
  const path = `${demo ? "demo" : owner}/${crypto.randomUUID()}.${extension}`;
  if (demo) {
    await demoPhotoStore("readwrite", (store) => store.put(blob, path));
    return path;
  }
  if (!supabase) throw new Error("ยังไม่เชื่อมต่อระบบ");
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, {
      contentType: blob.type,
      cacheControl: "300",
      upsert: false,
    });
  if (error)
    throw new Error("อัปโหลดรูปไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
  return path;
}
export async function removeMealPhoto(
  path: string,
  owner: string,
  demo: boolean,
): Promise<void> {
  if (demo) {
    await demoPhotoStore("readwrite", (store) => store.delete(path));
    return;
  }
  if (!supabase || !path.startsWith(`${owner}/`)) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  if (error) {
    const { error: queued } = await supabase
      .from("meal_photo_cleanup")
      .insert({ photo_path: path, owner_user_id: owner });
    if (queued)
      console.warn(
        "Photo cleanup is deferred to scheduled orphan maintenance.",
      );
  }
}
export async function mealPhotoUrl(
  path: string,
  demo: boolean,
): Promise<string> {
  if (demo) {
    const blob = await demoPhotoStore<Blob | undefined>("readonly", (store) =>
      store.get(path),
    );
    if (!blob) throw new Error("ไม่พบรูปทดลองในเบราว์เซอร์นี้");
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("เปิดรูปไม่สำเร็จ"));
      reader.readAsDataURL(blob);
    });
  }
  if (!supabase) throw new Error("ยังไม่เชื่อมต่อระบบ");
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, 300);
  if (error) throw new Error("โหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง");
  return data.signedUrl;
}
