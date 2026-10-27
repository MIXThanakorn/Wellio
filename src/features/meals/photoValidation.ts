export const MAX_PHOTO_SOURCE_BYTES = 10 * 1024 * 1024;
const types = ["image/jpeg", "image/png", "image/webp"];
export function validatePhotoFile(file: Pick<File, "type" | "size">) {
  if (!types.includes(file.type))
    throw new Error("เลือกรูป JPG, PNG หรือ WebP เท่านั้น");
  if (file.size > MAX_PHOTO_SOURCE_BYTES)
    throw new Error("รูปใหญ่เกิน 10 MB กรุณาเลือกรูปที่เล็กลง");
  if (!file.size) throw new Error("ไฟล์รูปว่างเปล่า กรุณาเลือกรูปใหม่");
}
