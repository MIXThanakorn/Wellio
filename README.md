# Wellio

แอปบันทึกสุขภาพภาษาไทยของมิกและเนม ใช้ React + TypeScript + Vite และ Supabase โปรเจ็กต์ **Wellio** (`alpbutepoqnbvbbnesit`)

## เปิดแอป

```sh
npm ci
npm run dev
```

ใช้ลิงก์เดียว: http://127.0.0.1:5173/

- ไม่มี session → แสดงปุ่ม **มิก** และ **เนม** กดชื่อเพื่อเข้าบัญชีนั้นทันที
- มี session → เปิดบัญชีเดิมให้เอง รวมถึงหลังปิดแล้วเปิดเบราว์เซอร์ใหม่
- ปุ่ม **เปลี่ยนคน / ออก** บนแถบด้านบน หรือออกจากบัญชีในหน้าตั้งค่า → ล้าง session และกลับหน้าเลือกชื่อ
- หลังออกแล้วเลือกอีกคนได้จาก URL เดิม ไม่ต้องใช้อีเมล รหัสผ่าน PIN หรือลิงก์เฉพาะคน
- มีโหมดทดลองที่เก็บข้อมูลสมมติแยกในเบราว์เซอร์

## รูปแบบสิทธิ์ที่ผู้ใช้ยืนยัน

ผู้ใช้ยืนยันให้ **เลือกชื่อแล้วเข้าได้ทันที** และยอมรับว่า **ทุกคนที่มีลิงก์เว็บสามารถเลือกเข้าได้ทั้งสองบัญชี** จึงไม่มีการตรวจว่าคนที่กดชื่อเป็นมิกหรือเนมจริง

RLS ยังบังคับให้แต่ละ session อ่าน/เขียนเฉพาะเจ้าของบัญชีที่เลือก การแก้ `owner_user_id` ในคำขอไม่ทำให้ข้าม RLS ได้ แต่ผู้ถือ URL สามารถออกแล้วเลือกอีกบัญชี หรือเรียก endpoint เลือกบัญชีเพื่อสร้าง session ของอีกคนได้ตามนโยบายที่อนุมัติ อย่าอธิบายระบบนี้ว่าแยกความลับระหว่างคนสองคน หากต้องการจำกัดบุคคลในอนาคตต้องเพิ่มการยืนยันตัวตนที่ endpoint ออก session

## บัญชีและ session

- มี Auth identities ถาวรสองบัญชี: slot `mix` และ `name` ผูกกับ `profiles.user_id` เดิม ไม่สร้าง anonymous user ใหม่ทุกครั้ง
- ปิด public signup บน Supabase Auth แล้ว หน้าเลือกชื่อออก session ให้ได้เฉพาะสอง slot ที่ whitelist ไว้ ไม่รับ UUID เจ้าของบัญชีจาก client
- Frontend เรียก Edge Function `device-access` action `select-profile` พร้อม slug จากนั้นเก็บ Supabase Auth session ด้วย `persistSession` และ `autoRefreshToken`
- การสร้าง/ตรวจ Auth token ทำบน server ไม่มี service role key หรือรหัสบัญชีใน frontend
- มี rate limit การเลือกบัญชี 30 ครั้งต่อ 15 นาทีต่อ fingerprint ฝั่ง server เก็บ fingerprint แบบ HMAC โดยไม่เก็บ IP ดิบ
- ออกจากอุปกรณ์นี้ใช้ `signOut({scope:'local'})` และตัด push ของอุปกรณ์นี้ อุปกรณ์อื่นยังใช้ session ของตัวเองต่อได้
- หน้าตั้งค่ายังมี revoke session อุปกรณ์อื่นและปิด push ของอุปกรณ์อื่น Access token ที่ออกไปแล้วอาจใช้ได้จนหมดอายุตาม Supabase Auth
- เมื่อ server/network error ระหว่าง logout ตัว SDK ล้าง session ในเครื่องตามกลไกของ SDK แอปตรวจสถานะที่เหลือและไม่เก็บบัญชีเก่าค้างบนหน้าจอ

ยังไม่ผูกอีเมลส่วนตัวตามที่ขอ Auth ใช้ alias ภายในโดเมนสงวน `.invalid` และรหัสสุ่มที่ไม่เปิดเผยเพื่อรองรับการออก session ฝั่ง server ไม่มีการส่งอีเมล อีเมลส่วนตัวสามารถเชื่อมภายหลังผ่านผู้ดูแลหลังยืนยันความเป็นเจ้าของ โดยคง UUID และข้อมูลเดิมไว้ รุ่นนี้ไม่มีฟอร์มผูกอีเมล

ระบบลิงก์เชื่อมอุปกรณ์เดิมไม่อยู่ใน UI แล้ว ไฟล์ลิงก์ส่วนตัวถูกนำออก bookmark แบบเก่าจะถูกปรับกลับเป็น URL ปกติ ส่วน RPC/migration เดิมคงไว้เพื่อ compatibility

