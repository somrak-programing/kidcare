import { create } from "zustand";

interface FamilyState {
  familyId: string | null;
  setFamilyId: (id: string | null) => void;
}

export const useFamilyStore = create<FamilyState>((set) => ({
  familyId: null,
  setFamilyId: (familyId) => set({ familyId }),
}));

/** ใช้ได้เฉพาะภายใต้ <RequireFamily> */
export function useFamilyId(): string {
  const id = useFamilyStore((s) => s.familyId);
  if (!id) throw new Error("useFamilyId used outside <RequireFamily>");
  return id;
}

export const familyCacheKey = (uid: string) => `kidcare.familyId.${uid}`;

export function writeFamilyCache(uid: string, id: string | null) {
  try {
    if (id) localStorage.setItem(familyCacheKey(uid), id);
    else localStorage.removeItem(familyCacheKey(uid));
  } catch {
    /* private mode / ignore */
  }
}
