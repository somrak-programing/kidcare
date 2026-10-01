import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ErrorState from "@/components/ErrorState";
import { useChildren } from "@/hooks/data";
import { useDocument } from "@/hooks/useCollection";
import { useFamilyId } from "@/hooks/useFamilyId";
import { appointmentSchema, firstError } from "@/domain/validation";
import { appointmentsCol } from "@/lib/paths";
import { deleteAppointment, saveAppointment } from "@/lib/repo/appointments";
import type { Appointment } from "@/types";

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

// ปลายทางเมื่อบันทึก/ยกเลิก: หน้าลูกที่เกี่ยวข้อง ไม่มีก็กลับหน้าแรก
const backTo = (cid: string) => (cid ? `/children/${cid}` : "/");

export default function AppointmentForm() {
  const { apptId } = useParams();
  const [sp] = useSearchParams();
  const fid = useFamilyId();
  const nav = useNavigate();
  const uid = useId();
  const { data: children, loading: childrenLoading } = useChildren(fid);
  const { data: existing, loading, error: loadError } = useDocument<Appointment>(
    apptId ? doc(appointmentsCol(fid), apptId) : null,
    `appt/${fid}/${apptId ?? ""}`,
  );

  const [childId, setChildId] = useState(sp.get("child") ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const prefilledId = useRef<string | null>(null);

  useEffect(() => {
    // ?child= ที่ไม่ตรงกับเด็กที่มีอยู่ → ล้างค่า (หลังโหลดเด็กเสร็จเท่านั้น)
    if (childrenLoading || apptId || !childId || children.some((c) => c.id === childId)) return;
    setChildId("");
  }, [children, childrenLoading, childId, apptId]);

  useEffect(() => {
    if (!childId && children.length === 1) setChildId(children[0].id);
  }, [children, childId]);

  useEffect(() => {
    if (!existing || existing.id === prefilledId.current) return;
    prefilledId.current = existing.id;
    setChildId(existing.childId);
    setDate(existing.date);
    setTime(existing.time ?? "");
    setPlace(existing.place);
    setPurpose(existing.purpose);
    setNotes(existing.notes ?? "");
  }, [existing]);

  if (apptId) {
    if (loadError) return <ErrorState error={loadError} />;
    if (loading) return <p className="text-muted-foreground">กำลังโหลด…</p>;
    if (!existing) return <p>ไม่พบข้อมูล</p>;
  }

  function onSave() {
    const r = appointmentSchema.safeParse({ childId, date, time: time || undefined, place, purpose, notes });
    const m = firstError(r);
    if (m || !r.success) return setError(m);
    saveAppointment(fid, { ...r.data, done: existing?.done ?? false }, apptId);
    nav(backTo(r.data.childId), { replace: true });
  }

  const cancelTo = backTo(existing?.childId ?? sp.get("child") ?? "");

  return (
    <form
      className="space-y-4 max-w-xl mx-auto rounded-xl border bg-card p-5 sm:p-6 shadow-xs"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <h1 className="text-xl font-bold">{apptId ? "แก้ไขนัด" : "เพิ่มนัดหมอ"}</h1>
      <div className="space-y-1">
        <Label htmlFor={`${uid}-child`}>ลูก</Label>
        <select id={`${uid}-child`} className={selectCls} value={childId} onChange={(e) => setChildId(e.target.value)}>
          <option value="">เลือก…</option>
          {children.map((c) => <option key={c.id} value={c.id}>{c.nickname || c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${uid}-date`}>วันที่</Label>
          <Input id={`${uid}-date`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${uid}-time`}>เวลา (ถ้ามี)</Label>
          <Input id={`${uid}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${uid}-place`}>สถานที่</Label>
        <Input id={`${uid}-place`} value={place} onChange={(e) => setPlace(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${uid}-purpose`}>เรื่องที่นัด</Label>
        <Input id={`${uid}-purpose`} value={purpose} onChange={(e) => setPurpose(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${uid}-notes`}>หมายเหตุ</Label>
        <Input id={`${uid}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit">บันทึก</Button>
        <Button type="button" variant="ghost" onClick={() => nav(cancelTo)}>ยกเลิก</Button>
        {apptId && (
          <Button
            type="button"
            variant="destructive"
            className="ml-auto"
            onClick={() => {
              if (confirm("ลบนัดนี้?")) {
                deleteAppointment(fid, apptId);
                nav(cancelTo, { replace: true });
              }
            }}
          >
            ลบ
          </Button>
        )}
      </div>
    </form>
  );
}
