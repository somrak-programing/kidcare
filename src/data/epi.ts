import type { EpiTemplateItem } from "@/domain/schedule";

// ตารางวัคซีนพื้นฐาน (EPI) กระทรวงสาธารณสุข — ถึงอายุ 7 ปี
// Source: กรมควบคุมโรค กระทรวงสาธารณสุข "กำหนดการให้วัคซีนตามแผนงานสร้างเสริมภูมิคุ้มกันโรคของกระทรวงสาธารณสุข ปี 2567"
//   (อ้างอิงมติคณะอนุกรรมการสร้างเสริมภูมิคุ้มกันโรค ครั้งที่ 4/2566)
//   https://ddc.moph.go.th/uploads/publish/1510320231225092421.pdf
//   หน้าเผยแพร่: https://www.ddc.moph.go.th/dcd/journal_detail.php?publish=15103
//   ตรวจเมื่อ 2026-09-30 — ฉบับ ปี 2567 (ฉบับ 2568 มีประกาศแต่เปิดอ่านไม่ได้ ควรเทียบซ้ำ)
// doseNo ใช้เลขตามป้ายในสมุดชมพู/โปสเตอร์ (เช่น OPV เริ่มที่ OPV3, DTP เริ่มที่ DTP4) — ไม่ต่อเนื่องจาก 1 ได้
// ไม่รวม: HB2 อายุ 1 เดือน (เฉพาะแม่เป็นพาหะไวรัสตับอักเสบบี), วัคซีนเก็บตก ป.1, HPV (ป.5), dT (ป.6)
// vaccineCode ใช้จับคู่กับผลอ่านสมุดชมพู (Plan 2) — ห้ามเปลี่ยนรหัสโดยไม่แก้ schema ใน worker
export const EPI_TEMPLATE: EpiTemplateItem[] = [
  { vaccineCode: "HB", vaccineName: "ตับอักเสบบี แรกเกิด (HB)", doseNo: 1, ageMonths: 0 },
  { vaccineCode: "BCG", vaccineName: "วัณโรค (BCG)", doseNo: 1, ageMonths: 0 },
  { vaccineCode: "DTP-HB-Hib", vaccineName: "คอตีบ-บาดทะยัก-ไอกรน-ตับอักเสบบี-ฮิบ (DTP-HB-Hib)", doseNo: 1, ageMonths: 2 },
  { vaccineCode: "IPV", vaccineName: "โปลิโอชนิดฉีด (IPV)", doseNo: 1, ageMonths: 2 },
  { vaccineCode: "ROTA", vaccineName: "โรต้า (Rota)", doseNo: 1, ageMonths: 2 },
  { vaccineCode: "DTP-HB-Hib", vaccineName: "คอตีบ-บาดทะยัก-ไอกรน-ตับอักเสบบี-ฮิบ (DTP-HB-Hib)", doseNo: 2, ageMonths: 4 },
  { vaccineCode: "IPV", vaccineName: "โปลิโอชนิดฉีด (IPV)", doseNo: 2, ageMonths: 4 },
  { vaccineCode: "ROTA", vaccineName: "โรต้า (Rota)", doseNo: 2, ageMonths: 4 },
  { vaccineCode: "DTP-HB-Hib", vaccineName: "คอตีบ-บาดทะยัก-ไอกรน-ตับอักเสบบี-ฮิบ (DTP-HB-Hib)", doseNo: 3, ageMonths: 6 },
  { vaccineCode: "OPV", vaccineName: "โปลิโอชนิดรับประทาน (OPV)", doseNo: 3, ageMonths: 6 },
  // Rota3: ยกเว้นเด็กที่ได้ Rotarix มาแล้ว 2 ครั้ง (ตามคำแนะนำในโปสเตอร์)
  { vaccineCode: "ROTA", vaccineName: "โรต้า (Rota)", doseNo: 3, ageMonths: 6 },
  { vaccineCode: "MMR", vaccineName: "หัด-คางทูม-หัดเยอรมัน (MMR)", doseNo: 1, ageMonths: 9 },
  { vaccineCode: "JE", vaccineName: "ไข้สมองอักเสบเจอี (LAJE)", doseNo: 1, ageMonths: 12 },
  { vaccineCode: "DTP", vaccineName: "คอตีบ-บาดทะยัก-ไอกรน (DTP)", doseNo: 4, ageMonths: 18 },
  { vaccineCode: "OPV", vaccineName: "โปลิโอชนิดรับประทาน (OPV)", doseNo: 4, ageMonths: 18 },
  { vaccineCode: "MMR", vaccineName: "หัด-คางทูม-หัดเยอรมัน (MMR)", doseNo: 2, ageMonths: 18 },
  { vaccineCode: "JE", vaccineName: "ไข้สมองอักเสบเจอี (LAJE)", doseNo: 2, ageMonths: 30 },
  { vaccineCode: "DTP", vaccineName: "คอตีบ-บาดทะยัก-ไอกรน (DTP)", doseNo: 5, ageMonths: 48 },
  { vaccineCode: "OPV", vaccineName: "โปลิโอชนิดรับประทาน (OPV)", doseNo: 5, ageMonths: 48 },
];
