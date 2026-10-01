import { Link, Outlet, useLocation } from "react-router-dom";
import { Calendar, CalendarPlus, HeartPulse, Home, Settings, WifiOff } from "lucide-react";
import InviteBanner from "@/components/InviteBanner";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/hooks/useOnline";
import { useFamilyId } from "@/hooks/useFamilyId";
import { useDocument } from "@/hooks/useCollection";
import { familyDoc } from "@/lib/paths";
import type { Family } from "@/types";

export default function Layout() {
  const online = useOnline();
  const fid = useFamilyId();
  const { data: family } = useDocument<Family>(familyDoc(fid), `family/${fid}`);
  const location = useLocation();

  const navLinks = [
    { name: "หน้าหลัก", to: "/", icon: Home, exact: true },
    { name: "นัดหมาย", to: "/appointments", icon: Calendar, exact: false },
    { name: "ตั้งค่า", to: "/settings", icon: Settings, exact: false },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 md:pb-10">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Family Name */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary transition-transform group-hover:scale-105">
                <HeartPulse size={20} />
              </div>
              <span className="text-lg font-bold tracking-tight">KidCare</span>
            </Link>
            {family?.name && (
              <span className="hidden sm:inline-flex items-center rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-xs text-muted-foreground">
                {family.name}
              </span>
            )}
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navLinks.map((item) => {
              const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-secondary text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  }`}
                >
                  <Icon size={16} className={active ? "text-primary" : ""} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {!online && (
              <span className="flex items-center gap-1 rounded-md bg-amber-500/20 px-2.5 py-1 text-xs text-amber-300">
                <WifiOff size={14} /> ออฟไลน์
              </span>
            )}
            <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex items-center gap-1.5 h-9 text-xs">
              <Link to="/appointments/new">
                <CalendarPlus size={14} /> นัดหมอ
              </Link>
            </Button>
            <Link
              to="/settings"
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground"
              aria-label="ตั้งค่า"
            >
              <Settings size={18} />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        <div className="space-y-4">
          <InviteBanner />
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-md px-6 py-2 flex items-center justify-around shadow-lg">
        {navLinks.map((item) => {
          const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 py-1 px-3 text-xs transition-colors ${
                active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={20} className={active ? "text-primary" : ""} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
