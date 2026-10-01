import { Link, Outlet } from "react-router-dom";
import { Settings, WifiOff } from "lucide-react";
import InviteBanner from "@/components/InviteBanner";
import { useOnline } from "@/hooks/useOnline";

export default function Layout() {
  const online = useOnline();
  return (
    <div className="mx-auto min-h-screen max-w-lg pb-16">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/" className="text-lg font-bold">KidCare</Link>
        <div className="flex items-center gap-3">
          {!online && (
            <span className="flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
              <WifiOff size={14} /> ออฟไลน์ — รอซิงก์
            </span>
          )}
          <Link to="/settings" aria-label="ตั้งค่า"><Settings size={20} /></Link>
        </div>
      </header>
      <main className="space-y-4 px-4 py-4">
        <InviteBanner />
        <Outlet />
      </main>
    </div>
  );
}
