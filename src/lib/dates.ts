export const TIMEZONE = "Asia/Bangkok";
export function dayKey(value: string | Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function localInput(value: string | Date = new Date()): string {
  const d = new Date(value);
  return `${dayKey(d)}T${new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d)}`;
}
export function fromLocal(value: string): string {
  return new Date(`${value}:00+07:00`).toISOString();
}
export function thaiDate(
  value: string | Date = new Date(),
  short = false,
): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TIMEZONE,
    day: "numeric",
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
  }).format(new Date(value));
}
export function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}
export function shiftDay(day: string, amount: number): string {
  const d = new Date(`${day}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + amount);
  return dayKey(d);
}
export function weekStart(day: string): string {
  const dow = new Date(`${day}T12:00:00+07:00`).getUTCDay();
  return shiftDay(day, -((dow + 6) % 7));
}
export function isQuiet(
  now: Date,
  start: string,
  end: string,
  timezone = TIMEZONE,
): boolean {
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const a = start.slice(0, 5),
    b = end.slice(0, 5);
  return a === b
    ? false
    : a < b
      ? local >= a && local < b
      : local >= a || local < b;
}
export function reminderState(
  p: {
    enabled: boolean;
    meal_gap_minutes: number;
    quiet_start: string;
    quiet_end: string;
    timezone: string;
    snoozed_until: string | null;
  },
  lastMeal: string | undefined,
  now = new Date(),
): "disabled" | "no-history" | "snoozed" | "quiet" | "due" | "waiting" {
  if (!p.enabled) return "disabled";
  if (!lastMeal) return "no-history";
  if (p.snoozed_until && new Date(p.snoozed_until) > now) return "snoozed";
  if (isQuiet(now, p.quiet_start, p.quiet_end, p.timezone)) return "quiet";
  return now.getTime() - new Date(lastMeal).getTime() >=
    p.meal_gap_minutes * 60000
    ? "due"
    : "waiting";
}
