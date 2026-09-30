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

## เพิ่มแฟน/สมาชิกเข้าครอบครัว (ชั่วคราว จนกว่าจะมีหน้าเชิญ)

ตอนนี้ยังไม่มีหน้าเชิญสมาชิก ให้ทำด้วยมือผ่าน Firebase Console:

1. ให้แฟนเปิดแอปและล็อกอินหนึ่งครั้ง (ระบบจะสร้างครอบครัวใหม่แยกให้อัตโนมัติ — ไม่ต้องสนใจครอบครัวนั้น)
2. เจ้าของคัดลอก uid ของแฟนจาก Firebase Console → Authentication → Users
3. ใน Firestore เปิดเอกสาร `families/{familyId}` ของครอบครัวเรา แล้วเพิ่ม uid นั้นเข้าอาร์เรย์ `memberUids`
4. ใน Firestore เปิดเอกสาร `users/{partnerUid}` แล้วตั้งค่า field `familyId` ให้เป็น familyId เดียวกับข้อ 3
5. ให้แฟนรีโหลดแอป จะเห็นข้อมูลของครอบครัวเดียวกัน
