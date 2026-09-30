import { useEffect } from "react";
import { create } from "zustand";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useFamilyStore } from "@/hooks/useFamilyId";

interface AuthState {
  user: User | null;
  loading: boolean;
  set: (u: User | null) => void;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  set: (user) => set({ user, loading: false }),
}));

let initialized = false;
let prevUid: string | null | undefined;

export function useAuth() {
  const { user, loading, set } = useAuthStore();
  useEffect(() => {
    if (initialized) return;
    initialized = true;
    onAuthStateChanged(auth, (u) => {
      const uid = u?.uid ?? null;
      if (uid !== prevUid) {
        useFamilyStore.getState().setFamilyId(null);
        prevUid = uid;
      }
      set(u);
    });
  }, [set]);
  return { user, loading };
}
