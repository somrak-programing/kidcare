# KidCare — เฟส 1 Design Spec

วันที่: 2026-09-30
ขอบเขต: ข้อมูลเด็ก + การแพ้ยา/อาหาร + วัคซีน (EPI + ชุดเพิ่มเอง) + นัดหมาย + แจ้งเตือนผ่านปฏิทิน

## 1. เป้าหมาย

ระบบบันทึกสุขภาพลูก 2 คน (3 ขวบ และขวบกว่า) ที่พ่อแม่ใช้ร่วมกันบนมือถือ เฟส 1 ต้องตอบได้ว่า:

- ลูกแพ้ยา/อาหารอะไร (เปิดให้หมอดูได้ทันที)
- วัคซีนเข็มไหนฉีดแล้ว เข็มไหนถึงกำหนด/เลยกำหนด
- นัดถัดไปคือเมื่อไร และมีการเตือนในปฏิทินมือถือ

เกณฑ์สำเร็จ: บันทึกชุดวัคซีนพิษสุนัขบ้าที่กำลังฉีดอยู่ได้ครบ, เห็นเข็ม EPI ที่ค้างของลูกทั้งสองคน, กดเพิ่มนัดลงปฏิทินแล้วได้เตือนล่วงหน้า 1 วันและเช้าวันนัด

นอกขอบเขตเฟส 1: การป่วย/Visit/ยา/บันทึกไข้ (เฟส 2), Dashboard/กราฟการเติบโต/PDF (เฟส 3), หน้าเชิญสมาชิกครอบครัว/AI อ่านใบนัด/push notification (เฟส 4)

## 2. สถาปัตยกรรม

- ที่อยู่โปรเจกต์: `C:\xampp\htdocs\KidCare`
- Stack (เหมือน ot-tracker): React 18 + Vite + TypeScript + Tailwind + Radix UI + react-hook-form + zod + @tanstack/react-query + zustand + date-fns + lucide-react + vite-plugin-pwa
- Firebase **project ใหม่** (ไม่ใช้ร่วมกับ money-flow-28a5c): Auth (Google), Firestore, Hosting
- Firestore เปิด offline cache ด้วย `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` ให้บันทึกได้ตอนสัญญาณไม่ดี แล้ว sync เมื่อกลับมาออนไลน์
- ไม่มี backend/Cloud Functions ในเฟส 1 (ใช้ Spark plan ได้)
- UI ภาษาไทย, วันที่แสดงเป็น พ.ศ. แต่เก็บเป็น ISO date `YYYY-MM-DD` (ค.ศ.)

## 3. โครงข้อมูล Firestore

```
users/{uid}                        familyId, displayName, email
families/{familyId}                name, ownerUid, memberUids: string[], createdAt
  appointments/{id}                familyId, childId, date, time?, place, purpose,
                                   linkedDoseId?, notes?, done: boolean
  children/{childId}               name, nickname?, birthDate, sex(M|F),
                                   bloodType?(A|B|AB|O + Rh?), hospitals: {name, hn}[],
                                   createdAt
    allergies/{id}                 type(drug|food|other), substance, reaction,
                                   severity(mild|moderate|severe), notes?, notedAt?
    vaccineSeries/{id}             name, source(epi|custom), templateKey?, reason?,
                                   createdAt
    vaccineDoses/{id}              familyId, childId, seriesId, vaccineName, doseNo,
                                   dueDate|null, given: boolean, givenDate|null, givenDateUnknown: boolean,
                                   brand?, lotNo?, amount?, site?, givenBy?, place?, notes?
```

หลักการ:

- ทุกเอกสารอยู่ใต้ `families/{familyId}` เพื่อรองรับการแชร์ครอบครัว ล็อกอินครั้งแรกระบบสร้าง family ให้อัตโนมัติ (ผู้ใช้เป็น owner และสมาชิกคนเดียว) แล้วเขียน `users/{uid}.familyId`
- `vaccineDoses` เก็บ `familyId`/`childId`/`vaccineName` ซ้ำ (denormalize) เพื่อใช้ collectionGroup query ข้ามลูกทุกคนในหน้าแรก (`familyId == X`, `given == false`, orderBy `dueDate`) — ใช้ฟิลด์ `given` แยก เพราะเข็ม "ฉีดแล้ว ไม่ทราบวันที่" มี `givenDate` เป็น null
- เฟส 2 จะเพิ่ม `illnesses`, `visits`, `medications`, `temperatureLogs` และเฟส 3 เพิ่ม `growth` ใต้ `children/{childId}` โดยไม่ต้องย้ายข้อมูลเดิม

