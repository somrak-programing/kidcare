import type { FirestoreError } from "firebase/firestore";
import { Link } from "react-router-dom";

export default function ErrorState({ error }: { error: FirestoreError }) {
  const denied = error.code === "permission-denied";
  return (
    <div className="rounded-lg border border-destructive/50 p-4 text-sm">
      <p className="font-semibold">{denied ? "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้" : "โหลดข้อมูลไม่สำเร็จ"}</p>
      <p className="text-muted-foreground">{error.code}</p>
      <Link to="/" className="mt-2 inline-block underline">กลับหน้าแรก</Link>
    </div>
  );
}
