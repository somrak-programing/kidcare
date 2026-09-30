import { useEffect, useState } from "react";
import { onSnapshot, type DocumentReference, type FirestoreError, type Query } from "firebase/firestore";

export function useCollection<T>(q: Query | null, key: string) {
  const [state, setState] = useState<{ data: T[]; loading: boolean; error: FirestoreError | null }>({
    data: [],
    loading: q !== null,
    error: null,
  });
  useEffect(() => {
    if (!q) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState({ data: [], loading: true, error: null });
    return onSnapshot(
      q,
      (snap) => setState({ data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T), loading: false, error: null }),
      (error) => setState({ data: [], loading: false, error }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}

export function useDocument<T>(ref: DocumentReference | null, key: string) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: FirestoreError | null }>({
    data: null,
    loading: ref !== null,
    error: null,
  });
  useEffect(() => {
    if (!ref) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState({ data: null, loading: true, error: null });
    return onSnapshot(
      ref,
      (snap) => setState({ data: snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null, loading: false, error: null }),
      (error) => setState({ data: null, loading: false, error }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state;
}
