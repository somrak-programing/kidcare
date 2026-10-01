import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ErrorState from "@/components/ErrorState";
import { useChild, useDoses } from "@/hooks/data";
import { useFamilyId } from "@/hooks/useFamilyId";
import { formatThaiDate, todayISO } from "@/domain/dates";
import { findDuplicateTargets, matchImportedDoses, rowWarnings, type ImportRow } from "@/domain/importMatch";
import { callExtract, ExtractAbortedError, ExtractClientError } from "@/lib/extractClient";
import { resizeToJpegBase64 } from "@/lib/resizeImage";
import { saveImport } from "@/lib/repo/vaccines";
import type { VaccineDose } from "@/types";

const MAX_FILES = 6;
const READ_FILE_ERROR = "อ่านไฟล์รูปไม่ได้ ลองถ่ายใหม่ หรือใช้รูปแบบ JPEG/PNG";
const GENERIC_ERROR = "เกิดข้อผิดพลาด ลองอีกครั้ง";
const READING_STATUS = "กำลังอ่านรูปด้วย AI อาจใช้เวลาเกือบนาที";

/** Thrown only when resizing/decoding one of the picked files fails. */
class ResizeError extends Error {}
const selectCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

type Patch = { target?: string; include?: boolean; dateGiven?: string | null; lotNo?: string | null; place?: string | null };

function doseLabel(doses: VaccineDose[], id: string) {
  const d = doses.find((x) => x.id === id);
  return d ? `${d.vaccineName} เข็ม ${d.doseNo}${d.given ? " (บันทึกแล้ว)" : ""}` : id;
}

