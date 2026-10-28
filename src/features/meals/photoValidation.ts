export const MAX_PHOTO_SOURCE_BYTES = 10 * 1024 * 1024;
const types = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
];
export function isHeicPhoto(file: { type: string; name?: string }) {
  return (
    file.type.includes("heic") ||
    file.type.includes("heif") ||
    /\.(heic|heif)$/i.test(file.name || "")
  );
}
export function validatePhotoFile(
  file: Pick<File, "type" | "size"> & { name?: string },
) {
  if (!types.includes(file.type) && !isHeicPhoto(file))
    throw new Error("เลือกรูป JPG, PNG, WebP หรือ HEIC เท่านั้น");
  if (file.size > MAX_PHOTO_SOURCE_BYTES)
    throw new Error("รูปใหญ่เกิน 10 MB กรุณาเลือกรูปที่เล็กลง");
  if (!file.size) throw new Error("ไฟล์รูปว่างเปล่า กรุณาเลือกรูปใหม่");
}
