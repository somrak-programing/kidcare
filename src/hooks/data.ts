import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query, where, type FirestoreError } from "firebase/firestore";
import type { Allergy, Appointment, Child, VaccineDose, VaccineSeries } from "@/types";
import { appointmentsCol, childDoc, childSub, childrenCol } from "@/lib/paths";
import { useCollection, useDocument } from "./useCollection";

export function useChildren(fid: string) {
  return useCollection<Child>(query(childrenCol(fid), orderBy("birthDate")), `children/${fid}`);
}

export function useChild(fid: string, cid: string) {
  return useDocument<Child>(childDoc(fid, cid), `child/${fid}/${cid}`);
}

export function useAllergies(fid: string, cid: string) {
  return useCollection<Allergy>(childSub(fid, cid, "allergies"), `allergies/${fid}/${cid}`);
}

export function useSeries(fid: string, cid: string) {
  return useCollection<VaccineSeries>(childSub(fid, cid, "vaccineSeries"), `series/${fid}/${cid}`);
}

export function useDoses(fid: string, cid: string) {
  const r = useCollection<VaccineDose>(childSub(fid, cid, "vaccineDoses"), `doses/${fid}/${cid}`);
  const data = useMemo(() => [...r.data].sort((a, b) => a.doseNo - b.doseNo), [r.data]);
  return { ...r, data };
}

export function useOpenAppointments(fid: string) {
  return useCollection<Appointment>(query(appointmentsCol(fid), where("done", "==", false)), `appts/${fid}`);
}

/** เข็มที่ยังไม่ฉีดของลูกทุกคน (query ต่อเด็ก 1 คน) */
export function usePendingDoses(fid: string, childIds: string[]) {
  const key = childIds.join(",");
  const [byChild, setByChild] = useState<Record<string, VaccineDose[]>>({});
  const [error, setError] = useState<FirestoreError | null>(null);
  useEffect(() => {
    setByChild({});
    setError(null);
    const unsubs = childIds.map((cid) =>
      onSnapshot(
        query(childSub(fid, cid, "vaccineDoses"), where("given", "==", false)),
        (snap) => {
          setError(null);
          setByChild((m) => ({ ...m, [cid]: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as VaccineDose) }));
        },
        setError,
      ),
    );
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fid, key]);
  const data = useMemo(() => Object.values(byChild).flat(), [byChild]);
  return { data, error };
}