## 4. ตรรกะวัคซีน

### 4.1 สถานะเข็ม (คำนวณ ไม่เก็บลงฐานข้อมูล)

ฟังก์ชัน pure `doseStatus(dose, today)`:

| เงื่อนไข | สถานะ |
|---|---|
| `given == true` | `given` ฉีดแล้ว |
| `dueDate` เป็น null | `unscheduled` ยังไม่นัด |
| `dueDate < today` | `overdue` เลยกำหนด |
| `dueDate - today <= 7 วัน` | `dueSoon` ใกล้ถึง |
| อื่น ๆ | `scheduled` นัดแล้ว |

### 4.2 EPI template

- ไฟล์ static `src/data/epi.ts`: รายการ `{ key, vaccineName, doseNo, ageMonths }`
- **ก่อนเขียนไฟล์นี้ต้องเทียบกับตาราง EPI ของกรมควบคุมโรคฉบับล่าสุด** และใส่แหล่งอ้างอิงไว้ในคอมเมนต์หัวไฟล์
- ตอนเพิ่มเด็ก มีตัวเลือก "สร้างตาราง EPI" → สร้าง series `source: 'epi'` และ doses โดย `dueDate = birthDate + ageMonths`
- เข็มที่ dueDate ผ่านไปแล้ว ผู้ใช้ติ๊กฉีดแล้วแบบกลุ่มได้ (ใส่วันที่หรือเลือก "ไม่ทราบวันที่")

### 4.3 ชุดวัคซีนเพิ่มเอง

- Template ใน `src/data/customTemplates.ts`:
  - พิษสุนัขบ้าหลังสัมผัส ฉีดเข้ากล้าม: วันที่ 0, 3, 7, 14, 28
  - พิษสุนัขบ้าหลังสัมผัส ฉีดเข้าผิวหนัง: วันที่ 0, 3, 7, 28
  - ว่าง (กำหนดจำนวนเข็มและระยะห่างเอง) เช่น ไข้หวัดใหญ่ หรือวัคซีนทางเลือก
- สร้างจากวันที่ของเข็มแรก ผู้ใช้แก้ระยะห่างก่อนบันทึกได้ และจะเริ่มจากเข็มที่ 2 ก็ได้ (กรณีฉีดเข็มแรกไปก่อนมีแอป)
- **เลื่อนนัดตาม:** ถ้าบันทึก `givenDate` ช้ากว่า `dueDate` ระบบเสนอให้เลื่อนเข็มที่ยังไม่ฉีดไปตามจำนวนวันที่ช้า (ผู้ใช้ยืนยันก่อน) ใช้ฟังก์ชัน pure `shiftRemainingDoses(doses, fromDoseNo, days)`

## 5. นัดหมายและการแจ้งเตือน

- "นัด" มี 2 แหล่ง: เข็มวัคซีนที่ยังไม่ฉีดและมี `dueDate`, กับ `appointments` (นัดหมอทั่วไป)
- หน้าแรกรวมนัดของลูกทุกคน เรียงตามวันที่ แยกกลุ่ม: เลยกำหนด / 7 วันข้างหน้า / ถัดไป
- ทุกนัดมีปุ่ม:
  - **เพิ่มลง Google Calendar** เปิดลิงก์ `calendar.google.com/calendar/render?action=TEMPLATE&...` (ข้อความในลิงก์มีแค่ชื่อเล่นลูก + ชื่อวัคซีน/วัตถุประสงค์ + สถานที่ ไม่ใส่ HN หรือข้อมูลการแพ้)
  - **ดาวน์โหลด .ics** (สำหรับ iPhone) มี 2 VALARM คือ `TRIGGER:-P1D` และเวลา 07:00 เช้าวันนัด เป็น all-day event ถ้าไม่มีเวลา
- ตัวสร้าง `.ics` เป็นฟังก์ชัน pure `buildIcs(event)` escape อักขระตาม RFC 5545 และใช้ UID คงที่ต่อ dose/appointment เพื่อให้เพิ่มซ้ำแล้วทับของเดิม

## 6. หน้าจอ

