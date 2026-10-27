# FitLog

แอปบันทึกสุขภาพภาษาไทยสำหรับมิกและเนม สร้างตาม `project.md`, `skill.md` และ `ui.md` ด้วย React + TypeScript + Vite และ Supabase

## เปิดใช้งาน

```sh
npm ci
npm run dev
```

เปิด http://127.0.0.1:5173 แล้วเลือก **สำรวจแอปด้วยข้อมูลตัวอย่าง** ได้ทันที ข้อมูลตัวอย่างเป็นข้อมูลสมมติ บันทึกใน localStorage แยกจากฐานข้อมูลจริง ไม่มีการสร้างบัญชีหรือใช้ข้อมูลจริงแทนผู้ใช้

ไฟล์ `.env.local` ที่มีอยู่ถูกเชื่อมกับแอปแล้ว รองรับทั้ง `SUPABASE_URL` / `SUPABASE_ANON_KEY` เดิม และตัวแปร `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` ที่แนะนำ โดยจะส่งเฉพาะ public key ให้ frontend เท่านั้น

## สิ่งที่ใช้งานได้

- บันทึก เพิ่ม แก้ไข ลบ และค้นหาอาหาร กิจกรรม น้ำดื่ม และเช็กอินน้ำหนัก
- Timeline รายวัน ปฏิทินเดือน/สัปดาห์ และกราฟ 7/30/90/365 วัน
- เช็กอินน้ำหนักใช้รายการล่าสุดในแต่ละสัปดาห์ เว้นสัปดาห์ที่ไม่มีข้อมูล และเลือกซ่อนได้
- แผนรายสัปดาห์ เลือกวัน/เวลา พักแผน และทำเครื่องหมายสำเร็จ
- อาหารโปรด เติมข้อมูลลงฟอร์มก่อนยืนยันบันทึก
- เตือนในแอปจากมื้อล่าสุด ช่วงพักข้ามเที่ยงคืน การเลื่อนเตือน และเปิด/ปิดได้
- Web Push พร้อม Service Worker, Edge Function, Vault และ Cron ทุก 15 นาที
- ส่งออก CSV ของบัญชีตัวเอง พร้อมป้องกันสูตรใน spreadsheet และลบบันทึกทั้งหมดแบบ transaction
- ยืนยันอุปกรณ์ด้วย private invitation / magic link, จำ session และออกจากอุปกรณ์อื่นได้
- PWA manifest และ app icons; Service Worker ไม่ cache API, health data หรือ auth tokens

## Supabase ที่ติดตั้งแล้ว

Project: **lessweight** (`alpbutepoqnbvbbnesit`), URL: https://alpbutepoqnbvbbnesit.supabase.co

ตาราง 11 ตารางใน `public`:

| ตาราง                | หน้าที่                                                    |
| -------------------- | ---------------------------------------------------------- |
| profiles             | mapping Auth identity กับ slot `mix` / `name` ที่ไม่ซ้ำกัน |
| meal_entries         | มื้ออาหาร                                                  |
| activity_entries     | กิจกรรม                                                    |
| weight_checkins      | เช็กอินน้ำหนัก ไม่ซ้ำคน/วัน                                |
| water_entries        | น้ำดื่ม                                                    |
| routine_plans        | แผนรายสัปดาห์                                              |
| plan_completions     | ทำแผนสำเร็จ พร้อม composite FK ตรวจเจ้าของแผน              |
| reminder_preferences | consent ช่วงเวลาพัก และ snooze                             |
| push_subscriptions   | subscription ของอุปกรณ์แต่ละคน                             |
| favorite_meals       | อาหารโปรด                                                  |
| reminder_deliveries  | ledger ฝั่ง server เพื่อกันส่งซ้ำและ retry                 |

ทุกตารางเปิด RLS และไม่มีสิทธิ์ `anon` ตารางส่วนตัวให้สิทธิ์เฉพาะ `auth.uid() = owner_user_id` (profile ใช้ `user_id`) พร้อม SELECT/INSERT/UPDATE/DELETE แยกตาม operation, UPDATE มีทั้ง USING และ WITH CHECK ตาราง ledger ปิดสิทธิ์ client ทั้งหมด

Frontend **สร้าง profile หรือเปลี่ยน slot/เจ้าของ profile ไม่ได้** จึงไม่สามารถสมัครหรือเลือกชื่อคนอื่นเพื่อข้ามสิทธิ์ แม้ Supabase Auth จะอนุญาตให้สร้าง Auth identity อื่น Identity นั้นจะไม่มี mapping และเขียน journal ไม่ได้

