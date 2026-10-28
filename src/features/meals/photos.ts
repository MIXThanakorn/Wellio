import { supabase, storageConnection } from "../../lib/supabase";
import { validatePhotoFile, isHeicPhoto } from "./photoValidation";
function convertHeic(blob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./heic.worker.ts", import.meta.url), {
      type: "module",
    });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error("เตรียมรูปนี้นานเกินไป กรุณาลองรูปที่เล็กลง"));
    }, 45000);
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    worker.onmessage = (e) => {
      finish();
      if (e.data.blob) resolve(e.data.blob);
      else reject(new Error(e.data.error));
    };
    worker.onerror = () => {
      finish();
      reject(new Error("เปิดรูป HEIC ไม่สำเร็จ กรุณาลองรูปอื่น"));
    };
    worker.postMessage(blob);
  });
}
export const PHOTO_BUCKET = "meal-photos";
export async function prepareMealPhoto(file: File): Promise<Blob> {
  validatePhotoFile(file);
  let objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    try {
      await image.decode();
    } catch (error) {
      if (!isHeicPhoto(file)) throw error;
      URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(await convertHeic(file));
      image.src = objectUrl;
      await image.decode();
    }
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
  onProgress: (value: number) => void = () => {},
  photoId: string = crypto.randomUUID(),
): Promise<string> {
  const extension =
    blob.type === "image/png"
      ? "png"
      : blob.type === "image/jpeg"
        ? "jpg"
        : "webp";
  const path = `${demo ? "demo" : owner}/${photoId}.${extension}`;
  if (demo) {
    await demoPhotoStore("readwrite", (store) => store.put(blob, path));
    onProgress(100);
    return path;
  }
  if (!supabase) throw new Error("ยังไม่เชื่อมต่อระบบ");
  if (!storageConnection) throw new Error("ยังไม่เชื่อมต่อระบบ");
  const connection = storageConnection;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("กรุณาเลือกชื่อก่อนบันทึก");
  const status = await new Promise<number>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${connection.url}/storage/v1/object/${PHOTO_BUCKET}/${path}`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", connection.key);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.timeout = 60000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => resolve(xhr.status);
    const failed = () =>
      reject(
        new Error(
          "ส่งรูปยังไม่สำเร็จ ข้อมูลยังอยู่ กรุณาตรวจอินเทอร์เน็ตแล้วกดบันทึกอีกครั้ง",
        ),
      );
    xhr.onerror = failed;
    xhr.ontimeout = failed;
    xhr.onabort = failed;
    const body = new FormData();
    body.append("cacheControl", "300");
    body.append("", blob, `${photoId}.${extension}`);
    xhr.send(body);
  });
  if (status < 200 || status >= 300) {
    // Reusing the same photo ID makes a retry safe even if the first response was lost.
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 60);
    if (error)
      throw new Error(
        "อัปโหลดรูปยังไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง",
      );
  }
  onProgress(100);
  return path;
}
export async function transformMealPhoto(
  blob: Blob,
  rotation: number,
  square = false,
): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const turn = ((rotation % 360) + 360) % 360;
    const w = turn % 180 ? img.naturalHeight : img.naturalWidth,
      h = turn % 180 ? img.naturalWidth : img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = square ? Math.min(w, h) : w;
    canvas.height = square ? Math.min(w, h) : h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("อุปกรณ์นี้ปรับรูปไม่ได้");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((turn * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error("ปรับรูปไม่สำเร็จ")),
        "image/webp",
        0.86,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
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