## ฟีเจอร์

- เพิ่ม แก้ไข ลบ ค้นหาอาหาร กิจกรรม น้ำดื่ม และเช็กอินน้ำหนัก
- แนบรูปอาหาร 1 รูปต่อมื้อ พร้อมตัวอย่าง ดูภาพใหญ่ เปลี่ยนและนำรูปออก รองรับ JPG/PNG/WebP ไม่เกิน 10 MB ก่อนย่ออัตโนมัติเป็นด้านยาวสูงสุด 1600 px
- หน้าวิธีใช้ภาษาไทย `/guide` มีขั้นตอนเริ่มต้น หัวข้อค้นหาได้ และคำถามที่พบบ่อย เปิดได้ก่อนเลือกบัญชี จากเมนูด้านข้าง หรือหน้าตั้งค่า
- หน้าแรกมีปุ่มบันทึกอาหาร น้ำดื่ม กิจกรรม และน้ำหนักให้กดได้ทันที พร้อมชื่อคนที่กำลังใช้งานและวิธีใช้บนแถบด้านบนของมือถือ
- ฟอร์มแสดงข้อมูลจำเป็นก่อน มีปุ่มถ่ายรูปแยกจากคลังรูป ปริมาณน้ำ/ระยะเวลากดเลือกได้ วันที่/เวลาใส่ให้แล้ว และเปิดรายละเอียดเพิ่มได้ หากกรอกค้างแล้วกดปิดจะถามก่อนทิ้งข้อมูล
- Timeline รายวัน ปฏิทินเดือน/สัปดาห์ และกราฟ 7/30/90/365 วัน
- น้ำหนักรายสัปดาห์ใช้รายการล่าสุด ไม่เติมข้อมูลในสัปดาห์ที่ขาด และซ่อนได้
- แผนรายสัปดาห์ เลือกวัน/เวลา พักแผน และทำเครื่องหมายสำเร็จ
- อาหารโปรด ส่งออก CSV ป้องกันสูตรใน spreadsheet และลบบันทึกของบัญชีที่เลือกแบบ transaction
- เตือนในแอปจากมื้อล่าสุด ตั้งช่วงพักข้ามเที่ยงคืนและเลื่อนเตือนได้
- Web Push, Service Worker, VAPID ใน Vault และ Cron ทุก 15 นาที ติดตั้งฝั่ง Supabase แล้ว ผู้ใช้ต้องกดอนุญาต push เอง
- PWA manifest และ PNG app icons; ไม่ cache Auth tokens หรือ health API responses ใน service worker

ตาราง public 12 ตารางเปิด RLS ครบ: `profiles`, `meal_entries`, `activity_entries`, `weight_checkins`, `water_entries`, `routine_plans`, `plan_completions`, `reminder_preferences`, `push_subscriptions`, `favorite_meals`, `reminder_deliveries`, `meal_photo_cleanup` ตาราง ledger ปิดสิทธิ์ client ส่วน completion และ push delivery มี foreign keys ตรวจเจ้าของความสัมพันธ์ด้วย

Schema `private` เก็บ rate limits และ enrollment รุ่นก่อน ไม่ expose Data API; RPC privileged อนุญาต service_role เท่านั้น ทุก function ตั้ง search_path ไว้ ส่วน helper อ่าน Vault เป็น SECURITY DEFINER ใน schema private และจำกัดสิทธิ์อย่างชัดเจน

Migration ตรงกับ cloud history แล้ว ไม่ต้องนำไปรันซ้ำ ชื่อ internal RPC/Vault บางรายการที่ขึ้นต้น `fitlog_` คงไว้เพื่อ compatibility ชื่อแอปและชื่อโปรเจ็กต์ Supabase เป็น Wellio แล้ว

## Environment และ deploy

`.env.local` ใช้งานได้แล้ว รองรับ `SUPABASE_URL` / `SUPABASE_ANON_KEY` เดิม หรือ `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` ที่แนะนำ และ `VITE_VAPID_PUBLIC_KEY` ห้ามใส่ service role key ในตัวแปร `VITE_*`

```sh
npm run build
```

Deploy `dist` ไป static hosting มี SPA rewrites สำหรับ Vercel/Netlify ใน `vercel.json` และ `public/_redirects` แล้ว ตั้ง public environment ก่อน build ใช้ HTTPS สำหรับ push เว็บยังไม่ได้ publish เพราะยังไม่มี hosting/domain ที่ระบุ

## ทดสอบ

```sh
npm test
npm run db:test
npm run test:e2e
npm run test:sessions
npm run test:photos
npm run build
```

