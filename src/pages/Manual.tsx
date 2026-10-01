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
  Layers,
  Cpu,
  Database,
  Cloud,
  Network,
  GitBranch,
  ArrowRight,
  Bot,
  Clock,
  FileText,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Manual() {
  const [lang, setLang] = useState<"th" | "en">("th");
  const [tab, setTab] = useState<"features" | "architecture">("features");

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
              {lang === "th" ? "คู่มือและสถาปัตยกรรมระบบ KidCare" : "KidCare Manual & Architecture Guide"}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {lang === "th"
                ? "สรุปทุกฟังก์ชันการทำงาน และแผนภาพสถาปัตยกรรม (Architecture Diagrams) ของแต่ละฟีเจอร์"
                : "Complete feature manual and technical architecture data flow diagrams for each module"}
            </p>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
            tab === "features"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("features")}
        >
          <BookOpen size={16} />
          {lang === "th" ? "📖 คู่มือการใช้งานฟังก์ชัน (User Guide)" : "📖 Features & User Guide"}
        </button>
        <button
          type="button"
          className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-colors ${
            tab === "architecture"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setTab("architecture")}
        >
          <Layers size={16} />
          {lang === "th" ? "🏗️ สถาปัตยกรรมระบบ (Architecture)" : "🏗️ System Architecture"}
        </button>
      </div>

      {/* Content Rendering */}
      {tab === "features" ? (
        lang === "th" ? <ThaiManual /> : <EnglishManual />
      ) : (
        lang === "th" ? <ThaiArchitecture /> : <EnglishArchitecture />
      )}
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

