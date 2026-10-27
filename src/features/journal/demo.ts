import type { Journal, Profile } from "../../lib/types";
import { dayKey, shiftDay } from "../../lib/dates";
export const demoProfile: Profile = {
  user_id: "demo-mix",
  display_name: "มิก",
  slug: "mix",
  timezone: "Asia/Bangkok",
  water_goal_ml: 2000,
  hide_weight: false,
};
export function makeDemo(): Journal {
  const today = dayKey();
  const base = { owner_user_id: demoProfile.user_id };
  const at = (day: string, h: string) =>
    new Date(`${day}T${h}:00+07:00`).toISOString();
  return {
    meals: [
      {
        ...base,
        id: "meal-1",
        name: "ข้าวต้มปลา และผลไม้",
        meal_type: "breakfast",
        eaten_at: at(today, "08:00"),
        portion_text: "1 ชาม",
        notes: "มื้อเช้าเบาๆ ก่อนเริ่มวัน",
      },
      {
        ...base,
        id: "meal-2",
        name: "ข้าวไก่ย่าง ผักลวก",
        meal_type: "lunch",
        eaten_at: at(today, "12:15"),
        portion_text: "1 จาน",
        notes: null,
      },
    ],
    activities: [
      {
        ...base,
        id: "activity-1",
        activity_type: "walking",
        duration_minutes: 25,
        started_at: at(today, "07:00"),
        effort: "light",
        notes: "เดินรับอากาศตอนเช้า",
      },
      ...Array.from({ length: 5 }, (_, i) => ({
        ...base,
        id: `activity-${i + 2}`,
        activity_type: "walking",
        duration_minutes: [20, 35, 15, 30, 25][i],
        started_at: at(shiftDay(today, -i - 1), "17:30"),
        effort: "light",
        notes: null,
      })),
    ],
    water: [
      {
        ...base,
        id: "water-1",
        amount_ml: 500,
        consumed_at: at(today, "08:30"),
      },
      {
        ...base,
        id: "water-2",
        amount_ml: 250,
        consumed_at: at(today, "10:30"),
      },
    ],
    checkins: [
      ...Array.from({ length: 5 }, (_, i) => ({
        ...base,
        id: `weight-${i}`,
        checkin_date: shiftDay(today, -28 + i * 7),
        weight_kg: [68.8, 68.5, 68.6, 68.2, 68.3][i],
        notes: "ข้อมูลสมมติสำหรับทดลอง",
      })),
    ],
    plans: [
      {
        ...base,
        id: "plan-1",
        title: "เดินเล่นรับอากาศดีๆ",
        category: "activity",
        days_of_week: [1, 2, 3, 4, 5],
        local_time: "17:30",
        duration_minutes: 20,
        is_active: true,
      },
      {
        ...base,
        id: "plan-2",
        title: "พักผ่อนและยืดเหยียด",
        category: "rest",
        days_of_week: [0, 6],
        local_time: "18:00",
        duration_minutes: 10,
        is_active: true,
      },
    ],
    completions: [],
    favorites: [
      {
        ...base,
        id: "fav-1",
        name: "ข้าวต้มปลา",
        meal_type: "breakfast",
        portion_text: "1 ชาม",
      },
    ],
    preferences: {
      owner_user_id: base.owner_user_id,
      enabled: false,
      meal_gap_minutes: 300,
      quiet_start: "22:00",
      quiet_end: "07:00",
      timezone: "Asia/Bangkok",
      snoozed_until: null,
    },
  };
}
