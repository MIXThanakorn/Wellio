# FitLog — Product & Technical Specification

**Status:** Planning / MVP · **Audience:** Mix (มิก) and Name (เนม) only · **Platform:** Responsive web app / installable PWA · **Language:** Thai first

## 1. Product purpose
A lightweight, private wellness journal for two people to record meals, movement, weekly weight check-ins (optional), and everyday routines. Provide helpful summaries, scheduling, and gentle reminders. The product is for practical self-management, **not** rapid weight loss or medical treatment.

## 2. Scope & priorities
| Priority | Feature | Acceptance behavior |
|---|---|---|
| P0 | Two private profiles | Each person sees only their own private entries |
| P0 | Food journal | Add, edit, delete, search by day/meal type; time of last meal tracked |
| P0 | Activity journal | Log type, duration, time, notes; edit/delete |
| P0 | Weekly check-in | Optional weekly weight entry; edit/delete; trend view without pressure |
| P0 | Home dashboard | Today’s entries, quick add, weekly summary, reminder state |
| P0 | Calendar | Daily timeline and week/month view |
| P0 | Responsive UI | Mobile first; tablet/desktop usable |
| P0 | Data security | RLS + secure per-device profile authorization |
| P1 | Meal-gap reminder | User-configured interval, quiet hours, opt-in notifications |
| P1 | Plans | Editable weekly activity and meal-routine schedule |
| P1 | Hydration journal | Quick-add water, optional daily preference |
| P1 | History & trends | Activity minutes, check-ins, consistency, time filters |
| P1 | Export/delete | CSV export and per-profile data deletion |
| P2 | Favorite meals | Reuse frequently entered items |
| P2 | Photo attachments | Supabase Storage with private bucket and policies |
| P2 | PWA offline | Read recent cached data and queue safe writes if feasible |
| P2 | Optional shared plan | Explicitly shared routine items only, no automatic private-data sharing |

**Not in MVP:** social feed, public leaderboard, chat, AI photo calorie estimation, paid subscriptions, complex nutrition database, automatic medical coaching, or mandatory calorie counting.

## 3. Core user journeys
1. Open installed app → secure device session restores profile → dashboard shows today's entries.
2. Tap `+` → record meal and its time → timeline and last-meal timestamp update.
3. Tap `+` → record walk/workout duration → weekly activity summary updates.
4. Once a week, optionally record weight → see a neutral historical line chart.
5. Set a meal-gap interval → opt in to notifications → receive gentle reminder if no newer meal is logged and quiet hours allow it.
6. Open calendar → tap date → view/edit that day's entries.
7. Open plans → customize activities and rest days → mark completed when desired.

## 4. Architecture
```
React + TypeScript + Vite (mobile-first PWA)
  ├── UI / Router / TanStack Query / Zod forms
  ├── Supabase client (anon/publishable key only)
  └── Service worker (push + optional offline)
          │ HTTPS + secure session
Supabase
  ├── Auth (behind-the-scenes device enrollment/session)
  ├── Postgres + RLS
  ├── Edge Functions (enrollment, push delivery, device management)
  ├── Scheduled job / cron (reminder evaluation)
  └── Private Storage (optional photos)
```

### No-login UX without public data exposure
**Important:** Removing the login UI does not remove the need for access control. A public URL plus `profile_id = mix/name` is not secure; neither is storing a shared secret in frontend source. Proposed approach:
- Provision exactly two Supabase Auth identities (one per person), and use an initial **one-time private device enrollment** or secure invite/verification flow to establish a session without a conventional login page. The exact enrollment design should be confirmed with the agent before implementation.
- Bind database ownership to `auth.uid()` through an authenticated profile mapping. Do not permit the client to self-assign another person's ownership.
- Use short-lived enrollment codes or signed invites validated **server-side**, rate-limited, one-time, expiring, and never shipped as frontend environment variables.
- New or cleared browsers need re-enrollment; users can revoke devices. For one person using multiple devices, associate sessions with that same person securely.
- If enrollment/auth isn't implemented yet, **do not deploy production personal data**; demo mode may use local-only fictional fixtures.
- Supabase anon/publishable key is safe to expose with correct RLS; `service_role` and push secrets are server-only.