Migration ใน `supabase/migrations` ตรงกับ migration history บน cloud แล้ว ไม่ต้องนำไปรันซ้ำบน lessweight

### ยืนยันอุปกรณ์ / ใส่อีเมลทีหลัง

ตามที่ผู้ใช้ขอ ยังไม่สร้าง Auth identities จริงและยังไม่ส่ง invitation ใดๆ เมื่อต้องการใช้ข้อมูลจริง:

1. ที่ Supabase Dashboard → Authentication → URL Configuration ตั้ง Site URL ของเว็บจริง และเพิ่ม redirect URL สำหรับเว็บจริงและ `http://127.0.0.1:5173` ตามที่ใช้
   แนะนำให้ปิดการสมัครสมาชิกใหม่ (Allow new users to sign up) สำหรับใช้งานเฉพาะสองบัญชี การตั้งค่า local ใน `supabase/config.toml` ปิดไว้แล้ว แต่ไม่ได้ push Auth configuration ของ cloud โดยอัตโนมัติ
2. ใช้ SMTP ของคุณหากต้องการส่งอีเมลจริงเกินข้อจำกัดของระบบทดสอบ Supabase
3. เชิญสองคนโดยตั้ง environment เฉพาะ shell ฝั่งผู้ดูแล: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FITLOG_APP_URL` แล้วรัน:

```sh
npm run invite -- mix EMAIL_OF_MIX
npm run invite -- name EMAIL_OF_NAME
```

สคริปต์ส่ง invitation ผ่าน Supabase Auth และผูก Auth user ที่ได้กับ profile slot นั้น หากผูก profile ล้มเหลวจะรายงานข้อผิดพลาดและ identity ยังคงไม่มีสิทธิ์ journal ต้องแก้ mapping ผ่านผู้ดูแลก่อนเข้าใช้งาน ไม่มี profile INSERT policy สำหรับ client

หากเชิญผ่าน Dashboard แทน ให้ผู้ดูแล insert `profiles(user_id, slug, display_name)` โดยใช้ UUID ของ Auth user ที่เชิญจริง ห้ามเชื่อ UUID ที่ frontend ส่งมาสำหรับการ provision

4. เปิดลิงก์บนอุปกรณ์ที่ต้องการ หรือกรอกอีเมลที่ได้รับเชิญในหน้าเชื่อมต่ออุปกรณ์ เพื่อขอ magic link ใหม่ (ใช้ `shouldCreateUser: false`) สำหรับ magic link แบบ PKCE ให้เปิดลิงก์ในเบราว์เซอร์ที่ขอลิงก์

**อย่าใส่ service role key ใน `.env.local` ของ Vite หรือตัวแปร `VITE_*`** สคริปต์ฝั่งผู้ดูแลอ่านจาก process environment เท่านั้น ไม่เขียน credential ลงไฟล์

### Push และ Cron

- Deploy Edge Function `send-reminders` แล้ว และเปิด cron job `fitlog-meal-reminders` ทุก 15 นาที
- กุญแจ VAPID และ cron token สร้างแล้ว เก็บเข้ารหัสใน Supabase Vault ไม่มี private key ใน repository หรือ frontend
- `.env.local` มีเฉพาะ VAPID public key สำหรับ `PushManager.subscribe`
- Endpoint ของ Edge Function ใช้ custom bearer token ของ Cron จึงตั้ง `verify_jwt=false`; handler ตรวจ token ด้วยตนเองก่อนอ่าน/ส่งข้อมูลผู้ใช้
- การอ่าน Vault ใช้ helper SECURITY DEFINER ใน schema `private` ที่ไม่ expose API, search_path ว่าง, ตรวจไม่ใช่ user session และอนุญาต execute เฉพาะ service_role ส่วน wrapper ใน public เป็น SECURITY INVOKER และ service_role-only
- Retry เฉพาะสถานะ failed สูงสุด 3 ครั้ง เว้นอย่างน้อย 15 นาทีต่อครั้ง unique interval/device ป้องกัน job ซ้อนกัน ข้อความ push ไม่ใส่น้ำหนักหรือชื่ออาหาร
- หาก process ล้มหลังเริ่มส่งและก่อนบันทึกผล จะไม่ส่งซ้ำสถานะ sending โดยอัตโนมัติ เพื่อหลีกเลี่ยงข้อความซ้ำ ผู้ดูแลตรวจ ledger ได้
- อุปกรณ์เปิด push ได้เมื่อเชื่อมบัญชีจริงและผู้ใช้กดอนุญาตเท่านั้น บน iOS ต้องติดตั้งลง Home Screen และใช้ browser/OS ที่รองรับ การส่งขึ้นกับเครือข่าย/OS อาจล่าช้า
- ปุ่มทดสอบบนอุปกรณ์ทดสอบ local notification และระบุชัดว่าไม่ใช่ทดสอบการส่งจาก server
- ปิด subscription อัตโนมัติเมื่อ push service ส่ง 404/410
- ทดสอบเรียก Edge Function ผ่าน Cron authentication แล้วตอบ HTTP 200: sent=0, failed=0, skipped=0 (ยังไม่มีผู้ใช้จริง/subscriptions) ยังไม่ได้ส่ง push ไปอุปกรณ์จริง

## ทดสอบ

```sh
npm test
npm run db:test
npm run test:e2e
npm run build
```

ทดสอบแบบ fixture ต้องใช้ฐานข้อมูล development ที่ยังไม่มี profile จริง ชุด SQL ตรวจเงื่อนไขนี้ก่อนเสมอ เพื่อไม่แก้ไขข้อมูลส่วนตัวที่มีอยู่

`db:test` ใช้ Postgres ใน PGlite สำหรับ core schema/RLS ส่วน `supabase/tests/rls_isolation.sql` รันกับฐานข้อมูล Supabase จริงแล้วและ rollback fixtures ทั้งหมด ทดสอบ anonymous denial, SELECT/UPDATE/DELETE isolation ทุกตารางส่วนตัว, forged ownership, foreign-plan references, unapproved identity, slot reassignment และ transactional per-profile deletion

Playwright ทดสอบ CRUD, reload persistence, plans, quiet hours, CSV, unenrolled devices และทุกหน้าที่ 320/375/390/768/1440 px เก็บภาพตรวจหน้าแรกใน `artifacts/`

ผลตรวจล่าสุด: unit tests 11 รายการ และ Playwright 10 รายการผ่านทั้งหมด รวมถึง build และ RLS บนฐานข้อมูลจริง รัน `node scripts/verify-public-access.mjs` เพื่อตรวจ public REST API และ Cron endpoint ว่าปฏิเสธคำขอที่ไม่มีสิทธิ์ได้ (ตรวจผ่าน 5 กรณีแล้ว)

Supabase Security Advisor ไม่มี findings ส่วน Performance Advisor มี [INFO: unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) สำหรับ index ของ foreign key ที่เพิ่งสร้างและยังไม่มีข้อมูลใช้งานจริง คง index นี้ไว้เพื่อรองรับการตรวจเจ้าของ subscription ไม่ใช่ข้อผิดพลาดหรือคำเตือนด้านความปลอดภัย

## Deploy frontend

```sh
npm run build
```

อัปโหลด `dist` ไป static hosting เช่น Vercel/Netlify มี SPA rewrites สำหรับทั้งสองแบบใน `vercel.json` และ `public/_redirects` แล้ว ตั้ง public environment จาก `.env.example` และ public VAPID key ของโปรเจ็กต์ก่อน build จากนั้นเพิ่ม Auth redirect URL ของ domain จริง

ยังไม่ได้ publish frontend เพราะยังไม่มี hosting/domain ที่ระบุ เปิด local preview ได้ด้วย `npm run dev` หรือ `npm run preview`

## ขอบเขตที่ยังไม่เปิดในรุ่นนี้

- รูปอาหาร/private Storage, shared plans และ offline write queue เป็น P2 ยังไม่แสดงปุ่มเสมือนใช้งานได้
- ไม่ cache journal ลง persistent offline storage; ข้อมูลจริงที่โหลดไว้ดูต่อได้ขณะ tab ยังเปิด แต่ไม่รับรอง cold-start offline ขณะไม่มีเครือข่ายจะเก็บฟอร์มไว้และไม่แสดงว่าบันทึกสำเร็จ
- การ revoke session อื่นหยุดการ refresh; access token ที่ออกแล้วอาจใช้ได้จนหมดอายุตาม Supabase Auth
- แอปเป็น wellness journal ไม่มี calorie budget, BMI, เป้าลดน้ำหนักบังคับ หรือคำแนะนำทางการแพทย์
