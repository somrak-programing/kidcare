# KidCare — เฟส 1 Design Spec

วันที่: 2026-09-30
ขอบเขต: ข้อมูลเด็ก + การแพ้ยา/อาหาร + วัคซีน (EPI + ชุดเพิ่มเอง) + นำเข้าประวัติวัคซีนจากรูปสมุดชมพูด้วย AI + นัดหมาย + แจ้งเตือนผ่านปฏิทิน

## 1. เป้าหมาย

ระบบบันทึกสุขภาพลูก 2 คน (3 ขวบ และขวบกว่า) ที่พ่อแม่ใช้ร่วมกันบนมือถือ เฟส 1 ต้องตอบได้ว่า:

- ลูกแพ้ยา/อาหารอะไร (เปิดให้หมอดูได้ทันที)
- วัคซีนเข็มไหนฉีดแล้ว เข็มไหนถึงกำหนด/เลยกำหนด
- นัดถัดไปคือเมื่อไร และมีการเตือนในปฏิทินมือถือ
- ประวัติวัคซีนเดิมในสมุดบันทึกสุขภาพแม่และเด็ก (สมุดชมพู) เข้าระบบได้โดยถ่ายรูป ไม่ต้องพิมพ์เอง

เกณฑ์สำเร็จ: บันทึกชุดวัคซีนพิษสุนัขบ้าที่กำลังฉีดอยู่ได้ครบ, เห็นเข็ม EPI ที่ค้างของลูกทั้งสองคน, กดเพิ่มนัดลงปฏิทินแล้วได้เตือนล่วงหน้า 1 วันและเช้าวันนัด, ถ่ายรูปหน้าวัคซีนในสมุดชมพูแล้วได้รายการเข็มให้ตรวจทานและบันทึกได้โดยไม่ต้องพิมพ์

นอกขอบเขตเฟส 1: การป่วย/Visit/ยา/บันทึกไข้ (เฟส 2), Dashboard/กราฟการเติบโต/PDF (เฟส 3), หน้าเชิญสมาชิกครอบครัว/AI อ่านใบนัดและใบสั่งยา/push notification (เฟส 4 — ใช้ Worker ตัวเดียวกับหัวข้อ 6)

## 2. สถาปัตยกรรม

- ที่อยู่โปรเจกต์: `C:\xampp\htdocs\KidCare`
- Stack (เหมือน ot-tracker): React 18 + Vite + TypeScript + Tailwind + Radix UI + react-hook-form + zod + @tanstack/react-query + zustand + date-fns + lucide-react + vite-plugin-pwa
- Firebase **project ใหม่** (ไม่ใช้ร่วมกับ money-flow-28a5c): Auth (Google), Firestore, Hosting
- Firestore เปิด offline cache ด้วย `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` ให้บันทึกได้ตอนสัญญาณไม่ดี แล้ว sync เมื่อกลับมาออนไลน์
- Firebase อยู่บน Spark plan (ฟรี ไม่ผูกบัตร) — **ไม่ใช้ Cloud Functions และไม่ใช้ Cloud Storage** (bucket ใหม่ต้องใช้ Blaze)
- งานที่ต้องเก็บ secret (เรียก Claude API) ทำใน **Cloudflare Worker** (free plan ไม่ต้องผูกบัตร) โค้ดอยู่ใน `worker/` ของ repo เดียวกัน
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
    vaccineDoses/{id}              familyId, childId, seriesId, vaccineName, vaccineCode?, doseNo,
                                   dueDate|null, given: boolean, givenDate|null, givenDateUnknown: boolean,
                                   brand?, lotNo?, amount?, site?, givenBy?, place?, notes?,
                                   source(manual|import), importConfidence?(high|medium|low)