## 5. Proposed database schema
Every private row should have an `owner_user_id uuid not null` referencing the authenticated Supabase identity, with policies checking `owner_user_id = auth.uid()`.

| Table | Essential fields |
|---|---|
| `profiles` | `user_id uuid PK`, `display_name text`, `timezone text default 'Asia/Bangkok'`, `created_at` |
| `meal_entries` | `id uuid PK`, `owner_user_id`, `eaten_at timestamptz`, `meal_type`, `name`, `portion_text?`, `notes?`, `photo_path?`, `created_at`, `updated_at` |
| `activity_entries` | `id`, `owner_user_id`, `started_at timestamptz`, `activity_type`, `duration_minutes`, `effort?`, `notes?`, timestamps |
| `weight_checkins` | `id`, `owner_user_id`, `checkin_date date`, `weight_kg numeric`, `notes?`, timestamps; unique `(owner_user_id, checkin_date)` |
| `water_entries` | `id`, `owner_user_id`, `consumed_at timestamptz`, `amount_ml int`, timestamps |
| `routine_plans` | `id`, `owner_user_id`, `title`, `category`, `days_of_week int[]`, `local_time?`, `duration_minutes?`, `is_active`, timestamps |
| `plan_completions` | `id`, `owner_user_id`, `plan_id`, `completed_at`, `notes?` |
| `reminder_preferences` | `owner_user_id PK`, `enabled`, `meal_gap_minutes`, `quiet_start`, `quiet_end`, `timezone`, `snoozed_until?`, `last_notified_meal_at?`, timestamps |
| `push_subscriptions` | `id`, `owner_user_id`, `endpoint` (encrypted/protected), `p256dh`, `auth_secret`, `device_label?`, `enabled`, timestamps |
| `favorite_meals` | `id`, `owner_user_id`, `name`, `meal_type?`, `portion_text?`, timestamps |

Use appropriate CHECK constraints: positive reasonable duration and water volume, valid meal types, positive numeric check-ins, and no impossible dates. Avoid arbitrary assumptions about a person's body. Index `(owner_user_id, eaten_at desc)`, `(owner_user_id, started_at desc)`, `(owner_user_id, checkin_date desc)`, and subscription/reminder lookup fields. Cascade deletion where appropriate.

### RLS policy principle
For each private table, SELECT/INSERT/UPDATE/DELETE require `auth.uid() = owner_user_id` (INSERT uses `WITH CHECK`). `profiles` uses `auth.uid() = user_id`. Validate ownership of foreign-key references such as `plan_id`, not just the completion row. Server-only notification jobs may use elevated credentials securely, but must filter by intended recipient.

## 6. Meal-gap notification behavior
A meal reminder is a user-controlled **journal prompt**, not an instruction to restrict eating or to wait until a certain time.

1. User enables reminders, chooses gap interval, quiet hours, and opts into browser push.
2. Each new meal entry updates the effective `last_meal_at` (derived from latest `eaten_at`), including edits/deletions.
3. Scheduled backend job evaluates eligible profiles periodically (e.g., every 15 minutes).
4. If now exceeds `last_meal_at + gap`, quiet hours are inactive, no active snooze exists, and this meal interval hasn't been notified already, send a friendly prompt such as **“ไม่ได้บันทึกมื้ออาหารมาสักพักแล้ว อยากอัปเดตบันทึกไหม?”**.
5. Record idempotent notification state so retries and overlapping jobs do not spam. Provide dismiss, snooze, and pause options.
6. If there is no meal history, do not invent a last-meal time; show setup guidance instead.
7. Push delivery requires HTTPS, supported browser/device, granted permission, active subscription, and server-side Web Push credentials. On iOS, web push generally requires an installed Home Screen web app and user permission. Fall back to in-app indicators when unsupported.
8. Never promise precise delivery times: scheduled jobs, OS/browser restrictions, offline status, and battery management may delay delivery.

