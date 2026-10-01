# KidCare

แอปเว็บ (PWA) สำหรับครอบครัวใช้ติดตามสุขภาพลูก: ตารางวัคซีนพื้นฐาน (EPI) และวัคซีนอื่น ๆ บันทึกวันที่ฉีด/วันนัด
นัดหมายหมอ ประวัติแพ้ยา/แพ้อาหาร และข้อมูลโรงพยาบาล (HN) ใช้ได้ทั้งบนมือถือและคอมพิวเตอร์ ข้อมูลเก็บใน Firebase
(Authentication + Firestore) แชร์กันได้ในครอบครัวเดียวกัน หน้าจอเป็นภาษาไทย

เทคโนโลยี: React + Vite + TypeScript, Tailwind, Firebase, vite-plugin-pwa

## พัฒนาในเครื่อง

```bash
npm install
```

สร้างไฟล์ `.env.local` (ห้าม commit) โดยคัดลอก key จาก `.env.example` แล้วใส่ค่าจาก Firebase Console
(Project settings → Your apps → Web app):

```
VITE_FB_API_KEY=
VITE_FB_AUTH_DOMAIN=
VITE_FB_PROJECT_ID=
VITE_FB_APP_ID=
```

จากนั้นรัน dev server:

```bash
npm run dev
```

## ทดสอบ

```bash
npm test           # unit test ทั้งหมด (vitest)
npm run test:rules # ทดสอบ Firestore security rules ด้วย emulator — ต้องมี Java 11 ขึ้นไป
```

ตรวจชนิดข้อมูลและ build: `npm run build` (รัน `tsc -b` ก่อน `vite build`)

## Deploy

```bash
npm run deploy
```

คำสั่งนี้ build แล้ว deploy Firebase Hosting, Firestore rules และ indexes (ต้องล็อกอิน `firebase login` และตั้ง project ไว้ก่อน)

## เพิ่มแฟน/สมาชิกเข้าครอบครัว

เชิญได้จากในแอป (ไม่ต้องแก้ใน Firebase Console อีกต่อไป):

1. เจ้าของเปิด ตั้งค่า → เชิญด้วยอีเมล แล้วกรอกอีเมล Google ของแฟน กด "เชิญ"
2. ให้แฟนเปิดแอปและเข้าสู่ระบบด้วย Google อีเมลนั้น จะเห็นหน้าคำเชิญ ตรวจชื่อครอบครัว/อีเมลผู้เชิญ แล้วกดยืนยันเข้าร่วม
3. ถ้าแฟนเคยใช้แอปและมีครอบครัวของตัวเองอยู่แล้ว จะเห็นการ์ดคำเชิญด้านบน ให้กด "เข้าร่วม" (ข้อมูลในครอบครัวเดิมจะไม่ถูกย้ายไปด้วย) หรือ "ไม่สนใจ"
4. คำเชิญหมดอายุใน 14 วัน เจ้าของยกเลิกคำเชิญที่รออยู่ได้ และนำสมาชิกออกจากครอบครัวได้ในหน้าตั้งค่า