```

หลักการ:

- ทุกเอกสารอยู่ใต้ `families/{familyId}` เพื่อรองรับการแชร์ครอบครัว ล็อกอินครั้งแรกระบบสร้าง family ให้อัตโนมัติ (ผู้ใช้เป็น owner และสมาชิกคนเดียว) แล้วเขียน `users/{uid}.familyId`
- หน้าแรกดึงเข็มที่ยังไม่ฉีดด้วย query ต่อเด็กหนึ่งคน (`given == false`, เรียงวันที่ฝั่ง client) — มีลูก 2 คน จึงไม่ต้องใช้ collectionGroup query/composite index ใช้ฟิลด์ `given` แยก เพราะเข็ม "ฉีดแล้ว ไม่ทราบวันที่" มี `givenDate` เป็น null
- `vaccineDoses` เก็บ `familyId`/`childId` ซ้ำเพื่อให้ rules ตรวจได้ และเก็บ `vaccineCode` (จาก EPI template) ไว้จับคู่ตอนนำเข้าจากสมุดชมพู
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

## 6. นำเข้าประวัติวัคซีนจากรูปสมุดชมพู (AI)

### 6.1 ภาพรวม flow

```
มือถือ (KidCare)                       Cloudflare Worker                 Claude API
เลือก/ถ่ายรูป 1–6 หน้า
ย่อรูป (ด้านยาว ≤1600px, JPEG 0.85)
POST /extract-vaccines  ──────────────▶ ตรวจ Firebase ID token
  Authorization: Bearer <idToken>       ตรวจ uid อยู่ใน ALLOWED_UIDS
  { images[], birthDate }               เรียก messages.create ─────────▶ อ่านรูป → JSON ตาม schema
                         ◀────────────── คืน records[] (ไม่เก็บรูป)
หน้าตรวจทาน → ผู้ใช้ยืนยัน → เขียน Firestore (batch)
```

- รูปไม่ถูกเก็บที่ไหนในระบบ ใช้ครั้งเดียวแล้วทิ้ง เก็บเฉพาะข้อมูลที่ผู้ใช้ยืนยันแล้ว
- ไม่ส่งชื่อ/HN ของลูกไป Worker ส่งแค่รูปกับวันเกิด (ใช้ตรวจความสมเหตุสมผลของวันที่)
- **ไม่มีการบันทึกอัตโนมัติ** ทุกรายการต้องผ่านหน้าตรวจทานก่อน

### 6.2 Cloudflare Worker (`worker/`)

- TypeScript + `@anthropic-ai/sdk` (ใช้ได้บน Workers เพราะใช้ fetch) + `jose` สำหรับตรวจ JWT
- ตรวจ Firebase ID token: RS256 กับ public keys ของ `securetoken@system.gserviceaccount.com`, `aud == FIREBASE_PROJECT_ID`, `iss == https://securetoken.google.com/<projectId>`, ไม่หมดอายุ
- Secrets/vars: `ANTHROPIC_API_KEY` (wrangler secret), `FIREBASE_PROJECT_ID`, `ALLOWED_UIDS` (uid ของพ่อและแม่ คั่นด้วยจุลภาค), `ALLOWED_ORIGIN` (โดเมน Hosting สำหรับ CORS)
- จำกัด: ไม่เกิน 6 รูปต่อ request, รูปละไม่เกิน 2 MB (หลัง base64) — เกินคืน 413
- เพดานค่าใช้จ่าย: ตั้ง spend limit ของ workspace ใน Anthropic Console (เช่น $10/เดือน) เป็นตัวกันสุดท้าย

### 6.3 การเรียก Claude

- Model: `claude-opus-5-5`, `output_config: { effort: "medium", format: { type: "json_schema", schema } }` (structured outputs รับประกันว่า JSON ตรง schema)
- เปิด refusal fallback: beta `server-side-fallback-2026-07-01` + `fallbacks: "default"` และตรวจ `stop_reason` ก่อนอ่านผลเสมอ (`refusal` → คืน error ให้ผู้ใช้ลองใหม่/กรอกเอง, `max_tokens` → คืน error)
- รูปส่งเป็น content block `{ type: "image", source: { type: "base64", media_type: "image/jpeg", data } }` วางก่อนข้อความ prompt
- Prompt สั่งให้:
  - อ่านเฉพาะตารางบันทึกการได้รับวัคซีน, คัดลอกชื่อวัคซีนตามที่เขียน (`vaccineRaw`) และจับคู่เป็นรหัสมาตรฐาน (`vaccineCode`)
  - แปลงวันที่ พ.ศ. เป็น ค.ศ. (รวมปีย่อ 2 หลัก เช่น `67` = พ.ศ. 2567 = ค.ศ. 2024) คืนทั้ง `dateRaw` และ `dateGiven`
  - **ห้ามเดา** อ่านไม่ออกให้เป็น null และลด `confidence`
- Schema ผลลัพธ์:

