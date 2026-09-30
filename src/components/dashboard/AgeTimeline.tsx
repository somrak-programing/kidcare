import { useCallback, useRef, useState, type CSSProperties } from "react";
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
const BOTTOM = 26;
const GROUP_GAP = 0.75;
const MIN_TICK_SPACING = 30;
const GIVEN = "#0ca30c";
const OVERDUE = "#d03b3b";
const UPCOMING = "#6b7280";
const STATUS_TEXT: Record<TimelineStatus, string> = { given: "ฉีดแล้ว", overdue: "เลยกำหนด", upcoming: "ยังไม่ถึงวัย" };
const RING = "hsl(var(--card))";

type Point = AgeTimelineData["points"][number];

const shortName = (n: string) => {
  const chars = Array.from(n);
  return chars.length > 7 ? `${chars.slice(0, 7).join("")}…` : n;
};

/** Group same-row points whose ages are within GROUP_GAP months of the group's first point. */
function groupPoints(points: Point[]): Point[][] {
  const sorted = [...points].sort((a, b) => a.ageMonths - b.ageMonths);
  const groups: Point[][] = [];
  for (const p of sorted) {
    const g = groups[groups.length - 1];
    if (g && p.ageMonths - g[0].ageMonths <= GROUP_GAP) g.push(p);
    else groups.push([p]);
  }
  return groups;
}
const tickLabel = (m: number) => (m === 0 ? "แรกเกิด" : `${m / 12} ปี`);

function LegendIcon({ kind }: { kind: "given" | "overdue" | "upcoming" | "today" }) {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
      {kind === "given" && <circle cx={6} cy={6} r={5} fill={GIVEN} />}
      {kind === "overdue" && <rect x={2.3} y={2.3} width={7.4} height={7.4} transform="rotate(45 6 6)" fill={OVERDUE} />}
      {kind === "upcoming" && <circle cx={6} cy={6} r={5} fill="none" stroke={UPCOMING} strokeWidth={2} />}
      {kind === "today" && <line x1={6} x2={6} y1={0} y2={12} stroke="currentColor" strokeWidth={2} />}
    </svg>
  );
}

export function AgeTimeline({ rows }: { rows: Row[] }) {
  const [active, setActive] = useState<{ rowId: string; key: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const clear = useCallback(() => setActive(null), []);
  useDismissOnOutside(ref, clear, active !== null);

  const maxAge = Math.max(12, ...rows.map((r) => r.data.maxAgeMonths));
  const H = TOP + rows.length * ROW_H + BOTTOM;
  const x = (age: number) => X0 + (Math.min(Math.max(age, 0), maxAge) / maxAge) * (X_END - X0);
  const rowY = (i: number) => TOP + i * ROW_H + ROW_H / 2;
  const tickStep = (12 / maxAge) * (X_END - X0) < MIN_TICK_SPACING ? 24 : 12;
  const ticks = Array.from({ length: Math.floor(maxAge / tickStep) + 1 }, (_, i) => i * tickStep);
  const groupsByRow = rows.map((r) => groupPoints(r.data.points));
  const groupX = (g: Point[]) => g.reduce((s, p) => s + x(p.ageMonths), 0) / g.length;
  const doseText = (p: Point) => `${p.label} · ${formatThaiDate(p.date)} · ${STATUS_TEXT[p.status]}`;
  const chartLabel = `ไทม์ไลน์วัคซีนของลูก ${rows.length} คน`;

  let tip: { style: CSSProperties; lines: string[] } | null = null;
  if (active) {
    const ri = rows.findIndex((r) => r.id === active.rowId);
    const g = ri >= 0 ? groupsByRow[ri].find((q) => q[0].doseId === active.key) : undefined;
    if (g) {
      const xPct = (groupX(g) / W) * 100;
      const style: CSSProperties = { top: `calc(${(rowY(ri) / H) * 100}% - 16px)` };
      if (xPct < 50) style.left = `${xPct}%`;
      else style.right = `${100 - xPct}%`;
      tip = { style, lines: g.map(doseText) };
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
            className="pointer-events-none absolute z-10 max-w-[70%] -translate-y-full rounded-md border bg-card px-2 py-1 text-xs text-foreground shadow-md"
            style={tip.style}
          >
            {tip.lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        )}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className="block"
          role="group"
          aria-label={chartLabel}
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
                    <text x={X0 + 4} y={cy + 4} fontSize={11} fill="currentColor">
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
                {groupsByRow[i].map((g) => {
                  const select = () => setActive({ rowId: r.id, key: g[0].doseId });
                  const n = g.length;
                  return (
                    <g key={g[0].doseId}>
                      {g.map((p, j) => {
                        const cx = x(p.ageMonths);
                        const my = cy + (n > 1 ? -4 + (8 * j) / (n - 1) : 0);
                        return (
                          <g key={p.doseId}>
                            {p.status === "given" && <circle cx={cx} cy={my} r={5} fill={GIVEN} stroke={RING} strokeWidth={1.5} />}
                            {p.status === "overdue" && (
                              <rect
                                x={-4}
                                y={-4}
                                width={8}
                                height={8}
                                transform={`translate(${cx} ${my}) rotate(45)`}
                                fill={OVERDUE}
                                stroke={RING}
                                strokeWidth={1.5}
                              />
                            )}
                            {p.status === "upcoming" && <circle cx={cx} cy={my} r={5} fill="none" stroke={UPCOMING} strokeWidth={2} />}
                          </g>
                        );
                      })}
                      <circle
                        cx={groupX(g)}
                        cy={cy}
                        r={14}
                        fill="transparent"
                        tabIndex={0}
                        className="outline-none focus-visible:stroke-foreground"
                        strokeWidth={1.5}
                        aria-label={`${r.name}: ${g.map((p) => `${p.label} ${formatThaiDate(p.date)} ${STATUS_TEXT[p.status]}`).join(", ")}`}
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
                y={H - 9}
                fontSize={11}
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
        <caption>{chartLabel}</caption>
        <thead>
          <tr>
            <th scope="col">ลูก</th>
            <th scope="col">วัคซีน</th>
            <th scope="col">วันที่</th>
            <th scope="col">สถานะ</th>
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