- Unit tests 17 รายการ: เวลาไทย ช่วงพัก snooze ข้อมูลว่าง validation รูปอาหาร และ CSV
- Playwright 22 รายการ: CRUD, plans, favorites, keyboard focus, หน้าเลือกชื่อ รูปอาหารแบบทดลอง หน้าวิธีใช้และค้นหา/FAQ ทางลัดบันทึกและกล้องมือถือ ปริมาณสำเร็จรูป การยืนยันก่อนทิ้งฟอร์ม การล้างรูปทดลอง และหน้าต่างๆ ที่ 320/375/390/768/1440 px
- `test:photos` ใช้บัญชีจริงทดสอบแนบรูปผ่าน UI ย่อรูป รีโหลด เปลี่ยน ลบ และ Storage RLS รวมการปฏิเสธ URL สาธารณะ ผลอยู่ใน `artifacts/photo-verification.json` ลบเฉพาะมื้อทดสอบ และส่งรูปที่เลิกใช้เข้าคิวล้างตาม Cron
- SQL `supabase/tests/meal_photos.sql` ทดสอบ path ของเจ้าของ คิวเปลี่ยน/ลบรูป และ RLS บน cloud ใน transaction ที่ rollback
- `test:sessions` ใช้สองบัญชีจริงจาก URL เดียว ทดสอบ 14 กรณี รวม session หลัง browser restart, logout, reload หลัง logout, เลือกอีกคนโดยไม่ใช้ cache เก่า, RLS ของ session ที่เลือก, invalid slug และป้องกัน admin endpoint ผลอยู่ใน `artifacts/session-verification.json` ลบเฉพาะ journal fixtures ที่สร้างโดยชุดทดสอบเมื่อเสร็จ ไม่ต้องมี private link fixture
- `db:test` ใช้ PGlite ตรวจ schema/RLS, enrollment รุ่นก่อน และ rate limit ของ profile selection
- SQL `supabase/tests/profile_selection.sql` รันบน cloud และ rollback เพื่อทดสอบ rate limit/window reset/service-role-only โดยไม่แตะ journal จริง
- SQL isolation แบบ seed profile ต้องใช้ development project ที่ว่างเท่านั้น มี guard ป้องกันแก้ข้อมูลในโปรเจ็กต์ที่มี profile จริงแล้ว
- `node scripts/verify-public-access.mjs` ตรวจ anonymous REST denial และการป้องกัน cron endpoint ส่วน `select-profile` เป็น endpoint สาธารณะโดยตั้งใจตามคำยืนยันของผู้ใช้

## ขอบเขตและผลตรวจ

รูปอาหารใช้ private Storage bucket `meal-photos` จำกัดไฟล์หลังย่อ 5 MB เปิด RLS ตามบัญชีที่เลือก มี signed URL อายุ 5 นาที ไม่ใช้ public URL และไฟล์ใหม่ใช้ชื่อ UUID เสมอ รูปทดลองเก็บ Blob ใน IndexedDB แยกจากบัญชีจริง CSV ไม่รวมไฟล์รูป

เมื่อเปลี่ยนหรือนำรูปออก ระบบลบไฟล์เก่าผ่าน Storage API และ trigger ส่ง path ที่เลิกใช้เข้าตารางคิว `meal_photo_cleanup` ครอบคลุมการลบมื้อและล้างบันทึกทั้งหมด Cron `send-reminders` ทุก 15 นาทีจะล้างคิวและเก็บไฟล์กำพร้าที่เก่ากว่า 24 ชั่วโมง มี RPC เฉพาะ service role และไม่ลบ metadata ของ Storage ผ่าน SQL ลิงก์รูปที่ออกไปแล้วอาจยังแสดงจาก cache ชั่วคราวหลังลบ

shared plans และ offline write queue ยังไม่รวมในรุ่นนี้ ข้อมูลจริงที่โหลดไว้ดูได้ขณะ tab ยังเปิด แต่ไม่รับรอง cold-start offline และไม่แสดงว่าบันทึกสำเร็จเมื่อเครือข่ายล้มเหลว

Push ฝั่ง server ทดสอบเรียก authenticated cron สำเร็จแล้ว แต่ยังไม่มี subscription/การส่งถึงอุปกรณ์จริง การส่งอาจล่าช้าตาม OS/เครือข่าย ledger กัน job ซ้ำและ retry failed ได้สูงสุด 3 ครั้งโดยเว้นอย่างน้อย 15 นาที

Supabase Auth มีคำเตือน [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) จากค่าการป้องกันรหัสผ่านรั่วที่ยังปิดอยู่ แอปนี้ไม่รับรหัสผ่านผู้ใช้ ใช้รหัสสุ่มภายในที่ไม่เปิดเผย ส่วน [INFO: unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) คงไว้เพื่อรองรับ foreign keys และ workload เมื่อมีข้อมูลจริง

Wellio เป็น wellness journal ไม่มี calorie budget, BMI, เป้าลดน้ำหนักบังคับ หรือคำแนะนำการแพทย์