```ts
{
  records: Array<{
    pageIndex: number;                 // รูปที่เท่าไร (0-based)
    vaccineRaw: string;                // ตามที่เขียนในสมุด
    vaccineCode: 'BCG'|'HB'|'DTP-HB-Hib'|'DTP'|'OPV'|'IPV'|'MMR'|'JE'|'ROTA'|'HPV'|'dT'|'OTHER';
    doseNo: number | null;
    dateRaw: string | null;
    dateGiven: string | null;          // YYYY-MM-DD ค.ศ.
    lotNo: string | null;
    place: string | null;
    confidence: 'high'|'medium'|'low';
    note: string | null;               // เช่น "ลายมือเลือน"
  }>
}
```

  (รายการ `vaccineCode` ต้องปรับให้ตรงกับ `src/data/epi.ts` หลังตรวจตาราง EPI จริง)

- ค่าใช้จ่ายโดยประมาณ: รูป 1600px ≈ 1.5–2.5k input tokens, output รวม thinking ≈ 1–3k tokens → ราว $0.03–0.07 ต่อหน้า (1–2.5 บาท) ที่ราคา $4/$20 ต่อ MTok

### 6.4 หน้าตรวจทาน (`/children/:id/import`)

- แสดงรูปย่อคู่กับตารางรายการที่อ่านได้ แถว `confidence: low` หรือวันที่เป็น null ไฮไลต์สีเหลือง
- ทุกช่องแก้ได้ และมี checkbox "นำเข้า" รายแถว (ค่าเริ่มต้น: ติ๊กทุกแถวที่มี `dateGiven`)
- **จับคู่อัตโนมัติ** (ฟังก์ชัน pure `matchImportedDoses(records, doses)`): จับกับเข็ม EPI ที่ยังไม่ฉีดด้วย `vaccineCode` + `doseNo` ถ้า `doseNo` เป็น null ให้เลือกเข็มที่ยังไม่ฉีดลำดับแรกของวัคซีนนั้น ผู้ใช้เปลี่ยนการจับคู่ได้จาก dropdown หรือเลือก "สร้างเป็นชุดเพิ่มเอง"
- ตรวจความสมเหตุสมผล: วันที่ก่อนวันเกิดหรือในอนาคต → เตือนและไม่ติ๊กนำเข้าให้อัตโนมัติ, เข็มที่ถูกจับคู่ซ้ำ → เตือน
- กดบันทึก → Firestore batch: อัปเดต dose ที่จับคู่ (`given: true`, `givenDate`, `lotNo`, `place`, `source: 'import'`, `importConfidence`) และสร้าง series/dose ใหม่สำหรับรายการที่เลือกสร้างเอง
- ถ้า Worker ใช้ไม่ได้ (ออฟไลน์/เครดิตหมด/refusal) แสดงข้อความชัดเจนและให้ทางเลือกติ๊กเข็มแบบกลุ่มด้วยมือ (หัวข้อ 4.2)

### 6.5 การตั้งค่าครั้งแรก (ทำโดยผู้ใช้)

1. สมัคร Anthropic Console, เติมเครดิต (ขั้นต่ำ ~$5), สร้าง API key, ตั้ง spend limit
2. สมัคร Cloudflare (free), `npx wrangler login`, `npx wrangler secret put ANTHROPIC_API_KEY`
3. ใส่ URL ของ Worker ใน `.env.local` ของเว็บ (`VITE_EXTRACT_URL`)

## 7. หน้าจอ

| Route | หน้าที่ |
|---|---|
| `/login` | ปุ่ม Google sign-in |
| `/` | นัดที่เลยกำหนด/ใกล้ถึงของลูกทุกคน + การ์ดเด็ก (ชื่อ อายุ จำนวนเข็มค้าง ไอคอนเตือนถ้ามีการแพ้) |
| `/children/new`, `/children/:id/edit` | ฟอร์มข้อมูลเด็ก + รายการ HN หลายโรงพยาบาล + ตัวเลือกสร้าง EPI |
| `/children/:id` | **แถบแดงการแพ้ยา/อาหารอยู่บนสุดเสมอ** (ถ้าไม่มีแสดง "ไม่มีประวัติแพ้" สีเทา), ข้อมูลเด็ก, HN, แท็บ วัคซีน / นัด |
| `/children/:id/allergies` | เพิ่ม/แก้/ลบการแพ้ |
| `/children/:id/series/new` | เลือก template แล้วสร้างชุดวัคซีน |
| dialog บันทึกเข็ม | วันที่ฉีด, ยี่ห้อ, Lot No., ขนาด, ตำแหน่ง, ผู้ฉีด, สถานที่, หมายเหตุ |
| `/children/:id/import` | ถ่าย/เลือกรูปสมุดชมพู → ตรวจทาน → บันทึก (หัวข้อ 6) |
| `/appointments/new` | นัดหมอทั่วไป |
| `/settings` | ชื่อครอบครัว, สมาชิก (แสดงอย่างเดียว), ออกจากระบบ |

