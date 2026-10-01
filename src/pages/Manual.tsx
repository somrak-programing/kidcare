import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ArrowLeft,
  Calendar,
  Bell,
  Thermometer,
  TrendingUp,
  Printer,
  Users,
  AlertTriangle,
  Pill,
  Sparkles,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Manual() {
  const [lang, setLang] = useState<"th" | "en">("th");

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Navigation & Language Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 print:hidden">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} />
          {lang === "th" ? "กลับสู่หน้าหลัก" : "Back to Home"}
        </Link>

        <div className="flex items-center gap-2">
          {/* Language Switcher Buttons */}
          <div className="flex items-center bg-secondary/80 p-0.5 rounded-lg border text-xs">
            <button
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                lang === "th"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setLang("th")}
            >
              🇹🇭 ภาษาไทย
            </button>
            <button
              type="button"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
                lang === "en"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setLang("en")}
            >
              🇬🇧 English
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-8 text-xs flex items-center gap-1"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">{lang === "th" ? "พิมพ์คู่มือ" : "Print Manual"}</span>
          </Button>
        </div>
      </div>

      {/* Manual Header Card */}
      <div className="rounded-2xl border bg-card p-6 sm:p-8 space-y-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {lang === "th" ? "คู่มือการใช้งานระบบ KidCare" : "KidCare User Manual & System Guide"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {lang === "th"
                ? "สรุปทุกฟังก์ชันและความสามารถของระบบสำหรับครอบครัวและการดูแลสุขภาพลูก"
                : "Complete guide and feature documentation for modern child health tracking"}
            </p>
          </div>
        </div>
      </div>

      {/* Manual Content by Language */}
      {lang === "th" ? <ThaiManual /> : <EnglishManual />}
    </div>
  );
}

