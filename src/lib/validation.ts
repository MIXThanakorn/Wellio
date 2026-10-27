import { z } from "zod";
const note = z
  .string()
  .trim()
  .max(2000, "บันทึกได้ไม่เกิน 2,000 ตัวอักษร")
  .nullable();
const instant = z
  .string()
  .datetime()
  .refine(
    (v) => new Date(v).getTime() <= Date.now() + 60000,
    "เลือกเวลาไม่เกินเวลาปัจจุบัน",
  );
export const mealSchema = z.object({
  name: z.string().trim().min(1, "ระบุชื่ออาหาร").max(200),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack", "other"]),
  eaten_at: instant,
  portion_text: z.string().trim().max(200).nullable(),
  notes: note,
});
export const activitySchema = z.object({
  activity_type: z.enum([
    "walking",
    "cycling",
    "stretching",
    "strength",
    "other",
  ]),
  duration_minutes: z.coerce.number().int().min(1).max(1440),
  started_at: instant,
  effort: z.enum(["light", "moderate", "vigorous"]).nullable(),
  notes: note,
});
export const checkinSchema = z.object({
  checkin_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (v) =>
        v <=
        new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(
          new Date(),
        ),
      "เลือกวันที่ไม่เกินวันนี้",
    ),
  weight_kg: z.coerce.number().positive().max(1000),
  notes: note,
});
export const waterSchema = z.object({
  amount_ml: z.coerce.number().int().min(1).max(5000),
  consumed_at: instant,
});
export const planSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(["activity", "meal", "rest", "sleep"]),
  days_of_week: z
    .array(z.number().int().min(0).max(6))
    .min(1, "เลือกอย่างน้อยหนึ่งวัน"),
  local_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable(),
  duration_minutes: z.coerce.number().int().min(1).max(1440).nullable(),
  is_active: z.boolean(),
});
export const preferenceSchema = z.object({
  enabled: z.boolean(),
  meal_gap_minutes: z.coerce.number().int().min(60).max(1440),
  quiet_start: z.string().regex(/^\d{2}:\d{2}$/),
  quiet_end: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.literal("Asia/Bangkok"),
  snoozed_until: z.string().datetime().nullable(),
});