| Route | หน้าที่ |
|---|---|
| `/login` | ปุ่ม Google sign-in |
| `/` | นัดที่เลยกำหนด/ใกล้ถึงของลูกทุกคน + การ์ดเด็ก (ชื่อ อายุ จำนวนเข็มค้าง ไอคอนเตือนถ้ามีการแพ้) |
| `/children/new`, `/children/:id/edit` | ฟอร์มข้อมูลเด็ก + รายการ HN หลายโรงพยาบาล + ตัวเลือกสร้าง EPI |
| `/children/:id` | **แถบแดงการแพ้ยา/อาหารอยู่บนสุดเสมอ** (ถ้าไม่มีแสดง "ไม่มีประวัติแพ้" สีเทา), ข้อมูลเด็ก, HN, แท็บ วัคซีน / นัด |
| `/children/:id/allergies` | เพิ่ม/แก้/ลบการแพ้ |
| `/children/:id/series/new` | เลือก template แล้วสร้างชุดวัคซีน |
| dialog บันทึกเข็ม | วันที่ฉีด, ยี่ห้อ, Lot No., ขนาด, ตำแหน่ง, ผู้ฉีด, สถานที่, หมายเหตุ |
| `/appointments/new` | นัดหมอทั่วไป |
| `/settings` | ชื่อครอบครัว, สมาชิก (แสดงอย่างเดียว), ออกจากระบบ |

โครงโค้ด: `src/lib/` (firebase, firestore repo แยกไฟล์ตาม collection), `src/domain/` (pure logic: doseStatus, schedule, ics, age), `src/data/` (templates), `src/hooks/`, `src/pages/`, `src/components/`

## 7. ความปลอดภัย

`firestore.rules`:

- `users/{uid}`: อ่านและเขียนได้เฉพาะเจ้าของ
- `families/{fid}`: สร้างได้เมื่อ `request.auth.uid == ownerUid` และ `memberUids == [request.auth.uid]` ส่วนอ่าน/แก้ได้เมื่อ `request.auth.uid in resource.data.memberUids` (เฉพาะ owner ที่แก้ `memberUids` ได้)
- subcollection ทั้งหมดใต้ `families/{fid}/**`: ต้องเป็นสมาชิก ตรวจด้วย `get(/databases/$(database)/documents/families/$(fid)).data.memberUids`
- collectionGroup `match /{path=**}/vaccineDoses/{id}`: อ่านได้เมื่อ `resource.data.familyId` เป็นครอบครัวที่ผู้ใช้เป็นสมาชิก
- เขียน `vaccineDoses`/`appointments` ต้องให้ `familyId` ตรงกับ `fid` ใน path

อื่น ๆ: `.env.local` ไม่ commit, และไม่ log ข้อมูลสุขภาพลง console ใน production

## 8. การจัดการ error

- เขียนตอน offline: แสดงป้าย "รอซิงก์" จาก `hasPendingWrites` และไม่บล็อกผู้ใช้
- permission-denied: แสดงข้อความแล้วพากลับหน้าแรก
- ฟอร์มตรวจสอบด้วย zod (วันเกิดต้องไม่อยู่ในอนาคต, วันที่ฉีดต้องไม่ก่อนวันเกิด, `doseNo >= 1`)
- ลบข้อมูล (การแพ้, series, นัด) ต้องยืนยันก่อน ลบ series จะลบ doses ของ series นั้นใน batch เดียวกัน

## 9. การทดสอบ

- Vitest สำหรับ `src/domain/*`: doseStatus (ทุกสถานะ + วันขอบ), สร้าง EPI จากวันเกิด (รวมวันสิ้นเดือน), สร้างชุดจาก template, shiftRemainingDoses, buildIcs (escape, VALARM, all-day), คำนวณอายุ (ปี/เดือน)
- `@firebase/rules-unit-testing` + Firestore Emulator: สมาชิกอ่าน/เขียนได้, คนนอกทำไม่ได้, collectionGroup query ข้ามครอบครัวถูกปฏิเสธ, คนที่ไม่ใช่ owner แก้ `memberUids` ไม่ได้
- ทดสอบด้วยมือบนมือถือ: ติดตั้ง PWA, บันทึกตอนโหมดเครื่องบินแล้วซิงก์, นำเข้า .ics บน iPhone และ Android

## 10. Deploy

`npm run build && npx firebase deploy --only hosting,firestore:rules,firestore:indexes` (ต้องมี composite index สำหรับ collectionGroup `vaccineDoses`: `familyId` + `given` + `dueDate`)
