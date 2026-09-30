import { browserLocalPersistence, setPersistence, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "./firebase";

setPersistence(auth, browserLocalPersistence).catch(() => {});

export async function loginGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export const logout = () => signOut(auth);
