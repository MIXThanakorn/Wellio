export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";
export type EntryKind = "meal" | "activity" | "weight" | "water";
export interface Profile {
  user_id: string;
  display_name: string;
  slug: "mix" | "name";
  timezone: string;
  water_goal_ml: number | null;
  hide_weight: boolean;
}
export interface BaseRow {
  deleted_at?: string | null;
  id: string;
  owner_user_id: string;
  created_at?: string;
  updated_at?: string;
}
export interface Meal extends BaseRow {
  photo_path?: string | null;
  name: string;
  meal_type: MealType;
  eaten_at: string;
  portion_text: string | null;
  notes: string | null;
}
export interface Activity extends BaseRow {
  activity_type: string;
  duration_minutes: number;
  started_at: string;
  effort: string | null;
  notes: string | null;
}
export interface Checkin extends BaseRow {
  checkin_date: string;
  weight_kg: number;
  notes: string | null;
}
export interface Water extends BaseRow {
  consumed_at: string;
  amount_ml: number;
}
export interface Plan extends BaseRow {
  title: string;
  category: string;
  days_of_week: number[];
  local_time: string | null;
  duration_minutes: number | null;
  is_active: boolean;
}
export interface Completion extends BaseRow {
  plan_id: string;
  completed_date: string;
  completed_at: string;
  notes: string | null;
}
export interface Favorite extends BaseRow {
  name: string;
  meal_type: MealType;
  portion_text: string | null;
}
export interface Preferences {
  owner_user_id: string;
  enabled: boolean;
  meal_gap_minutes: number;
  quiet_start: string;
  quiet_end: string;
  timezone: string;
  snoozed_until: string | null;
}
export interface Journal {
  meals: Meal[];
  activities: Activity[];
  checkins: Checkin[];
  water: Water[];
  plans: Plan[];
  completions: Completion[];
  favorites: Favorite[];
  preferences: Preferences;
}
export const mealLabels: Record<MealType, string> = {
  breakfast: "มื้อเช้า",
  lunch: "มื้อกลางวัน",
  dinner: "มื้อเย็น",
  snack: "ของว่าง",
  other: "อื่นๆ",
};
export const activityLabels: Record<string, string> = {
  walking: "เดินเล่น",
  cycling: "ปั่นจักรยาน",
  stretching: "ยืดเหยียด",
  strength: "ฝึกกล้ามเนื้อ",
  other: "กิจกรรมอื่นๆ",
};
export const kindLabels: Record<EntryKind, string> = {
  meal: "มื้ออาหาร",
  activity: "กิจกรรม",
  weight: "น้ำหนัก",
  water: "น้ำดื่ม",
};
export const tables = {
  meals: "meal_entries",
  activities: "activity_entries",
  checkins: "weight_checkins",
  water: "water_entries",
  plans: "routine_plans",
  completions: "plan_completions",
  favorites: "favorite_meals",
  preferences: "reminder_preferences",
} as const;
