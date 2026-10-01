# KidCare — เฟส 2 Design Spec

วันที่: 2026-10-01  
ขอบเขต: ประวัติการเจ็บป่วย (Illness) + การไปพบแพทย์ (Visits) + บันทึกยา (Medications) + บันทึกไข้ (Temperature Logs) & ระบบเตือนระยะห่างยาลดไข้

---

## 1. เป้าหมายของเฟส 2

เมื่อลูกมีอาการป่วย พ่อแม่มักเจอปัญหา:
1. **จำประวัติการป่วยไม่ได้:** หมอถามว่า "เริ่มเป็นไข้วันไหน มีอาการอะไรบ้าง เคยไปตรวจที่ไหนมา"
2. **กังวลเรื่องการให้ยาลดไข้ซ้ำ:** ลืมว่าให้ยาลดไข้ไปกี่โมง หรือพ่อกับแม่ให้ยาซ้อนกัน เสี่ยงต่อการได้ยาเกินขนาด (Paracetamol toxicity)
3. **กินยาไม่ครบ/สับสนวิธีใช้ยา:** มีทั้งยาฆ่าเชื้อที่ต้องกินให้หมด และยากินเฉพาะเวลาจำเป็น
4. **ไม่เห็นแนวโน้มไข้:** ไม่แน่ใจว่าไข้เริ่มลดลงหรือสูงขึ้น เพื่อตัดสินใจว่าจะพาไป รพ. เมื่อไร

### เกณฑ์สำเร็จของเฟส 2:
- บันทึกการป่วย 1 ครั้ง เชื่อมโยงหลาย Visit และบันทึกยาแต่ละตัวได้
- บันทึกไข้ได้สะดวกรวดเร็ว (Quick Temp Log) ทั้งจากหน้าแรกและหน้าเด็ก
- **ระบบแจ้งเตือนทันที** หากมีการบันทึกการให้ยาลดไข้ห่างจากครั้งก่อนหน้า **น้อยกว่า 4 ชั่วโมง** (เตือนพร้อมคำแนะนำ)
- แสดงกราฟไข้ในช่วงป่วย เพื่อให้เปิดหน้าจอให้หมอดูได้ทันที

---

## 2. โครงข้อมูล Firestore (เฟส 2)

ต่อยอดใต้ `families/{familyId}/children/{childId}` เดิมโดยไม่ต้องย้ายโครงสร้างเก่า:

```
families/{familyId}
  children/{childId}
    ... (ข้อมูลเดิม: allergies, vaccineSeries, vaccineDoses)
    
    illnesses/{illnessId}
      id: string
      childId: string
      name: string                    # เช่น "ไข้หวัด", "RSV", "มือเท้าปาก", "ท้องร่วง"
      startDate: ISODate              # วันที่เริ่มมีอาการ
      endDate?: ISODate | null        # วันที่หาย (null = ยังป่วยอยู่)
      symptoms: string[]              # เช่น ["ไข้", "ไอ", "น้ำมูก", "ผื่น", "อาเจียน"]
      notes?: string                  # บันทึกเพิ่มเติม
      status: "active" | "recovered"  # สถานะ
      createdAt: Timestamp
      
    visits/{visitId}
      id: string
      childId: string
      illnessId?: string              # ผูกกับการป่วยครั้งไหน (optional)
      date: ISODate                   # วันที่ไปตรวจ
      time?: string                   # เวลา (HH:mm)
      hospital: string                # โรงพยาบาล/คลินิก
      doctor?: string                 # ชื่อหมอ (ถ้ามี)
      diagnosis?: string              # ผลการวินิจฉัยของหมอ
      advice?: string                 # คำแนะนำแพทย์
      nextApptDate?: ISODate          # นัดดูอาการครั้งถัดไป (สร้างนัดใน appointments ได้)
      createdAt: Timestamp

    medications/{medId}
      id: string
      childId: string
      illnessId?: string              # ผูกกับการป่วย
      visitId?: string                # ผูกกับ visit ที่ได้รับยามา
      name: string                    # เช่น "Tempra (Paracetamol)", "Amoxicillin"
      type: "fever" | "antibiotic" | "cough_cold" | "allergy" | "other" # ชนิดยา
      dosage: string                  # เช่น "5 ml", "1 เม็ด"
      frequency: string               # เช่น "ทุก 4-6 ชม. เวลามีไข้", "วันละ 2 ครั้ง หลังอาหาร"
      requiresCompletion: boolean     # เป็นยาที่ต้องกินให้หมดหรือไม่ (เช่น ยาฆ่าเชื้อ)
      startDate: ISODate              # วันเริ่มยา
      endDate?: ISODate               # วันสิ้นสุดยา
      status: "active" | "completed" | "discontinued"
      notes?: string
      createdAt: Timestamp

    temperatureLogs/{logId}
      id: string
      childId: string
      illnessId?: string              # ผูกกับการป่วย (optional)
      timestamp: Timestamp            # วันและเวลาที่วัด
      tempCelsius: number             # ค่าอุณหภูมิ เช่น 38.5
      method: "ear" | "armpit" | "forehead" | "rectal" # จุดที่วัด
      gaveAntipyretic: boolean        # ให้ยาลดไข้พร้อมกันหรือไม่
      antipyreticMedName?: string     # ชนิดยา เช่น "Paracetamol"
      antipyreticDose?: string        # ขนาดยา เช่น "4.5 ml"
      notes?: string
      createdAt: Timestamp
```

