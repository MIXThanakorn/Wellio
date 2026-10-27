# Wellio — UI / UX Specification

> Mobile-first design based on the approved **simple, everyday-use** mockup. No anime illustrations, mascots, gamified characters, or visual clutter.

## Design direction
**Calm • Clean • Friendly • Trustworthy.** A modern Thai wellness app with a cool pastel palette: sky blue, deep blue, mint green, and soft pink. White/near-white surfaces, generous breathing room, restrained shadows, rounded cards, and clear data hierarchy. Avoid generic flashy gradients and unnecessary glassmorphism.

## Tokens
| Token | Value | Usage |
|---|---|---|
| Primary | `#278CF5` | Main CTA, active navigation, charts |
| Primary dark | `#1769BD` | Hover/strong emphasis |
| Sky tint | `#EAF5FF` | Info cards/background |
| Mint | `#35B99A` | Completed actions, hydration |
| Mint tint | `#E8F8F2` | Positive backgrounds |
| Pink | `#F58DAD` | Food/wellness accent |
| Pink tint | `#FFF0F5` | Secondary cards |
| Navy text | `#1D3554` | Main text |
| Muted text | `#64748B` | Secondary text |
| Canvas | `#F6F9FD` | Page background |
| Surface | `#FFFFFF` | Cards and sheets |
| Border | `#E4EBF3` | Dividers/inputs |
| Warning | `#C87924` | Gentle reminders |
| Error | `#C84D61` | Destructive feedback |

Typography: `Noto Sans Thai` + `Inter` (fallback system sans). Body 14–16px; headings 20–26px; avoid body text below 13px. Radius: card 18px, input 12px, pill 999px. Spacing based on 4/8px rhythm. Minimum touch targets **44×44px**. WCAG AA contrast for text and controls; do not rely on color alone.

## Responsive layout
| Width | Behavior |
|---|---|
| 320–599px | Single-column content; fixed bottom navigation; safe-area padding; full-width sheets/forms; compact charts |
| 600–1023px | 2-column card grid where appropriate; bottom nav or compact rail; centered max-width content |
| ≥1024px | Left sidebar navigation + main content up to ~1280px; dashboard 2–3 columns; charts expanded |

Avoid horizontal page scrolling. Keep action buttons reachable by thumb. Respect reduced-motion preferences, safe areas, and on-screen keyboard. For dense tables on mobile, use cards instead.

## Navigation
Primary mobile bottom nav (5 slots): **หน้าแรก**, **บันทึก**, central **+ เพิ่ม**, **แผน**, **ฉัน**. The central add action opens a bottom sheet with: เพิ่มมื้ออาหาร, เพิ่มกิจกรรม, บันทึกน้ำหนัก, เพิ่มน้ำดื่ม (optional). Secondary screens via cards and profile/settings: ปฏิทิน, ความคืบหน้า, แจ้งเตือน, ประวัติ.

## Screens

### 1. Home / Dashboard
- Greeting + active profile avatar/name; notification status indicator.
- Four concise summary cards: latest weekly check-in, today's meals, activity minutes, hydration (optional).
- Today's timeline: meals, movement, reminders, editable entries.
- A small weekly consistency/health habits trend (avoid pressure-focused scoring).
- Quick actions and upcoming plan; actionable empty state for first use.
- Reminder status: last meal time, next reminder window, pause/snooze control.

### 2. Food log
- Date selector; meal categories: เช้า / กลางวัน / เย็น / ของว่าง / อื่นๆ.
- Fast manual entry: meal name, time, optional note, optional photo, optional portion.
- Recent/favorite meals for one-tap reuse; edit/delete and search/filter.
- Nutrient information is optional and only shown if the user supplies reliable data; no compulsory calorie budget.
- Meal history in clean rows/cards with timestamp and category.

### 3. Activity log
- Activity type, duration, date/time, optional perceived effort/note.
- Presets: walking, cycling, stretching, strength training, other.
- Weekly schedule and completed sessions; edit/delete.
- Activity suggestions with rest days and beginner-friendly modifications; no automatic punishment for missed sessions.

### 4. Calendar / Schedule
- Month/week toggle; day dots for meals, activity, weekly check-ins.
- Tap date to open a chronological daily summary.
- Optional planned meal/activity reminders and recurring routine entries.

### 5. Progress
- 7-day / 30-day / 3-month / 1-year filters.
- Separate charts: weekly weight check-ins (optional), activity time, meal logging consistency, hydration (if enabled).
- Show trends without red/green judgment or appearance comparisons; allow users to hide weight chart.
- Export entries as CSV.

### 6. Plans
- Simple routine templates: regular meals, light movement, stretching, sleep routine.
- Custom weekly plan editor: days, activity, time, duration, rest days.
- Recommendations are general wellness suggestions, not medical prescriptions.
- Each item has a clear Start / Edit / Complete action.

### 7. Reminders
- Enable/disable meal-gap reminders; select interval (e.g. 4–6 hours as a user preference, **not** a medical rule).
- Quiet hours, per-device push permission, notification test, snooze, pause for the day.
- Explain that reminders use the **last recorded meal** and may be inaccurate if a meal wasn't logged.
- Show fallback in-app reminders if push unavailable; explain browser limitations.

### 8. Profile / Settings
- Active profile name, personal preferences, units, optional wellness goals.
- Device connection status; notification settings; privacy/export/delete.
- Profile switching must use secure device enrollment/authorization rather than a cosmetic dropdown.

## Reusable components
`AppShell`, `BottomNav`, `DesktopSidebar`, `PageHeader`, `SummaryCard`, `ProgressChart`, `Timeline`, `EntryCard`, `DateSwitcher`, `Calendar`, `QuickAddSheet`, `MealForm`, `ActivityForm`, `CheckInForm`, `ReminderSettings`, `EmptyState`, `Skeleton`, `ConfirmDialog`, `Toast`.

## Interaction standards
- Use bottom sheets for short mobile actions; full-screen forms for long workflows.
- Autosave only where appropriate; otherwise explicit Save + success feedback.
- Destructive actions require confirmation or undo.
- Skeletons for fetching; meaningful offline and error states; no fake success.
- Thai date labels, readable units, localized form validation, persistent user preferences.
- No mandatory food photography, calorie counting, weight target, BMI display, or body-image comparison.

## UI acceptance checklist
- Looks natural at 375×812 and 390×844; works at 320px.
- Forms remain usable with keyboard open; fixed bottom nav does not cover buttons.
- All text readable, focus states visible, touch targets large enough.
- Tablet and desktop feel intentionally laid out, not stretched mobile screens.
- Every displayed control maps to a real action or is visibly marked coming soon.
