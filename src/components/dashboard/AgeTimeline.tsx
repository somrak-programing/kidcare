import { useCallback, useRef, useState } from "react";
import type { AgeTimelineData, TimelineStatus } from "@/domain/dashboard";
import { formatThaiDate } from "@/domain/dates";
import { useDismissOnOutside } from "./useDismiss";

interface Row {
  id: string;
  name: string;
  data: AgeTimelineData;
}

const W = 360;
const X0 = 60;
const X_END = W - 12;
const ROW_H = 40;
const TOP = 4;
const BOTTOM = 24;
const GIVEN = "#0ca30c";
const OVERDUE = "#d03b3b";
const UPCOMING = "#6b7280";
const STATUS_TEXT: Record<TimelineStatus, string> = { given: "ฉีดแล้ว", overdue: "เลยกำหนด", upcoming: "ยังไม่ถึงวัย" };
const RING = "hsl(var(--card))";

const shortName = (n: string) => (n.length > 8 ? `${n.slice(0, 8)}…` : n);
const tickLabel = (m: number) => (m === 0 ? "แรกเกิด" : `${m / 12} ปี`);

function LegendIcon({ kind }: { kind: "given" | "overdue" | "upcoming" | "today" }) {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
      {kind === "given" && <circle cx={6} cy={6} r={5} fill={GIVEN} />}
      {kind === "overdue" && <rect x={2.3} y={2.3} width={7.4} height={7.4} transform="rotate(45 6 6)" fill={OVERDUE} />}
      {kind === "upcoming" && <circle cx={6} cy={6} r={4} fill="none" stroke={UPCOMING} strokeWidth={2} />}
      {kind === "today" && <line x1={6} x2={6} y1={0} y2={12} stroke="currentColor" strokeWidth={2} />}
    </svg>
  );
}

export function AgeTimeline({ rows }: { rows: Row[] }) {
  const [active, setActive] = useState<{ rowId: string; doseId: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const clear = useCallback(() => setActive(null), []);
  useDismissOnOutside(ref, clear, active !== null);

  const maxAge = Math.max(12, ...rows.map((r) => r.data.maxAgeMonths));
  const H = TOP + rows.length * ROW_H + BOTTOM;
  const x = (age: number) => X0 + (Math.min(Math.max(age, 0), maxAge) / maxAge) * (X_END - X0);
  const rowY = (i: number) => TOP + i * ROW_H + ROW_H / 2;
  const ticks = Array.from({ length: Math.floor(maxAge / 12) + 1 }, (_, i) => i * 12);

  let tip: { left: number; top: number; text: string } | null = null;
  if (active) {
    const ri = rows.findIndex((r) => r.id === active.rowId);
    const p = ri >= 0 ? rows[ri].data.points.find((q) => q.doseId === active.doseId) : undefined;
    if (p) {
      tip = {
        left: Math.min(85, Math.max(15, (x(p.ageMonths) / W) * 100)),
        top: (rowY(ri) / H) * 100,
        text: `${p.label} · ${formatThaiDate(p.date)} · ${STATUS_TEXT[p.status]}`,
      };
    }
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <h3 className="text-sm font-semibold">ไทม์ไลน์วัคซีนตามอายุ</h3>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <LegendIcon kind="given" />
          ฉีดแล้ว
        </span>
        <span className="flex items-center gap-1">
          <LegendIcon kind="overdue" />
          เลยกำหนด
        </span>
        <span className="flex items-center gap-1">
          <LegendIcon kind="upcoming" />
          ยังไม่ถึงวัย
        </span>
        <span className="flex items-center gap-1">
          <LegendIcon kind="today" />
          อายุวันนี้
        </span>
      </div>
      <div ref={ref} className="relative mt-2">
        {tip && (
          <div
            className="pointer-events-none absolute z-10 max-w-[90%] -translate-x-1/2 -translate-y-full rounded-md border bg-card px-2 py-1 text-xs text-foreground shadow-md"
            style={{ left: `${tip.left}%`, top: `calc(${tip.top}% - 12px)` }}
          >
            {tip.text}
          </div>
        )}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className="block"
          role="img"
          aria-label={`ไทม์ไลน์วัคซีนของลูก ${rows.length} คน`}
        >
          {rows.map((r, i) => {
            const cy = rowY(i);
            return (
              <g key={r.id}>
                <text x={0} y={cy + 4} fontSize={11} fill="currentColor">
                  {shortName(r.name)}
                </text>
                <line x1={X0} x2={X_END} y1={cy} y2={cy} stroke="currentColor" opacity={0.15} strokeWidth={2} strokeLinecap="round" />
                {r.data.points.length === 0 && (
                  <g className="text-muted-foreground">
                    <text x={X0 + 4} y={cy + 4} fontSize={10} fill="currentColor">
                      ยังไม่มีข้อมูลวัคซีน
                    </text>
                  </g>
                )}
                <line
                  x1={x(r.data.todayAgeMonths)}
                  x2={x(r.data.todayAgeMonths)}
                  y1={cy - 12}
                  y2={cy + 12}
                  stroke="currentColor"
                  strokeWidth={2}
                />
                {r.data.points.map((p) => {
                  const cx = x(p.ageMonths);
                  const select = () => setActive({ rowId: r.id, doseId: p.doseId });
                  return (
                    <g key={p.doseId}>
                      {p.status === "given" && <circle cx={cx} cy={cy} r={5} fill={GIVEN} stroke={RING} strokeWidth={1.5} />}
                      {p.status === "overdue" && (
                        <rect
                          x={-4}
                          y={-4}
                          width={8}
                          height={8}
                          transform={`translate(${cx} ${cy}) rotate(45)`}
                          fill={OVERDUE}
                          stroke={RING}
                          strokeWidth={1.5}
                        />
                      )}
                      {p.status === "upcoming" && <circle cx={cx} cy={cy} r={5} fill="none" stroke={UPCOMING} strokeWidth={2} />}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={12}
                        fill="transparent"
                        tabIndex={0}
                        className="outline-none focus-visible:stroke-foreground"
                        strokeWidth={1.5}
                        aria-label={`${r.name}: ${p.label} ${formatThaiDate(p.date)} ${STATUS_TEXT[p.status]}`}
                        onMouseEnter={select}
                        onMouseLeave={clear}
                        onPointerDown={select}
                        onFocus={select}
                        onBlur={clear}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
          <g className="text-muted-foreground">
            {ticks.map((m) => (
              <text
                key={m}
                x={x(m)}
                y={H - 8}
                fontSize={10}
                fill="currentColor"
                textAnchor={m === 0 ? "start" : m === maxAge ? "end" : "middle"}
              >
                {tickLabel(m)}
              </text>
            ))}
          </g>
        </svg>
      </div>
      <table className="sr-only">
        <thead>
          <tr>
            <th>ลูก</th>
            <th>วัคซีน</th>
            <th>วันที่</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((r) =>
            r.data.points.map((p) => (
              <tr key={`${r.id}-${p.doseId}`}>
                <td>{r.name}</td>
                <td>{p.label}</td>
                <td>{formatThaiDate(p.date)}</td>
                <td>{STATUS_TEXT[p.status]}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}