โครงโค้ด: `src/lib/` (firebase, firestore repo แยกไฟล์ตาม collection), `src/domain/` (pure logic: doseStatus, schedule, ics, age), `src/data/` (templates), `src/hooks/`, `src/pages/`, `src/components/`

## 8. ความปลอดภัย

`firestore.rules`:

- `users/{uid}`: อ่านและเขียนได้เฉพาะเจ้าของ
- `families/{fid}`: สร้างได้เมื่อ `request.auth.uid == ownerUid` และ `memberUids == [request.auth.uid]` ส่วนอ่าน/แก้ได้เมื่อ `request.auth.uid in resource.data.memberUids` (เฉพาะ owner ที่แก้ `memberUids` ได้)
- subcollection ทั้งหมดใต้ `families/{fid}/**`: ต้องเป็นสมาชิก ตรวจด้วย `get(/databases/$(database)/documents/families/$(fid)).data.memberUids`
- เขียน `vaccineDoses`/`appointments` ต้องให้ `familyId` ตรงกับ `fid` ใน path

Worker: API key อยู่ใน wrangler secret เท่านั้น, ทุก request ต้องมี Firebase ID token ที่ถูกต้องและ uid อยู่ใน `ALLOWED_UIDS`, CORS อนุญาตเฉพาะ `ALLOWED_ORIGIN`, ไม่ log รูปหรือผลลัพธ์

อื่น ๆ: `.env.local` และ `worker/.dev.vars` ไม่ commit, และไม่ log ข้อมูลสุขภาพลง console ใน production

## 9. การจัดการ error

- เขียนตอน offline: ไม่ `await` การเขียน (Firestore จะ resolve เมื่อ server ตอบรับเท่านั้น) ให้ยิงแล้วไปต่อทันที, error แสดงเป็น alert และแสดงป้าย "ออฟไลน์ — รอซิงก์" ที่ header เมื่อ `navigator.onLine` เป็น false
- permission-denied: แสดงข้อความแล้วพากลับหน้าแรก
- ฟอร์มตรวจสอบด้วย zod (วันเกิดต้องไม่อยู่ในอนาคต, วันที่ฉีดต้องไม่ก่อนวันเกิด, `doseNo >= 1`)
- ลบข้อมูล (การแพ้, series, นัด) ต้องยืนยันก่อน ลบ series จะลบ doses ของ series นั้นใน batch เดียวกัน

## 10. การทดสอบ

- Vitest สำหรับ `src/domain/*` (รวม `matchImportedDoses`, การตรวจความสมเหตุสมผลของวันที่นำเข้า, การคำนวณขนาดรูปหลังย่อ): doseStatus (ทุกสถานะ + วันขอบ), สร้าง EPI จากวันเกิด (รวมวันสิ้นเดือน), สร้างชุดจาก template, shiftRemainingDoses, buildIcs (escape, VALARM, all-day), คำนวณอายุ (ปี/เดือน)
- `@firebase/rules-unit-testing` + Firestore Emulator: สมาชิกอ่าน/เขียนได้, คนนอกทำไม่ได้, คนที่ไม่ใช่ owner แก้ `memberUids` ไม่ได้
- Worker: unit test การตรวจ token (token ปลอม/หมดอายุ/aud ผิด/uid ไม่อยู่ในรายชื่อ → 401/403), ขนาดและจำนวนรูปเกิน → 413, และการแปลงผลลัพธ์ Claude โดย mock SDK (ไม่เรียก API จริงใน test)
- ทดสอบการอ่านจริงด้วยรูปสมุดชมพูของลูกทั้งสองคน 1 รอบ เทียบกับสมุดด้วยตา แล้วปรับ prompt ถ้าจำเป็น
- ทดสอบด้วยมือบนมือถือ: ติดตั้ง PWA, บันทึกตอนโหมดเครื่องบินแล้วซิงก์, นำเข้า .ics บน iPhone และ Android

## 11. Deploy

เว็บ: `npm run build && npx firebase deploy --only hosting,firestore:rules,firestore:indexes`

Worker: `cd worker && npx wrangler deploy`

ไม่ต้องมี composite index ในเฟส 1