function ReviewRow({ row: r, doses, duplicate, preview, onChange }: {
  row: ImportRow;
  doses: VaccineDose[];
  duplicate: boolean;
  preview: string | undefined;
  onChange: (patch: Patch) => void;
}) {
  const uid = useId();
  const warn = r.warnings.length > 0 || duplicate;
  const sameCode = doses.filter((d) => d.vaccineCode === r.record.vaccineCode);
  const others = doses.filter((d) => d.vaccineCode !== r.record.vaccineCode);
  const notes = [...r.warnings, ...(duplicate ? ["เลือกเข็มนี้ซ้ำกับแถวอื่น"] : []), ...(r.record.note ? [`AI: ${r.record.note}`] : [])];
  return (
    <div className={`space-y-2 rounded-lg border p-3 text-sm ${warn ? "border-amber-500 bg-amber-500/10" : ""}`}>
      <div className="flex items-start gap-3">
        <input id={`${uid}-inc`} type="checkbox" className="mt-1" checked={r.include} onChange={(e) => onChange({ include: e.target.checked })} />
        <div className="flex-1">
          <label htmlFor={`${uid}-inc`} className="block cursor-pointer font-semibold">
            {r.record.vaccineRaw} {r.record.doseNo ? `เข็ม ${r.record.doseNo}` : ""}
            <span className="sr-only"> (เลือกบันทึกแถวนี้)</span>
          </label>
          <p className="text-xs text-muted-foreground">
            หน้า {r.record.pageIndex + 1} · ในสมุด: {r.record.dateRaw ?? "—"}
            {r.record.dateGiven ? ` → ${formatThaiDate(r.record.dateGiven)}` : ""}
          </p>
        </div>
        {preview && (
          <a href={preview} target="_blank" rel="noreferrer" aria-label={`เปิดรูปหน้า ${r.record.pageIndex + 1}`}>
            <img src={preview} alt="" className="h-12 w-9 rounded object-cover" />
          </a>
        )}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${uid}-target`} className="text-xs">บันทึกลงที่</Label>
        <select id={`${uid}-target`} className={selectCls} value={r.target} onChange={(e) => onChange({ target: e.target.value })}>
          <option value="new">สร้างเป็นชุดใหม่</option>
          {sameCode.map((d) => <option key={d.id} value={d.id}>{doseLabel(doses, d.id)}</option>)}
          {others.length > 0 && (
            <optgroup label="วัคซีนอื่น">
              {others.map((d) => <option key={d.id} value={d.id}>{doseLabel(doses, d.id)}</option>)}
            </optgroup>
          )}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label htmlFor={`${uid}-date`} className="text-xs">วันที่ฉีด</Label>
          <Input id={`${uid}-date`} type="date" className="h-9" value={r.record.dateGiven ?? ""} onChange={(e) => onChange({ dateGiven: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${uid}-lot`} className="text-xs">Lot</Label>
          <Input id={`${uid}-lot`} className="h-9" value={r.record.lotNo ?? ""} onChange={(e) => onChange({ lotNo: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${uid}-place`} className="text-xs">สถานที่</Label>
          <Input id={`${uid}-place`} className="h-9" value={r.record.place ?? ""} onChange={(e) => onChange({ place: e.target.value || null })} />
        </div>
      </div>
      {notes.length > 0 && (
        <ul className={`text-xs ${warn ? "text-amber-300" : "text-muted-foreground"}`}>
          {warn && <li className="font-semibold">ควรตรวจแถวนี้</li>}
          {notes.map((w) => <li key={w}>• {w}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function ImportPinkBook() {
  const { id: cid = "" } = useParams();
  const fid = useFamilyId();
  const nav = useNavigate();
  const { data: child, error } = useChild(fid, cid);
  const { data: doses, loading: dosesLoading, error: dosesError } = useDoses(fid, cid);
  const fileId = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<"pick" | "reading" | "review">("pick");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const today = todayISO();
  const mounted = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const dups = findDuplicateTargets(rows);

  if (error) return <ErrorState error={error} />;
  if (!child) return <p className="text-muted-foreground">กำลังโหลด…</p>;

  async function onRead() {
    if (!child || dosesError) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setMsg(null);
    setPhase("reading");
    try {
      // sequential: decoding several full-size photos at once can exhaust memory on phones
      const images: Awaited<ReturnType<typeof resizeToJpegBase64>>[] = [];
      for (const [i, f] of files.entries()) {
        try {
          images.push(await resizeToJpegBase64(f));
        } catch {
          throw new ResizeError(`รูปที่ ${i + 1}: ${READ_FILE_ERROR}`);
        }
        if (ctrl.signal.aborted) return;
      }
      const records = await callExtract(images, child.birthDate, ctrl.signal);
      if (!mounted.current || ctrl.signal.aborted) return;
      setRows(matchImportedDoses(records, doses, child.birthDate, today));
      setPhase("review");
    } catch (e) {
      if (!mounted.current || ctrl.signal.aborted || e instanceof ExtractAbortedError) return;
      setMsg(e instanceof ResizeError || e instanceof ExtractClientError ? e.message : GENERIC_ERROR);
      setPhase("pick");
    }
  }

  function update(key: string, patch: Patch) {
    if (!child) return;
    setRows((rs) =>
      rs.map((r) => {
        if (r.key !== key) return r;
        const record = {
          ...r.record,
          ...("dateGiven" in patch ? { dateGiven: patch.dateGiven ?? null } : {}),
          ...("lotNo" in patch ? { lotNo: patch.lotNo ?? null } : {}),
          ...("place" in patch ? { place: patch.place ?? null } : {}),
        };
        const target = patch.target ?? r.target;
        return { ...r, record, target, include: patch.include ?? r.include, warnings: rowWarnings(record, target, doses, child.birthDate, today) };
      }),
    );
  }

  function onSave() {
    const chosen = rows.filter((r) => r.include);
    saveImport(fid, cid, chosen.map((r) => ({
      target: r.target,
      record: r.record,
      overwrite: doses.find((d) => d.id === r.target)?.given === true,
    })));
    nav(`/children/${cid}`);
  }

  const chosenCount = rows.filter((r) => r.include).length;

  return (
    <div className="space-y-5 max-w-3xl mx-auto rounded-xl border bg-card p-5 sm:p-6 shadow-xs">
      <div className="border-b pb-3">
        <Link to={`/children/${cid}`} className="text-xs text-muted-foreground hover:text-foreground">
          ← กลับหน้า {child.nickname || child.name}
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-1">นำเข้าวัคซีนจากสมุดชมพู</h1>
      </div>
      <p role="status" aria-live="polite" className={phase === "reading" ? "sr-only" : "text-sm text-muted-foreground"}>
        {phase === "reading" ? READING_STATUS : phase === "pick" ? note : null}
      </p>

      {phase !== "review" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">ถ่ายรูปหน้าบันทึกวัคซีนให้ชัด เห็นวันที่ครบ ได้สูงสุด {MAX_FILES} รูป รูปจะถูกส่งไปให้ AI อ่านแล้วทิ้ง ไม่ถูกเก็บไว้</p>
          <input id={fileId} type="file" accept="image/*" multiple className="peer sr-only" disabled={phase === "reading"}
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              setNote(picked.length > MAX_FILES ? `เลือกได้สูงสุด ${MAX_FILES} รูป — ใช้ ${MAX_FILES} รูปแรก` : null);
              setFiles(picked.slice(0, MAX_FILES));
              e.target.value = ""; // allow re-selecting the same file
            }} />
          <Label htmlFor={fileId} className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
            <Camera size={18} /> เลือก/ถ่ายรูป
          </Label>
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {previews.map((u, i) => <img key={u} src={u} alt={`หน้า ${i + 1}`} className="aspect-[3/4] w-full rounded object-cover" />)}
            </div>
          )}
          {msg && <p role="alert" className="text-sm text-destructive">{msg}</p>}
          {dosesError && <ErrorState error={dosesError} />}
          {dosesLoading && !dosesError && <p className="text-sm text-muted-foreground">กำลังโหลดข้อมูลวัคซีน…</p>}
          <Button type="button" className="w-full" disabled={!files.length || phase === "reading" || dosesLoading || !!dosesError} onClick={onRead}>
            {phase === "reading" ? <><Loader2 size={16} className="animate-spin" /> กำลังอ่าน… (อาจใช้เวลาเกือบนาที)</> : "อ่านด้วย AI"}
          </Button>
        </div>
      )}

      {phase === "review" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">ตรวจกับสมุดทีละแถว แก้ได้ทุกช่อง แถวที่มีกรอบเหลืองและข้อความ "ควรตรวจแถวนี้" ควรดูให้ละเอียด</p>
          {rows.length === 0 && <p>ไม่พบรายการวัคซีนในรูป</p>}
          {rows.map((r) => (
            <ReviewRow key={r.key} row={r} doses={doses} duplicate={r.include && dups.has(r.target)}
              preview={previews[r.record.pageIndex]} onChange={(p) => update(r.key, p)} />
          ))}
          {dups.size > 0 && <p role="alert" className="text-sm text-destructive">มีหลายแถวเลือกเข็มเดียวกัน แก้ให้ไม่ซ้ำก่อนบันทึก</p>}
          <div className="flex gap-2">
            <Button type="button" disabled={dups.size > 0 || chosenCount === 0} onClick={onSave}>
              บันทึก {chosenCount} รายการ
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setRows([]); setPhase("pick"); }}>อ่านใหม่</Button>
          </div>
          <p className="text-xs text-muted-foreground">ถ้าอ่านไม่ได้ ยังใช้ "ติ๊กเข็มที่ฉีดแล้ว" ในหน้าลูกได้เสมอ</p>
        </div>
      )}
    </div>
  );
}