---

## 3. ตรรกะสำคัญ (Domain Logic)

### 3.1 ระบบความปลอดภัยในการให้ยาลดไข้ (Antipyretic Safety Guard)
- เมื่อผู้ใช้บันทึกการวัดไข้แล้วติ๊ก `gaveAntipyretic: true`
- ระบบตรวจสอบบันทึกล่าสุดที่มีการให้ยาลดไข้ของเด็กคนนั้น:
  * **ถ้าน้อยกว่า 4 ชั่วโมง:** แสดงกล่องเตือน **สีแดง (อันตราย)** *"เพิ่งให้ยาลดไข้ไปเมื่อ [เวลา] (ห่างกันเพียง X ชม. Y นาที) การให้ยาซ้ำถี่เกินไปอาจเกิดอันตรายต่อตับ ควรเว้นอย่างน้อย 4-6 ชั่วโมง หรือใช้วิธีเช็ดตัวลดไข้"*
  * **ถ้า 4 - 6 ชั่วโมง:** แสดงข้อความ **สีเหลือง (ระวัง)** *"ให้ยาได้ถ้ายังมีไข้สูง (>38.5°C) ควรสังเกตอาการและเช็ดตัวประกอบ"*
  * **ถ้ามากกว่า 6 ชั่วโมง:** ให้ยาได้ตามเกณฑ์ปกติ

### 3.2 การจำแนกระดับไข้
- `< 37.5°C`: ปกติ (เขียว)
- `37.5°C - 38.4°C`: ไข้ต่ำ (ส้ม)
- `≥ 38.5°C`: ไข้สูง (แดง)
- `≥ 39.5°C`: ไข้สูงมาก (แดงเข้ม + คำเตือนเสี่ยงชักจากไข้สูงในเด็กเล็ก)

---

## 4. หน้าจอและ UI ที่จะเพิ่มในเฟส 2

1. **หน้ารวมประวัติการเจ็บป่วย (`/children/:id/illnesses`)**
   * แสดงการป่วยที่กำลังดำเนินอยู่ (Active) เป็นกล่องเด่นด้านบน
   * ประวัติการป่วยที่หายแล้วด้านล่าง
2. **หน้าฟอร์มบันทึกการป่วยใหม่ (`/children/:id/illnesses/new`)**
   * ชื่อโรค/อาการ, วันที่เริ่ม, อาการที่มี (checkbox สะดวกๆ: มีไข้, ไอ, น้ำมูก, ผื่น, ถ่ายเหลว, ซึม ฯลฯ)
3. **หน้ารายละเอียดการป่วย 1 ครั้ง (`/children/:id/illnesses/:illnessId`)**
   * รวมทุกอย่างของการป่วยครั้งนี้:
     * ประวัติการวัดไข้ + กราฟอุณหภูมิ
     * รายการยาที่กำลังกิน (พร้อมบอกว่าให้ยาครั้งล่าสุดเมื่อกี่โมง)
     * ประวัติการไปหาหมอ (Visits)
     * ปุ่ม "บันทึกว่าหายแล้ว"
4. **ปุ่มด่วน "บันทึกไข้" (Quick Temp Log)**
   * อยู่ที่หน้าแรก (Home) และหน้ารายละเอียดลูก กดแล้วเปิด Dialog บันทึกอุณหภูมิ + ติ๊กให้ยาลดไข้ได้ทันทีใน 5 วินาที
5. **บันทึกการไปพบแพทย์ (`/children/:id/visits/new`)**
   * บันทึก รพ., หมอ, ผลตรวจ, คำแนะนำ และมียาที่ได้กลับมา

---

## 5. แผนการดำเนินงานเป็นขั้นๆ (Implementation Steps)

1. **Step 1:** เพิ่ม Types (`src/types/index.ts`) และ Security Rules สำหรับ 4 collection ใหม่
2. **Step 2:** เขียน Domain Logic & Unit Tests (`src/domain/illness.ts`, `src/domain/temperature.ts`)
3. **Step 3:** สร้าง Firestore Repositories & Data Hooks (`src/lib/repo/*`, `src/hooks/data.ts`)
4. **Step 4:** สร้าง Dialog บันทึกไข้ด่วน (`QuickTempDialog.tsx`) และระบบเตือนยาลดไข้ < 4 ชม.
5. **Step 5:** สร้างหน้าประวัติการป่วยและการไปพบแพทย์ (`IllnessList.tsx`, `IllnessDetail.tsx`, `VisitForm.tsx`)
6. **Step 6:** เชื่อมต่อเข้ากับหน้าแรก Dashboard และหน้ารายละเอียดลูก
7. **Step 7:** ทดสอบ Unit Test + Build & Deploy ขึ้นระบบจริง
