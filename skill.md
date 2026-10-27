# FitLog — Agent Skill / Working Rules

> Version 1.0 · Read this file first, then `project.md` and `ui.md` before implementation.

## Mission
Build a private, mobile-first, Thai-language wellness companion for exactly two initial users: **Mix (มิก)** and **Name (เนม)**. Use **React + TypeScript** for the frontend and **Supabase** for backend services. Prioritize practical daily use, accessible UX, reliable data ownership, and sustainable health habits rather than aggressive weight-loss mechanics.

## Source-of-truth hierarchy
1. `project.md`: product behavior, data model, architecture, security, acceptance criteria.
2. `ui.md`: design system, screen layouts, responsive behavior, components.
3. This file: development workflow, coding standards, agent guardrails.
4. Existing repository conventions where they do not contradict the above.

## Non-negotiable rules
- **No conventional login screen** in the initial UX. However, **never** implement unrestricted public writes or trust a client-selected `user_id` for authorization. Before enabling production data, implement a lightweight secure device enrollment / access mechanism as detailed in `project.md`. A visible Mix/Name profile switch alone is **not** authentication.
- Keep each person's private records isolated; only explicitly shared items are shared.
- Use Supabase Row Level Security (RLS) for all client-accessible tables. Never put `service_role` credentials in the browser or expose secrets in git.
- Do not invent medical advice, prescribe caloric deficits, shame missed meals, or use punitive streaks. Food and activity tracking must remain optional, editable, and nonjudgmental.
- Notifications are **opt-in**, per profile and device, and respect quiet hours. No alert is proof that a person must eat immediately.
- Support Thai-first copy, `Asia/Bangkok` presentation, correct date/time boundaries, and readable numbers/units.
- Mobile-first responsive UI: 320–430px primary, tablet and desktop enhanced layouts.
- Deliver real CRUD, loading/empty/error states, accessible forms, and tests; avoid decorative controls that do nothing.

## Suggested stack
- Vite + React + TypeScript (unless existing project already uses a compatible React framework)
- React Router, TanStack Query, React Hook Form + Zod
- Tailwind CSS with design tokens/CSS variables; Lucide icons
- Recharts for trends; date-fns for dates; optional `date-fns-tz` or `Intl` for timezone handling
- Supabase JS client: Postgres, RLS, Edge Functions, scheduled jobs, Storage only when needed
- PWA manifest + service worker; web push only after secure enrollment and permission flow
- Vitest + React Testing Library; Playwright for key flows

## Implementation sequence
1. Inspect repository; propose file tree, dependencies, environment variables, and migrations.
2. Build static responsive UI shell matching `ui.md` with representative placeholder data clearly marked as demo.
3. Create Supabase schema, indexes, constraints, RLS policies, secure enrollment flow, and seed profiles.
4. Implement food logs, activity logs, weekly weight check-ins, daily timeline/calendar, dashboard summaries.
5. Implement user preferences, meal reminders, device subscriptions, notification scheduling, and quiet hours.
6. Implement trends, plans, export/delete, offline-friendly UX, and PWA enhancements.
7. Test mobile/tablet/desktop, privacy isolation, date boundaries, and notification edge cases.

## Coding conventions
- Organize by feature: `features/meals`, `features/activities`, `features/checkins`, `features/reminders`, `features/plans`, `features/insights`, `features/settings`.
- Separate domain types, validation schemas, data-access functions, hooks, and presentation components.
- Use strict TypeScript; avoid `any`, silent catch blocks, and hard-coded profile IDs scattered through components.
- Use parameterized Supabase queries, input validation, database constraints, and server-side authorization.
- Optimistic updates only when safe; show recoverable errors and rollback on failure.
- For dates: store instants as `timestamptz` UTC; store user-selected calendar dates as `date`; render in Thailand time.
- Keep test fixtures and placeholder health metrics fictional; do not present sample numbers as personal measurements.

## Agent communication protocol
Before large changes: briefly state the planned files, migrations, and security implications. After changes: list what works, what remains mocked, required Supabase configuration, tests run, and any blockers. Ask for credentials or project URL only when needed; never ask users to paste `service_role` keys into frontend code.

## Definition of done
- Both profiles can independently add/edit/delete entries and view correct summaries.
- No user can read/write another's private records by changing request parameters.
- Reminders behave according to last logged meal, configurable threshold, quiet hours, and notification permission.
- Responsive, keyboard-accessible, touch-friendly, tested, with meaningful empty/error/loading states.
- No hidden paid service dependency, fake notifications, or unimplemented UI controls presented as complete.
