import { useMemo } from "react";
import { Search, RotateCcw, User, Calendar, Stethoscope, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AppointmentFilters,
  DISEASE_CATEGORIES,
  getFilterOptions,
} from "@/domain/appointmentFilters";
import { diffDays, todayISO } from "@/domain/dates";
import { DUE_SOON_DAYS } from "@/domain/doseStatus";
import type { UpcomingItem } from "@/domain/upcoming";
import type { Child } from "@/types";

interface AppointmentFilterBarProps {
  items: UpcomingItem[];
  kids: Child[];
  filters: AppointmentFilters;
  onFilterChange: (filters: AppointmentFilters) => void;
  onReset: () => void;
  filteredCount: number;
  totalCount: number;
}

export default function AppointmentFilterBar({
  items,
  kids,
  filters,
  onFilterChange,
  onReset,
  filteredCount,
  totalCount,
}: AppointmentFilterBarProps) {
  const today = todayISO();
  const { personOptions, monthOptions, diseaseOptions } = useMemo(
    () => getFilterOptions(items, kids),
    [items, kids],
  );

  const statusCounts = useMemo(() => {
    let overdue = 0;
    let soon = 0;
    let later = 0;
    for (const it of items) {
      const diff = diffDays(it.date, today);
      if (diff < 0) overdue++;
      else if (diff <= DUE_SOON_DAYS) soon++;
      else later++;
    }
    return { overdue, soon, later };
  }, [items, today]);

  const hasActiveFilters =
    filters.person !== "all" ||
    filters.month !== "all" ||
    filters.disease !== "all" ||
    filters.status !== "all" ||
    filters.search.trim() !== "";

  const activePersonLabel = useMemo(() => {
    if (filters.person === "all") return null;
    return personOptions.find((p) => p.value === filters.person)?.label || filters.person;
  }, [filters.person, personOptions]);

  const activeMonthLabel = useMemo(() => {
    if (filters.month === "all") return null;
    return monthOptions.find((m) => m.value === filters.month)?.label || filters.month;
  }, [filters.month, monthOptions]);

  const activeDiseaseLabel = useMemo(() => {
    if (filters.disease === "all") return null;
    return diseaseOptions.find((d) => d.value === filters.disease)?.label || filters.disease;
  }, [filters.disease, diseaseOptions]);

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs space-y-4">
      {/* 1. Search Bar & Status Pills */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่องาน, วัคซีน, โรงพยาบาล..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="pl-9 h-10 text-sm bg-secondary/30"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 text-xs"
              aria-label="ล้างคำค้นหา"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Quick Status Pills */}
        <div className="flex flex-wrap gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, status: "all" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filters.status === "all"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            ทั้งหมด ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, status: "overdue" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filters.status === "overdue"
                ? "bg-red-500 text-white shadow-xs"
                : "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            เลยกำหนด ({statusCounts.overdue})
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, status: "soon" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filters.status === "soon"
                ? "bg-amber-500 text-white shadow-xs"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            7 วันนี้ ({statusCounts.soon})
          </button>
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, status: "later" })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filters.status === "later"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            ถัดไป ({statusCounts.later})
          </button>
        </div>
      </div>

      {/* 2. Main Dropdown Filters (Person, Month, Disease) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/60">
        {/* รายคน (By Person) */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground/80">
            <User className="h-3.5 w-3.5 text-primary" />
            รายคน (สมาชิกในบ้าน)
          </Label>
          <Select
            value={filters.person}
            onValueChange={(val) => onFilterChange({ ...filters, person: val })}
          >
            <SelectTrigger className="h-10 text-xs bg-secondary/40">
              <SelectValue placeholder="ทุกคนในบ้าน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">👨‍👩‍👧‍👦 ทุกคนในบ้าน ({totalCount})</SelectItem>
              {personOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label} ({p.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* รายเดือน (By Month/Year) */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground/80">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            รายเดือน (เดือนที่นัดหมาย)
          </Label>
          <Select
            value={filters.month}
            onValueChange={(val) => onFilterChange({ ...filters, month: val })}
          >
            <SelectTrigger className="h-10 text-xs bg-secondary/40">
              <SelectValue placeholder="ทุกเดือน (ทั้งหมด)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🗓️ ทุกเดือน (ทั้งหมด)</SelectItem>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label} ({m.count} นัด)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* รายโรคภัย (By Disease / Vaccine) */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5 text-foreground/80">
            <Stethoscope className="h-3.5 w-3.5 text-primary" />
            รายโรคภัย / วัคซีน
          </Label>
          <Select
            value={filters.disease}
            onValueChange={(val) => onFilterChange({ ...filters, disease: val })}
          >
            <SelectTrigger className="h-10 text-xs bg-secondary/40">
              <SelectValue placeholder="ทุกโรคภัย / วัคซีน" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🩺 ทุกโรคภัย / วัคซีน ({totalCount})</SelectItem>
              {diseaseOptions.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label} ({d.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 3. Active Filters & Count Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-1.5">
          <span>พบ <strong className="text-foreground">{filteredCount}</strong> จากทั้งหมด {totalCount} รายการ</span>
          {activePersonLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
              {activePersonLabel}
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, person: "all" })}
                className="hover:text-primary/70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {activeMonthLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
              {activeMonthLabel}
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, month: "all" })}
                className="hover:text-primary/70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {activeDiseaseLabel && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
              {activeDiseaseLabel}
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, disease: "all" })}
                className="hover:text-primary/70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.status !== "all" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
              สถานะ: {filters.status === "overdue" ? "เลยกำหนด" : filters.status === "soon" ? "7 วันนี้" : "ถัดไป"}
              <button
                type="button"
                onClick={() => onFilterChange({ ...filters, status: "all" })}
                className="hover:text-primary/70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
          >
            <RotateCcw className="h-3 w-3 mr-1" /> ล้างตัวกรองทั้งหมด
          </Button>
        )}
      </div>
    </div>
  );
}