// ==========================================
// 🇹🇭 THAI MANUAL
// ==========================================
function ThaiManual() {
  return (
    <div className="space-y-6">
      {/* 1. ภาพรวมระบบ */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <ShieldCheck size={20} /> 1. ภาพรวมระบบ (System Overview)
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong>KidCare</strong> คือเว็บแอปพลิเคชัน (Progressive Web App - PWA) สำหรับบันทึกและติดตามสุขภาพเด็กแบบครบวงจร
          ออกแบบมาสำหรับคุณพ่อคุณแม่และครอบครัวไทย เพื่อให้จัดการตารางวัคซีน การแจ้งเตือนนัดหมาย บันทึกไข้และยาลดไข้
          การเจริญเติบโต และการสรุปประวัติส่งต่อแพทย์ได้อย่างปลอดภัย สะดวก และรวดเร็ว
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          <div className="rounded-lg bg-secondary/50 border p-2.5 text-xs text-center">
            <p className="font-bold text-foreground">วัคซีนไทย & เสริม</p>
            <p className="text-muted-foreground text-[11px]">EPI 0-5 ปี & เฉพาะกิจ</p>
          </div>
          <div className="rounded-lg bg-secondary/50 border p-2.5 text-xs text-center">
            <p className="font-bold text-foreground">แจ้งเตือน LINE</p>
            <p className="text-muted-foreground text-[11px]">เตือนล่วงหน้า 7 วัน / 1 วัน</p>
          </div>
          <div className="rounded-lg bg-secondary/50 border p-2.5 text-xs text-center">
            <p className="font-bold text-foreground">ปลอดภัยเรื่องยา</p>
            <p className="text-muted-foreground text-[11px]">การ์ดยาพารา & คำนวณโดส</p>
          </div>
          <div className="rounded-lg bg-secondary/50 border p-2.5 text-xs text-center">
            <p className="font-bold text-foreground">เกณฑ์ สธ. & WHO</p>
            <p className="text-muted-foreground text-[11px]">กราฟน้ำหนัก ส่วนสูง PDF</p>
          </div>
        </div>
      </section>

      {/* 2. ตารางวัคซีน */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <Calendar size={20} /> 2. ตารางวัคซีน & การจัดตาราง (Vaccine Schedule)
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            <strong className="text-foreground">ตารางวัคซีนพื้นฐาน (EPI Thailand)</strong>:
            ระบบสร้างตารางวัคซีนอัตโนมัติจากวันเกิดของลูกตามเกณฑ์กระทรวงสาธารณสุขไทย (แรกเกิด, 2, 4, 6, 9, 18 เดือน, 2 ปีครึ่ง, 4 ปี)
          </li>
          <li>
            <strong className="text-foreground">เพิ่มชุดวัคซีนเสริม / เฉพาะกิจ</strong>:
            รองรับวัคซีนพิษสุนัขบ้า, ไข้หวัดใหญ่, IPD, ตับอักเสบเอ, สุกใส, ส่าไข้ โดยมีวันตั้งต้นและคำนวณวันนัดแต่ละเข็มให้อัตโนมัติ
            พร้อมให้ปรับแก้วันนัดข้ามเดือนหรือเลื่อนนัดได้อิสระ
          </li>
          <li>
            <strong className="text-foreground">การบันทึกการฉีด</strong>:
            แตะที่เข็มเพื่อบันทึกวันที่ฉีดจริง ชื่อ รพ. และบันทึกเพิ่มเติม หรือใช้ปุ่ม <em>"ติ๊กเข็มที่ฉีดแล้ว" (Bulk Given)</em> เพื่ออัปเดตหลายเข็มพร้อมกัน
          </li>
          <li>
            <strong className="text-foreground">สแกนสมุดชมพูด้วย AI (Pink Book OCR)</strong>:
            ถ่ายรูปหน้าบันทึกวัคซีนจากสมุดสีชมพู ให้ AI ช่วยอ่านวันที่และชื่อวัคซีนเพื่อนำเข้าข้อมูลโดยไม่ต้องพิมพ์เอง
          </li>
          <li>
            <strong className="text-foreground">ส่งออกเข้าปฏิทินส่วนตัว</strong>:
            มีปุ่มเพิ่มนัดเข้า <em>Google Calendar</em> หรือดาวน์โหลดไฟล์ <em>.ics</em> ลงโทรศัพท์/คอมพิวเตอร์ได้ทันที
          </li>
        </ul>
      </section>

      {/* 3. การแจ้งเตือน LINE */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <Bell size={20} /> 3. การแจ้งเตือนผ่าน LINE Official Account
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            <strong className="text-foreground">เชื่อมต่อง่ายผ่านเมนูตั้งค่า</strong>:
            แอดไลน์บอทของระบบ นำรหัส 6 หลักที่ได้มากรอกในระบบเพื่อผูกครอบครัวเข้ากับ LINE
          </li>
          <li>
            <strong className="text-foreground">แจ้งเตือนอัตโนมัติ 3 ช่วงเวลา</strong>:
            ล่วงหน้า 7 วัน (เตรียมจัดตารางงาน), ล่วงหน้า 1 วัน (เตรียมตัว), และตอนเช้า 07:00 น. ของวันนัด
          </li>
          <li>
            <strong className="text-foreground">ปุ่มทดสอบส่งข้อความ (Test Notification)</strong>:
            ทดสอบการส่งแจ้งเตือนเข้าห้องแชต LINE ของคุณได้ทันทีเพื่อความมั่นใจ
          </li>
        </ul>
      </section>

      {/* 4. สุขภาพ เจ็บป่วย และความปลอดภัยยาพารา */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <Thermometer size={20} /> 4. ติดตามอาการป่วย & ความปลอดภัยยาลดไข้ (Illness & Fever Guard)
        </h2>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            เมื่อลูกไม่สบาย คุณสามารถบันทึกรอบการป่วยเพื่อเก็บรวบรวมประวัติการรักษาทั้งหมดไว้ในที่เดียว:
          </p>
          <ul className="space-y-2 list-disc list-inside">
            <li>
              <strong className="text-foreground">ปุ่มบันทึกไข้ด่วน (Quick Temp)</strong>:
              วัดไข้และบันทึกอุณหภูมิพร้อมวิธีวัด (หู, รักแร้, หน้าผาก, ทวารหนัก) ได้ใน 5 วินาที
            </li>
            <li>
              <strong className="text-foreground">ระบบเตือนความปลอดภัยยาลดไข้ (Antipyretic Safety Guard)</strong>:
              หากเพิ่งให้ยาพาราไปไม่ถึง 4 ชั่วโมง ระบบจะแสดงแถบสีแดงเตือนอันตรายทันที <em>"ห้ามทานซ้ำ อาจเสี่ยงตับวาย"</em> พร้อมนับถอยหลังเวลาที่ปลอดภัย
            </li>
            <li>
              <strong className="text-foreground">เครื่องคิดเลขคำนวณขนาดยาพารา</strong>:
              คำนวณปริมาณยาพาราเซตามอล (มล. / ช้อนชา) อัตโนมัติตามน้ำหนักตัวของเด็ก (เกณฑ์มาตรฐานแพทย์ 10-15 มก./กก.)
            </li>
            <li>
              <strong className="text-foreground">กราฟแนวโน้มอุณหภูมิ (SVG Fever Curve)</strong>:
              แสดงเส้นกราฟไข้พร้อมสัญลักษณ์การป้อนยา เพื่อดูว่าไข้ลดลงตามเวลาหรือไม่
            </li>
            <li>
              <strong className="text-foreground">บันทึกพบแพทย์ & ยาที่ได้รับ</strong>:
              บันทึกผลวินิจฉัย วันนัดดูอาการ และรายการยา (โดยเฉพาะยาปฏิชีวนะที่ระบบจะขึ้นเตือนให้ทานจนหมด)
            </li>
          </ul>
        </div>
      </section>

      {/* 5. การเจริญเติบโต */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <TrendingUp size={20} /> 5. การติดตามการเจริญเติบโต (Growth Tracking)
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            <strong className="text-foreground">มาตรฐาน สธ.ไทย & องค์การอนามัยโลก (WHO)</strong>:
            ประเมินเกณฑ์แยกเพศชาย/หญิง สำหรับเด็กวัย 0 - 5 ปี
          </li>
          <li>
            <strong className="text-foreground">แปลผลอัตโนมัติ</strong>:
            บอกสถานะชัดเจน เช่น สมส่วน, ค่อนข้างผอม, เริ่มท้วม, สูงตามเกณฑ์, ค่อนข้างเตี้ย
          </li>
          <li>
            <strong className="text-foreground">กราฟการเจริญเติบโต</strong>:
            พล็อตจุดน้ำหนักและส่วนสูงเทียบกับแถบเกณฑ์ปกติ (Percentile P3 ถึง P97)
          </li>
        </ul>
      </section>

      {/* 6. เอกสารสรุปประวัติพบแพทย์ */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <Printer size={20} /> 6. สรุปประวัติพบแพทย์ / พิมพ์รายงาน PDF (Medical Report)
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          มีปุ่ม <strong>"สรุปประวัติ / PDF"</strong> ที่รวบรวมประวัติสุขภาพของเด็กในหน้าเดียว
          พร้อมพิมพ์ออกมาเป็นกระดาษ A4 หรือบันทึกเป็น PDF เพื่อยื่นให้คุณหมอที่คลินิกหรือโรงพยาบาล:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
          <div className="rounded-lg border p-2.5 bg-secondary/30">
            ✓ ข้อมูลประจำตัว, อายุ, กรุ๊ปเลือด, เลข HN
          </div>
          <div className="rounded-lg border p-2.5 bg-secondary/30">
            ✓ ประวัติการแพ้ยาและอาหารพร้อมระดับความรุนแรง
          </div>
          <div className="rounded-lg border p-2.5 bg-secondary/30">
            ✓ สรุปอาการป่วยล่าสุดและยาที่กำลังทาน
          </div>
          <div className="rounded-lg border p-2.5 bg-secondary/30">
            ✓ บันทึกไข้ย้อนหลัง 5 ครั้งล่าสุด & ประวัติวัคซีนครบถ้วน
          </div>
        </div>
      </section>

      {/* 7. ครอบครัวและ PWA */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <Users size={20} /> 7. การแชร์ครอบครัว & ติดตั้งแอป (PWA & Offline)
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            <strong className="text-foreground">แชร์ครอบครัว (Multi-Parent)</strong>:
            เชิญคุณพ่อ คุณแม่ ปู่ย่า หรือพี่เลี้ยง เข้าร่วมครอบครัวเดียวกันผ่านระบบเชิญของ KidCare ทุกคนเห็นข้อมูลตรงกันแบบเรียลไทม์
          </li>
          <li>
            <strong className="text-foreground">ติดตั้งลงหน้าจอหลัก (Install as App)</strong>:
            รองรับ Progressive Web App กด "เพิ่มลงในหน้าจอหลัก" (Add to Home Screen) บน Safari (iOS) หรือ Chrome (Android) เพื่อใช้งานเสมือนแอปจริง
          </li>
          <li>
            <strong className="text-foreground">รองรับการใช้งานออฟไลน์</strong>:
            ดูข้อมูลที่เคยโหลดไว้ได้แม้ไม่มีอินเทอร์เน็ต และระบบจะซิงก์ข้อมูลอัตโนมัติเมื่อต่อเน็ต
          </li>
        </ul>
      </section>
    </div>
  );
}

// ==========================================
// 🇬🇧 ENGLISH MANUAL
// ==========================================
function EnglishManual() {
  return (
    <div className="space-y-6">
      {/* 1. Overview */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <ShieldCheck size={20} /> 1. System Overview
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          <strong>KidCare</strong> is a comprehensive Progressive Web Application (PWA) tailored for child healthcare management.
          Built specifically for modern families, it empowers parents and caregivers to track pediatric vaccinations, receive automated LINE notifications,
          monitor fevers with real-time antipyretic safety guardrails, track growth against official standards, and export doctor-ready medical reports in seconds.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          <div className="rounded-lg bg-secondary/50 border p-2.5 text-xs text-center">
            <p className="font-bold text-foreground">Vaccine Engine</p>
            <p className="text-muted-foreground text-[11px]">EPI 0-5 yrs & Custom Series</p>
          </div>
          <div className="rounded-lg bg-secondary/50 border p-2.5 text-xs text-center">
            <p className="font-bold text-foreground">LINE Reminders</p>
            <p className="text-muted-foreground text-[11px]">7-day, 1-day & Morning alerts</p>
          </div>
          <div className="rounded-lg bg-secondary/50 border p-2.5 text-xs text-center">
            <p className="font-bold text-foreground">Fever Safety Guard</p>
            <p className="text-muted-foreground text-[11px]">&lt;4h paracetamol warning</p>
          </div>
          <div className="rounded-lg bg-secondary/50 border p-2.5 text-xs text-center">
            <p className="font-bold text-foreground">WHO & Thai CDC</p>
            <p className="text-muted-foreground text-[11px]">Growth charts & PDF exports</p>
          </div>
        </div>
      </section>

      {/* 2. Vaccine Schedule */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <Calendar size={20} /> 2. Vaccination Schedule & Management
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            <strong className="text-foreground">Official EPI Schedule (0-5 Years)</strong>:
            Automatically generates a tailored vaccination schedule from the child's date of birth in accordance with Thailand's Ministry of Public Health (MOPH) standards.
          </li>
          <li>
            <strong className="text-foreground">Custom & Supplementary Vaccines</strong>:
            Easily create custom series for Rabies, Influenza, IPD, Hepatitis A, Varicella, and more. Set an intuitive start date with auto-calculated intervals, and freely reschedule individual doses across months.
          </li>
          <li>
            <strong className="text-foreground">Logging Inoculations</strong>:
            Record individual dose administration, hospital name, and batch notes, or utilize the <em>"Mark Given Doses" (Bulk Given)</em> tool to batch-update prior records.
          </li>
          <li>
            <strong className="text-foreground">Pink Book Vision OCR Import</strong>:
            Snap photos of the child's physical maternal & child health record (Pink Book), and AI Vision will extract vaccination dates and names automatically.
          </li>
          <li>
            <strong className="text-foreground">Calendar Integration</strong>:
            Export appointments directly to <em>Google Calendar</em> or download universal <em>.ics</em> calendar files for Apple and Outlook calendars.
          </li>
        </ul>
      </section>

      {/* 3. LINE Reminders */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <Bell size={20} /> 3. Automated LINE Notifications
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            <strong className="text-foreground">Quick Bot Pairing</strong>:
            Add the KidCare LINE Official Account bot, receive a 6-digit connection code, and link your entire family in the Settings page.
          </li>
          <li>
            <strong className="text-foreground">Three-Tier Notification Schedule</strong>:
            Receive alerts 7 days prior (for work scheduling), 1 day prior (for preparation), and at 07:00 AM on appointment day.
          </li>
          <li>
            <strong className="text-foreground">Test Dispatch</strong>:
            Verify bot communication anytime using the "Send Test Notification" button.
          </li>
        </ul>
      </section>

      {/* 4. Illness & Fever Safety Guard */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <Thermometer size={20} /> 4. Illness Tracking & Antipyretic Safety Guard
        </h2>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            When a child falls sick, KidCare bundles fever logs, clinical visits, and prescribed medications in one organized record:
          </p>
          <ul className="space-y-2 list-disc list-inside">
            <li>
              <strong className="text-foreground">5-Second Quick Temp Logging</strong>:
              Record temperature and measurement method (ear, armpit, forehead, rectal) with immediate fever classification.
            </li>
            <li>
              <strong className="text-foreground">Antipyretic Safety Guard</strong>:
              If Paracetamol was administered within the last 4 hours, a prominent warning warns: <em>"Dangerous to re-dose: risk of liver toxicity"</em> along with a live safety countdown.
            </li>
            <li>
              <strong className="text-foreground">Automatic Paracetamol Dosage Calculator</strong>:
              Calculates pediatric syrup dosage (ml and teaspoons) tailored to the child's exact weight (standard 10-15 mg/kg medical guideline).
            </li>
            <li>
              <strong className="text-foreground">SVG Temperature Trend Curve</strong>:
              Visualizes temperature fluctuations with medication markers to verify fever abatement.
            </li>
            <li>
              <strong className="text-foreground">Doctor Visits & Prescriptions</strong>:
              Track clinic visits, diagnoses, follow-up dates, and medications (including mandatory completion alerts for antibiotics).
            </li>
          </ul>
        </div>
      </section>

      {/* 5. Growth Tracking */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <TrendingUp size={20} /> 5. Growth Tracking (WHO & Thai CDC)
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            <strong className="text-foreground">Official Standards</strong>:
            Sex-specific percentile growth benchmarks for boys and girls from birth to 5 years (60 months).
          </li>
          <li>
            <strong className="text-foreground">Automated Evaluation</strong>:
            Immediate classification (Normal, Thin, Overweight, Tall for Age, Stunted, etc.).
          </li>
          <li>
            <strong className="text-foreground">SVG Growth Charts</strong>:
            Plots weight and height curves against official normal percentiles (P3 to P97).
          </li>
        </ul>
      </section>

      {/* 6. Medical Summary Report */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <Printer size={20} /> 6. Doctor Summary Report & PDF Export
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The <strong>"Medical Summary / PDF"</strong> feature consolidates all essential pediatric health records into a clean, A4-formatted medical document:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
          <div className="rounded-lg border p-2.5 bg-secondary/30">
            ✓ Demographics, age, blood group, hospital HN numbers
          </div>
          <div className="rounded-lg border p-2.5 bg-secondary/30">
            ✓ Confirmed drug & food allergies with severity ratings
          </div>
          <div className="rounded-lg border p-2.5 bg-secondary/30">
            ✓ Active illnesses and current medication regimen
          </div>
          <div className="rounded-lg border p-2.5 bg-secondary/30">
            ✓ Recent fever readings & full immunization history
          </div>
        </div>
      </section>

      {/* 7. Family Sharing & PWA */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-3 shadow-xs">
        <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
          <Users size={20} /> 7. Family Sharing & PWA Installation
        </h2>
        <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed list-disc list-inside">
          <li>
            <strong className="text-foreground">Multi-Parent Collaboration</strong>:
            Invite co-parents, grandparents, or babysitters with secure Google authentication. All changes sync in real-time.
          </li>
          <li>
            <strong className="text-foreground">Add to Home Screen (PWA)</strong>:
            Install directly on iOS (Safari) or Android (Chrome) without App Store downloads.
          </li>
          <li>
            <strong className="text-foreground">Offline Resilience</strong>:
            Access cached records even without an active internet connection, with automatic background synchronization upon reconnect.
          </li>
        </ul>
      </section>
    </div>
  );
}