**Two-person routing:** Each person's device subscription belongs to their authenticated profile. Notifications must never be routed based only on a manually selected display name.

## 7. Summaries & calculations
- Today = calendar day in `Asia/Bangkok`, not UTC day.
- Meal count = number of logged meal entries for selected day; optional meal-type breakdown.
- Activity total = sum of recorded minutes for selected date/week.
- Weekly weight trend = latest valid check-in per week; do not infer missing values or prescribe weight-loss pace.
- Routine completion = completed planned activities / scheduled activities (if a plan exists); do not show punitive failure labels.
- Hydration = sum of recorded water volumes; optional user-defined reference, not universal advice.
- Charts need correct units, date labels, empty states, and accessible text summaries.

## 8. Data protection & operational needs
- Privacy policy in-app explaining what is stored and who can access it.
- Never store credentials, notification secrets, or sensitive logs in client code.
- Supabase Storage photo bucket private, owner-scoped policies, signed URLs as needed, file size/type limits.
- Consider Supabase backups, migration versioning, and retention rules.
- CSV export for individual profile; confirm before destructive deletion.
- Push subscriptions are sensitive; protect endpoints and keys; allow device revocation.
- Do not display the other person's private logs by default; shared plan requires explicit opt-in and separate access rules.
- Use environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or project-compatible anon key); keep `SUPABASE_SERVICE_ROLE_KEY`, VAPID private key, and enrollment secrets server-side only.

## 9. Suggested frontend routes
`/` dashboard · `/meals` · `/meals/new` · `/activities` · `/activities/new` · `/calendar` · `/progress` · `/plans` · `/reminders` · `/settings` · `/enroll` (only on unregistered device, not a routine login page).

## 10. Build milestones
**M1 — UI & foundation:** React shell, routing, tokens, responsive components, demo states.

**M2 — Secure backend:** Supabase setup, migrations, two profile identities, device enrollment, RLS and tests.

**M3 — Daily logging:** Meal/activity/check-in CRUD, calendar, dashboard, summary queries.

**M4 — Reminders & plans:** Routine planner, meal-gap logic, web push, quiet hours, fallback, deduplication.

**M5 — Polish:** PWA, accessibility, export/delete, performance, tests, deploy checklist.

## 11. Acceptance tests
- Mix and Name have separate authenticated sessions and cannot fetch/update one another's private entries even by manually changing API parameters.
- New device without enrollment cannot read private data.
- Food CRUD changes dashboard and reminder state correctly, including edits/deletions and backdated entries.
- Weekly check-in graph handles missing weeks and multiple edits without fabrication.
- Calendar day grouping remains correct across UTC/Bangkok date boundaries.
- Notifications respect enable/disable, quiet hours crossing midnight, snooze, permission denial, subscription expiry, retries, and no-meal-history cases.
- App works on narrow mobile, tablet, and desktop, with no hidden controls behind bottom navigation.
- User can export and delete their own records, and the UI clearly distinguishes real vs demo data.

## 12. Questions to resolve with coding agent
1. Which secure no-login enrollment approach is easiest to maintain with the chosen Supabase plan?
2. Will reminders be push-only or push + in-app? Which browsers/devices need support?
3. Should the two users have any intentionally shared weekly plans, or remain entirely separate?
4. Is optional food photography needed in the first release?
5. Where will the frontend deploy (e.g., Vercel), and what are the Supabase plan limits for scheduled jobs and Edge Functions?

**Starting instruction for the coding agent:** Read all three documents, propose a milestone-by-milestone plan and initial database migrations, then implement M1 only until the Supabase project details and secure enrollment approach are confirmed.
