import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query, where, type FirestoreError } from "firebase/firestore";
import type { Allergy, Appointment, Child, VaccineDose, VaccineSeries } from "@/types";
import { appointmentsCol, childDoc, childSub, childrenCol } from "@/lib/paths";
import { useCollection, useDocument } from "./useCollection";

export function useChildren(fid: string) {
  return useCollection<Child>(query(childrenCol(fid), orderBy("birthDate")), `children/${fid}`);
}

export function useChild(fid: string, cid: string | null) {
  return useDocument<Child>(cid ? childDoc(fid, cid) : null, `child/${fid}/${cid ?? "-"}`);
}

export function useAllergies(fid: string, cid: string) {
  return useCollection<Allergy>(childSub(fid, cid, "allergies"), `allergies/${fid}/${cid}`);
}

export function useSeries(fid: string, cid: string | null) {
  return useCollection<VaccineSeries>(cid ? childSub(fid, cid, "vaccineSeries") : null, `series/${fid}/${cid ?? "-"}`);
}

export function useDoses(fid: string, cid: string | null) {
  const r = useCollection<VaccineDose>(cid ? childSub(fid, cid, "vaccineDoses") : null, `doses/${fid}/${cid ?? "-"}`);
  const data = useMemo(() => [...r.data].sort((a, b) => a.doseNo - b.doseNo), [r.data]);
  return { ...r, data };
}

export function useOpenAppointments(fid: string) {
  return useCollection<Appointment>(query(appointmentsCol(fid), where("done", "==", false)), `appts/${fid}`);
}

/** เข็มวัคซีนทั้งหมดของลูกทุกคน (query ต่อเด็ก 1 คน) */
export function useFamilyDoses(fid: string, childIds: string[]) {
  const key = childIds.join(",");
  const [byChild, setByChild] = useState<Record<string, VaccineDose[]>>({});
  const [error, setError] = useState<FirestoreError | null>(null);
  const [settled, setSettled] = useState<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() });
  useEffect(() => {
    setByChild({});
    setError(null);
    setSettled({ key, ids: new Set() });
    const markSettled = (cid: string) =>
      setSettled((s) => (s.key !== key || s.ids.has(cid) ? s : { key, ids: new Set(s.ids).add(cid) }));
    const unsubs = childIds.map((cid) =>
      onSnapshot(
        childSub(fid, cid, "vaccineDoses"),
        (snap) => {
          setError(null);
          setByChild((m) => ({ ...m, [cid]: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VaccineDose) }));
          markSettled(cid);
        },
        (e) => {
          setError(e);
          markSettled(cid);
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid, key]);
  const data = useMemo(() => Object.values(byChild).flat(), [byChild]);
  // loading = ยังมีเด็กบางคนที่ snapshot แรกยังไม่มา (settled ของชุดเด็กก่อนหน้า key ไม่ตรงจึงไม่นับ)
  const loading = childIds.length > 0 && (settled.key !== key || childIds.some((cid) => !settled.ids.has(cid)));
  return { data, error, loading };
}