// ==========================================
// 🇹🇭 THAI ARCHITECTURE DIAGRAMS
// ==========================================
function ThaiArchitecture() {
  return (
    <div className="space-y-8">
      {/* High-Level Tier Architecture */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
            <Layers size={20} /> ภาพรวมสถาปัตยกรรมระบบ 4 ระดับ (High-Level 4-Tier Architecture)
          </h2>
          <span className="text-[11px] bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full border border-primary/20">
            Serverless & Spark Tier Compatible
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          KidCare ถูกออกแบบบนสถาปัตยกรรมแบบ Serverless และ Edge Computing โดยแยกส่วนประมวลผล Pure Domain Logic ให้อยู่บนฝั่ง Client และ Edge Worker ทำให้ระบบทำงานได้รวดเร็ว รองรับการใช้งานออฟไลน์ และทำงานได้ฟรีภายใต้ Firebase Spark Tier + Cloudflare Free Tier
        </p>

        {/* 4 Tier Flow Graphic */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          {/* Tier 1: Client */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xs uppercase tracking-wide">
              <Smartphone size={16} /> Tier 1: Frontend (PWA)
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground">React 18 + Vite 5 + Tailwind</p>
              <p>• Zustand State Store</p>
              <p>• Pure Domain Engines (EPI, Dosing, Growth)</p>
              <p>• Offline Cache (IndexedDB)</p>
            </div>
          </div>

          {/* Tier 2: Cloud Database */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wide">
              <Database size={16} /> Tier 2: Cloud Firestore
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground">Google Firebase</p>
              <p>• Firebase Auth (Google OAuth)</p>
              <p>• Cloud Firestore (NoSQL)</p>
              <p>• Granular Security Rules (RBAC)</p>
              <p>• Real-time Snapshot Sync</p>
            </div>
          </div>

          {/* Tier 3: Edge Worker */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wide">
              <Cpu size={16} /> Tier 3: Edge Worker
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground">Cloudflare Workers</p>
              <p>• Daily Cron (07:00 น. UTC+7)</p>
              <p>• GCP Service Account Token Minting</p>
              <p>• Pairing Engine (KV Cache)</p>
              <p>• Secure AI Proxy Endpoint</p>
            </div>
          </div>

          {/* Tier 4: External Services */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-xs uppercase tracking-wide">
              <Network size={16} /> Tier 4: External APIs
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground">LINE & Anthropic AI</p>
              <p>• LINE Messaging API (Push/Webhook)</p>
              <p>• Claude 3.5 Sonnet Vision (OCR)</p>
              <p>• Apple/Google Calendar (RFC 5545)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 1: Vaccine Engine & Calendar Flow */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-primary">
            <Calendar size={18} /> 1. สถาปัตยกรรมระบบตารางวัคซีน & เชื่อมต่อปฏิทินมือถือ (Vaccine Engine & iCal Sync)
          </h2>
          <span className="text-[11px] bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium px-2 py-0.5 rounded border border-sky-500/20">
            Pure Client Logic (EPI Guidelines)
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          การคำนวณวันฉีดวัคซีนทั้งหมดทำงานแบบ Client-side คำนวณแบบ Determinstic ตามเกณฑ์สมาคมโรคติดเชื้อในเด็กแห่งประเทศไทย (EPI) ไม่ต้องพึ่งพาเซิร์ฟเวอร์
        </p>

        {/* Step-by-Step Flow Graphic */}
        <div className="rounded-lg bg-secondary/40 border p-4 space-y-3 font-mono text-xs">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center text-center">
            <div className="p-3 bg-background rounded-lg border shadow-2xs">
              <div className="font-bold text-foreground">1. วันเกิดเด็ก (DOB)</div>
              <div className="text-[10px] text-muted-foreground mt-1">Child Profile</div>
            </div>
            <div className="hidden md:flex justify-center text-muted-foreground"><ArrowRight size={16} /></div>
            <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-700 dark:text-sky-300">
              <div className="font-bold">2. schedule.ts Engine</div>
              <div className="text-[10px] mt-1">คำนวณ 13 ช่วงอายุ (EPI 0-5 ปี)</div>
            </div>
            <div className="hidden md:flex justify-center text-muted-foreground"><ArrowRight size={16} /></div>
            <div className="p-3 bg-background rounded-lg border shadow-2xs">
              <div className="font-bold text-foreground">3. Firestore Overrides</div>
              <div className="text-[10px] text-muted-foreground mt-1">วันที่หมอนัด / สถานะฉีดแล้ว</div>
            </div>
          </div>

          <div className="border-t border-border/60 pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-background rounded-lg border">
              <span className="font-bold text-foreground block mb-1">📅 ช่องทางที่ 1: iCalendar Sync (.ics)</span>
              <p className="text-[11px] text-muted-foreground font-sans">
                แปลงตารางนัดเป็นไฟล์มาตราฐาน RFC 5545 ผ่านโมดูล <code className="text-primary font-mono text-[10px]">ics.ts</code> มีแจ้งเตือนล่วงหน้า 7 วัน และ 1 วัน นำเข้า Google Calendar / Apple Calendar ได้ทันที
              </p>
            </div>
            <div className="p-3 bg-background rounded-lg border">
              <span className="font-bold text-foreground block mb-1">👁️ ช่องทางที่ 2: Interactive SVG Timeline</span>
              <p className="text-[11px] text-muted-foreground font-sans">
                เรนเดอร์พิกัด SVG ตามระยะเวลา (Months) วางหมุดสถานะ เข็มที่ฉีดแล้ว (สีเขียว) และเข็มที่กำลังจะมาถึง (สีส้ม) พร้อม Pillar Stacking ป้องกันจุดทับซ้อน
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: LINE Bot & Cron Flow */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-primary">
            <Bell size={18} /> 2. สถาปัตยกรรมระบบแจ้งเตือน LINE อัตโนมัติ (Daily Cron & Bot Pairing)
          </h2>
          <span className="text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium px-2 py-0.5 rounded border border-amber-500/20">
            Edge Cron + Service Account OAuth
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          ทำงานผ่าน Cloudflare Workers บน Free Tier โดยไม่ต้องเสียค่าบริการ Cloud Functions แบบ Blaze ของ Firebase
        </p>

        {/* Pairing Flow & Cron Flow */}
        <div className="space-y-3 font-mono text-xs">
          <div className="p-4 rounded-lg bg-secondary/40 border space-y-2">
            <span className="font-bold font-sans text-xs text-foreground flex items-center gap-2">
              <Bot size={15} className="text-amber-500" /> ขั้นตอนการจับคู่ LINE (Pairing Workflow):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-[11px] font-sans">
              <div className="p-2 bg-background rounded border">
                <strong>1. ขอรหัส PIN</strong>
                <p className="text-muted-foreground text-[10px] mt-0.5">เว็บเรียก /line/pair/create</p>
              </div>
              <div className="p-2 bg-background rounded border">
                <strong>2. เก็บชั่วคราว</strong>
                <p className="text-muted-foreground text-[10px] mt-0.5">Worker บันทึก KV (TTL 10 นาที)</p>
              </div>
              <div className="p-2 bg-background rounded border">
                <strong>3. ผู้ใช้ส่ง PIN</strong>
                <p className="text-muted-foreground text-[10px] mt-0.5">พิมพ์รหัส 6 หลักในแชท LINE</p>
              </div>
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-700 dark:text-emerald-300">
                <strong>4. ผูกบัญชีสำเร็จ</strong>
                <p className="text-[10px] mt-0.5">Webhook บันทึก lineUserId ลง Firestore</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/40 border space-y-2">
            <span className="font-bold font-sans text-xs text-foreground flex items-center gap-2">
              <Clock size={15} className="text-amber-500" /> ขั้นตอนการรันเตือนรายวัน (Daily Cron Workflow @ 07:00 น.):
            </span>
            <div className="space-y-1.5 font-sans text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="font-mono text-amber-500 font-bold shrink-0">Step 1:</span>
                <span>Cloudflare Scheduled Event ทริกเกอร์ทุก 00:00 UTC (07:00 น. ประเทศไทย)</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-amber-500 font-bold shrink-0">Step 2:</span>
                <span>Worker ใช้ GCP Service Account Private Key เซ็น JWT (RS256) เพื่อรับ Google OAuth2 Access Token</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-amber-500 font-bold shrink-0">Step 3:</span>
                <span>Query ข้อมูลนัดหมายจาก Firestore REST API ค้นหาวัคซีนที่ครบกำหนดในอีก <strong>7 วัน</strong> หรือ <strong>1 วัน</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-emerald-500 font-bold shrink-0">Step 4:</span>
                <span>ส่งข้อความแจ้งเตือนผ่าน <strong>LINE Messaging API</strong> เข้าแชทผู้ปกครองโดยตรง</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3: AI Pink Book Vision Scanner */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-primary">
            <Sparkles size={18} /> 3. สถาปัตยกรรมระบบสแกนสมุดสีชมพูด้วย AI (Claude 3.5 Sonnet Vision OCR)
          </h2>
          <span className="text-[11px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium px-2 py-0.5 rounded border border-purple-500/20">
            Multi-modal Vision AI
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          ดึงข้อมูลประวัติการรับวัคซีนจากภาพถ่ายสมุดบันทึกสุขภาพแม่และเด็ก (เล่มสีชมพู) เข้าสู่ระบบอย่างแม่นยำ แม้เป็นตรายาง รอยหมึก หรือลายมือแพทย์
        </p>

        <div className="rounded-lg bg-secondary/40 border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-3 bg-background rounded-lg border">
              <strong className="text-foreground">1. ถ่ายภาพ / อัปโหลด</strong>
              <p className="text-[11px] text-muted-foreground mt-1">Client บีบอัดภาพ & แปลงเป็น Base64</p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-300">
              <strong className="text-foreground">2. Edge Proxy</strong>
              <p className="text-[11px] mt-1">Worker ซ่อน Anthropic API Key ป้องกันรั่วไหล</p>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-700 dark:text-purple-300">
              <strong className="text-foreground">3. Claude 3.5 Sonnet</strong>
              <p className="text-[11px] mt-1">วิเคราะห์ตารางวัคซีนไทย & สกัดเป็น JSON</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-700 dark:text-emerald-300">
              <strong className="text-foreground">4. ตรวจสอบ & บันทึก</strong>
              <p className="text-[11px] mt-1">ผู้ปกครองตรวจความถูกต้องแล้วบันทึกลง Firestore</p>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground bg-background/80 p-2.5 rounded border">
            🔒 <strong>ความปลอดภัย:</strong> API Key ของ Anthropic ถูกเก็บเป็น Secret บน Cloudflare Environment เท่านั้น Client ไม่มีสิทธิ์เข้าถึง Secret Key โดยตรง
          </div>
        </div>
      </section>

      {/* Feature 4: Fever Tracker & Paracetamol Guard */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-primary">
            <Thermometer size={18} /> 4. สถาปัตยกรรมระบบตรวจวัดไข้ & การ์ดความปลอดภัยยาพารา (Fever & Paracetamol Engine)
          </h2>
          <span className="text-[11px] bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium px-2 py-0.5 rounded border border-rose-500/20">
            Safety Guard Algorithm
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          ป้องกันอันตรายจากการให้ยาซ้ำซ้อนหรือยาเกินขนาดในเด็กเล็ก คำนวณตามน้ำหนักตัวจริงและระยะเวลาห่างขั้นต่ำ
        </p>

        <div className="rounded-lg bg-secondary/40 border p-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-background rounded-lg border space-y-1.5">
              <span className="font-bold text-rose-600 dark:text-rose-400 block">⚠️ Paracetamol Safety Interval Guard:</span>
              <p className="text-muted-foreground leading-relaxed">
                ทุกครั้งที่มีการบันทึกการให้ยาพารา ระบบจะตรวจหาบันทึกล่าสุด หากเวลาผ่านไปยังไม่ถึง <strong>4 ชั่วโมง</strong> ระบบจะแสดงการแจ้งเตือนสีแดงทันที พร้อมคำนวณเวลาที่ปลอดภัยที่สุดสำหรับเข็มถัดไป
              </p>
            </div>
            <div className="p-3 bg-background rounded-lg border space-y-1.5">
              <span className="font-bold text-primary block">⚖️ Pediatric Dosage Formula:</span>
              <p className="text-muted-foreground leading-relaxed">
                คำนวณโดสยามาตรฐานกุมารแพทย์: <code className="bg-secondary px-1 py-0.5 rounded text-foreground font-mono">10-15 mg/kg</code> ต่อน้ำหนักตัวเด็ก พร้อมแปลงเป็นปริมาตรซีซี (ml) สำหรับยาน้ำเชื่อมทั้งสูตร 120mg/5ml และสูตรเข้มข้น 250mg/5ml
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 5: WHO & Thai Growth Tracking */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-primary">
            <TrendingUp size={18} /> 5. สถาปัตยกรรมระบบกราฟและเกณฑ์การเจริญเติบโต (Growth Evaluation Engine)
          </h2>
          <span className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded border border-emerald-500/20">
            WHO & Thai CDC Standard Tables
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          ประเมินภาวะโภชนาการและการเจริญเติบโตผ่านตารางมาตรฐานของกรมอนามัย กระทรวงสาธารณสุข และองค์การอนามัยโลก (WHO)
        </p>

        <div className="rounded-lg bg-secondary/40 border p-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
            <div className="p-2.5 bg-background rounded border">
              <strong className="text-foreground">น้ำหนักตามเกณฑ์อายุ</strong>
              <p className="text-muted-foreground text-[11px] mt-0.5">Weight-for-Age (P3 - P97)</p>
            </div>
            <div className="p-2.5 bg-background rounded border">
              <strong className="text-foreground">ส่วนสูงตามเกณฑ์อายุ</strong>
              <p className="text-muted-foreground text-[11px] mt-0.5">Height-for-Age (P3 - P97)</p>
            </div>
            <div className="p-2.5 bg-background rounded border">
              <strong className="text-foreground">น้ำหนักตามเกณฑ์ส่วนสูง</strong>
              <p className="text-muted-foreground text-[11px] mt-0.5">Weight-for-Height (ประเมินผอม/ท้วม)</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            โมดูล <code className="text-primary font-mono text-[10px]">growth.ts</code> ทำการค้นหาตำแหน่งเปอร์เซ็นไทล์ด้วย Linear Interpolation เทียบกับเพศและอายุที่แน่นอนของเด็ก แล้วพล็อตจุดและเส้นกราฟ SVG แบบเรียลไทม์
          </p>
        </div>
      </section>

      {/* Feature 6: Medical Summary & Local PDF Generator */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-primary">
            <Printer size={18} /> 6. สถาปัตยกรรมสรุปประวัติสุขภาพเด็ก & PDF (Medical Summary Engine)
          </h2>
          <span className="text-[11px] bg-slate-500/10 text-slate-700 dark:text-slate-300 font-medium px-2 py-0.5 rounded border border-slate-500/20">
            Client-Side Zero-Leakage Architecture
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          สร้างเอกสารรายงานทางการแพทย์ขนาด A4 ที่สมบูรณ์แบบเพื่อยื่นให้กุมารแพทย์ดูได้ทันที
        </p>

        <div className="rounded-lg bg-secondary/40 border p-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="p-3 bg-background rounded border space-y-1">
              <strong className="text-foreground block">1. Local Aggregation</strong>
              <p className="text-muted-foreground text-[11px]">รวบรวมประวัติการแพ้ยา ประวัติวัคซีน ไข้ และอาการเจ็บป่วยจากหน่วยความจำฝั่ง Client</p>
            </div>
            <div className="p-3 bg-background rounded border space-y-1">
              <strong className="text-foreground block">2. Print-Optimized CSS</strong>
              <p className="text-muted-foreground text-[11px]">ใช้คำสั่ง <code className="text-primary font-mono text-[10px]">@media print</code> จัดสเกลหน้า A4 ตัดเมนูและแถบควบคุมออกโดยอัตโนมัติ</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-700 dark:text-emerald-300 space-y-1">
              <strong className="block">3. 100% Privacy & Zero Leak</strong>
              <p className="text-[11px]">สั่งพิมพ์หรือบันทึก PDF จากเบราว์เซอร์โดยตรง ไม่มีการส่งข้อมูลประวัติผู้ป่วยไปแปลงบนเซิร์ฟเวอร์ภายนอก</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ==========================================
// 🇬🇧 ENGLISH ARCHITECTURE DIAGRAMS
// ==========================================
function EnglishArchitecture() {
  return (
    <div className="space-y-8">
      {/* High-Level Tier Architecture */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2 text-primary">
            <Layers size={20} /> High-Level 4-Tier Architecture Overview
          </h2>
          <span className="text-[11px] bg-primary/10 text-primary font-semibold px-2.5 py-0.5 rounded-full border border-primary/20">
            Serverless & Free Tier Optimized
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          KidCare is built on a serverless, decoupled architecture. Computational domain logic lives on the client PWA and edge workers, enabling lightning-fast responsiveness, offline resilience, and zero fixed server operating costs.
        </p>

        {/* 4 Tier Flow Graphic */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          {/* Tier 1: Client */}
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-bold text-xs uppercase tracking-wide">
              <Smartphone size={16} /> Tier 1: Client PWA
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground">React 18 + Vite 5 + Tailwind</p>
              <p>• Zustand State Management</p>
              <p>• Pure Domain Engines (EPI, Dosing)</p>
              <p>• Offline Storage (IndexedDB)</p>
            </div>
          </div>

          {/* Tier 2: Cloud Database */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wide">
              <Database size={16} /> Tier 2: Cloud Firestore
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground">Google Firebase</p>
              <p>• Firebase Auth (Google OAuth)</p>
              <p>• Cloud Firestore (NoSQL)</p>
              <p>• Granular Security Rules (RBAC)</p>
              <p>• Real-time Snapshot Listeners</p>
            </div>
          </div>

          {/* Tier 3: Edge Worker */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-wide">
              <Cpu size={16} /> Tier 3: Edge Worker
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground">Cloudflare Workers</p>
              <p>• Daily Cron (07:00 AM UTC+7)</p>
              <p>• GCP Service Account Token Minting</p>
              <p>• LINE Bot Pairing (KV Storage)</p>
              <p>• Secure AI Proxy Endpoint</p>
            </div>
          </div>

          {/* Tier 4: External Services */}
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-xs uppercase tracking-wide">
              <Network size={16} /> Tier 4: External APIs
            </div>
            <div className="text-xs space-y-1 text-muted-foreground">
              <p className="font-semibold text-foreground">LINE & Anthropic AI</p>
              <p>• LINE Messaging API (Push/Webhook)</p>
              <p>• Claude 3.5 Sonnet Vision (OCR)</p>
              <p>• Native Calendar (RFC 5545 iCal)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 1: Vaccine Engine & Calendar Flow */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-primary">
            <Calendar size={18} /> 1. Vaccine Engine & Native Calendar Sync Architecture
          </h2>
          <span className="text-[11px] bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium px-2 py-0.5 rounded border border-sky-500/20">
            Pure Client Engine
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Vaccine schedules are calculated purely on the client side according to Thai Pediatric Society (EPI) guidelines without relying on external computation.
        </p>

        <div className="rounded-lg bg-secondary/40 border p-4 space-y-3 font-mono text-xs">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center text-center">
            <div className="p-3 bg-background rounded-lg border shadow-2xs">
              <div className="font-bold text-foreground">1. Child Birthdate</div>
              <div className="text-[10px] text-muted-foreground mt-1">Child Profile DOB</div>
            </div>
            <div className="hidden md:flex justify-center text-muted-foreground"><ArrowRight size={16} /></div>
            <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-lg text-sky-700 dark:text-sky-300">
              <div className="font-bold">2. schedule.ts Engine</div>
              <div className="text-[10px] mt-1">Calculates 13 EPI Milestones</div>
            </div>
            <div className="hidden md:flex justify-center text-muted-foreground"><ArrowRight size={16} /></div>
            <div className="p-3 bg-background rounded-lg border shadow-2xs">
              <div className="font-bold text-foreground">3. Firestore Overrides</div>
              <div className="text-[10px] text-muted-foreground mt-1">Custom Clinic Dates / Done</div>
            </div>
          </div>

          <div className="border-t border-border/60 pt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-background rounded-lg border">
              <span className="font-bold text-foreground block mb-1">📅 Flow A: RFC 5545 iCalendar Sync</span>
              <p className="text-[11px] text-muted-foreground font-sans">
                Generates standards-compliant <code className="text-primary font-mono text-[10px]">.ics</code> files with dual alarms (7-day & 1-day reminders) for Apple Calendar & Google Calendar.
              </p>
            </div>
            <div className="p-3 bg-background rounded-lg border">
              <span className="font-bold text-foreground block mb-1">👁️ Flow B: Responsive SVG Timeline</span>
              <p className="text-[11px] text-muted-foreground font-sans">
                Draws dynamic SVG coordinates with smart pillar stacking to prevent marker overlap across dense vaccination milestones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: LINE Bot & Cron Flow */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-primary">
            <Bell size={18} /> 2. Automated LINE Notification Bot & Edge Cron Engine
          </h2>
          <span className="text-[11px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium px-2 py-0.5 rounded border border-amber-500/20">
            Edge Serverless (Zero Cloud Function Costs)
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Daily cron runs on Cloudflare Workers edge network without incurring Firebase Blaze billing tiers.
        </p>

        <div className="space-y-3 font-mono text-xs">
          <div className="p-4 rounded-lg bg-secondary/40 border space-y-2">
            <span className="font-bold font-sans text-xs text-foreground flex items-center gap-2">
              <Bot size={15} className="text-amber-500" /> Pairing Workflow (OTP Verification):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-[11px] font-sans">
              <div className="p-2 bg-background rounded border">
                <strong>1. Request PIN</strong>
                <p className="text-muted-foreground text-[10px] mt-0.5">App calls /line/pair/create</p>
              </div>
              <div className="p-2 bg-background rounded border">
                <strong>2. KV Cache</strong>
                <p className="text-muted-foreground text-[10px] mt-0.5">Worker stores OTP (10m TTL)</p>
              </div>
              <div className="p-2 bg-background rounded border">
                <strong>3. Enter in LINE</strong>
                <p className="text-muted-foreground text-[10px] mt-0.5">User types 6 digits to bot</p>
              </div>
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-700 dark:text-emerald-300">
                <strong>4. Account Linked</strong>
                <p className="text-[10px] mt-0.5">Webhook saves lineUserId to Firestore</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/40 border space-y-2">
            <span className="font-bold font-sans text-xs text-foreground flex items-center gap-2">
              <Clock size={15} className="text-amber-500" /> Daily Cron Dispatch Workflow (07:00 AM Bangkok):
            </span>
            <div className="space-y-1.5 font-sans text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="font-mono text-amber-500 font-bold shrink-0">Step 1:</span>
                <span>Cloudflare Scheduled Event triggers daily at 00:00 UTC (07:00 AM UTC+7).</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-amber-500 font-bold shrink-0">Step 2:</span>
                <span>Worker mints Google OAuth2 token using GCP Service Account RS256 private key.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-amber-500 font-bold shrink-0">Step 3:</span>
                <span>Queries Firestore REST API for upcoming vaccine doses due in exactly 7 days or 1 day.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-emerald-500 font-bold shrink-0">Step 4:</span>
                <span>Dispatches formatted LINE push notification directly to the parent's phone.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3: AI Pink Book Vision Scanner */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-primary">
            <Sparkles size={18} /> 3. AI Pink Book Vision OCR Scanner Architecture
          </h2>
          <span className="text-[11px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium px-2 py-0.5 rounded border border-purple-500/20">
            Anthropic Claude 3.5 Sonnet Vision
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Extracts tabular immunization records from photos of the Thai Maternal & Child Health Handbook ("สมุดสีชมพู"), accurately parsing Thai doctor handwriting and hospital stamps.
        </p>

        <div className="rounded-lg bg-secondary/40 border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="p-3 bg-background rounded-lg border">
              <strong className="text-foreground">1. Photo Capture</strong>
              <p className="text-[11px] text-muted-foreground mt-1">Client downscales & Base64 encodes</p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-700 dark:text-amber-300">
              <strong className="text-foreground">2. Edge Proxy</strong>
              <p className="text-[11px] mt-1">Worker protects Anthropic API secret key</p>
            </div>
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-700 dark:text-purple-300">
              <strong className="text-foreground">3. Claude 3.5 Sonnet</strong>
              <p className="text-[11px] mt-1">Vision OCR parses tables to structured JSON</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-700 dark:text-emerald-300">
              <strong className="text-foreground">4. Verification & Save</strong>
              <p className="text-[11px] mt-1">Parent reviews and commits data to Firestore</p>
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground bg-background/80 p-2.5 rounded border">
            🔒 <strong>Security Architecture:</strong> The Anthropic API key is strictly maintained as a Cloudflare Worker secret. Clients cannot access third-party credentials.
          </div>
        </div>
      </section>

      {/* Feature 4: Fever Tracker & Paracetamol Guard */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-primary">
            <Thermometer size={18} /> 4. Fever Tracker & Paracetamol Safety Guard Architecture
          </h2>
          <span className="text-[11px] bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium px-2 py-0.5 rounded border border-rose-500/20">
            Safety Guard Algorithm
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Prevents accidental pediatric medication toxicity and dosing errors with automated safety guards and weight-based dose calculations.
        </p>

        <div className="rounded-lg bg-secondary/40 border p-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-background rounded-lg border space-y-1.5">
              <span className="font-bold text-rose-600 dark:text-rose-400 block">⚠️ 4-Hour Minimum Interval Guard:</span>
              <p className="text-muted-foreground leading-relaxed">
                When logging Paracetamol, the engine validates the elapsed time against previous logs. If under <strong>4 hours</strong>, an immediate safety warning alerts parents and displays the earliest safe time.
              </p>
            </div>
            <div className="p-3 bg-background rounded-lg border space-y-1.5">
              <span className="font-bold text-primary block">⚖️ Weight-Based Pediatric Dosing:</span>
              <p className="text-muted-foreground leading-relaxed">
                Computes optimal dosage using pediatric standard <code className="bg-secondary px-1 py-0.5 rounded text-foreground font-mono">10-15 mg/kg</code>, converting into exact ml liquid volume for both 120mg/5ml and 250mg/5ml suspension syrups.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 5: WHO & Thai Growth Tracking */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-primary">
            <TrendingUp size={18} /> 5. Growth Evaluation Engine & Charting Architecture
          </h2>
          <span className="text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded border border-emerald-500/20">
            WHO & Thai CDC Standard Tables
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Instant nutritional and somatic assessment referencing Department of Health (MOPH) and WHO growth reference datasets.
        </p>

        <div className="rounded-lg bg-secondary/40 border p-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
            <div className="p-2.5 bg-background rounded border">
              <strong className="text-foreground">Weight-for-Age</strong>
              <p className="text-muted-foreground text-[11px] mt-0.5">P3 to P97 Percentiles</p>
            </div>
            <div className="p-2.5 bg-background rounded border">
              <strong className="text-foreground">Height-for-Age</strong>
              <p className="text-muted-foreground text-[11px] mt-0.5">Stunting & Growth Velocity</p>
            </div>
            <div className="p-2.5 bg-background rounded border">
              <strong className="text-foreground">Weight-for-Height</strong>
              <p className="text-muted-foreground text-[11px] mt-0.5">Wasting / Overweight Detection</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The <code className="text-primary font-mono text-[10px]">growth.ts</code> engine utilizes linear interpolation to map exact child age and gender to percentile curves, generating responsive vector SVG plots.
          </p>
        </div>
      </section>

      {/* Feature 6: Medical Summary & Local PDF Generator */}
      <section className="rounded-xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2 text-primary">
            <Printer size={18} /> 6. Doctor Medical Summary & Local PDF Generation Architecture
          </h2>
          <span className="text-[11px] bg-slate-500/10 text-slate-700 dark:text-slate-300 font-medium px-2 py-0.5 rounded border border-slate-500/20">
            Zero-Leakage Local Processing
          </span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Aggregates full pediatric history into a clean A4 hospital-ready format for clinical consultations.
        </p>

        <div className="rounded-lg bg-secondary/40 border p-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="p-3 bg-background rounded border space-y-1">
              <strong className="text-foreground block">1. Local Aggregation</strong>
              <p className="text-muted-foreground text-[11px]">Assembles drug allergies, immunizations, and fever logs entirely from in-memory client state.</p>
            </div>
            <div className="p-3 bg-background rounded border space-y-1">
              <strong className="text-foreground block">2. Print CSS Rules</strong>
              <p className="text-muted-foreground text-[11px]">Tailored <code className="text-primary font-mono text-[10px]">@media print</code> styles strip navigation controls and fit standard A4 paper dimensions.</p>
            </div>
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-emerald-700 dark:text-emerald-300 space-y-1">
              <strong className="block">3. 100% Privacy Guard</strong>
              <p className="text-[11px]">Native browser PDF rendering means zero patient health data leaves the user's device for document compilation.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

