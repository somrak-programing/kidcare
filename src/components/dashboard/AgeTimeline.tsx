import { useCallback, useRef, useState, type CSSProperties } from "react";
import type { AgeTimelineData, TimelineStatus } from "@/domain/dashboard";
import { formatThaiDate } from "@/domain/dates";
import { useDismissOnOutside } from "./useDismiss";
import { BarChart3, List } from "lucide-react";

interface Row {
  id: string;
  name: string;
  data: AgeTimelineData;
  hasDoses?: boolean;
}

const W = 720;
const X0 = 90;
const X_END = W - 20;
const ROW_H = 88;
const TOP = 16;
const BOTTOM = 36;
const GROUP_GAP = 0.75;
const MIN_TICK_SPACING = 50;
const GIVEN = "#10b981";
const OVERDUE = "#ef4444";
const UPCOMING = "#64748b";
const STATUS_TEXT: Record<TimelineStatus, string> = {
  given: "ฉีดแล้ว",
  overdue: "เลยกำหนด",
  upcoming: "ยังไม่ถึงวัย",
};
const RING = "hsl(var(--card))";

type Point = AgeTimelineData["points"][number];

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
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      {kind === "given" && <circle cx={7} cy={7} r={5.5} fill={GIVEN} stroke={RING} strokeWidth={1.5} />}
      {kind === "overdue" && (
        <rect x={2.5} y={2.5} width={8} height={8} transform="rotate(45 7 7)" fill={OVERDUE} stroke={RING} strokeWidth={1.5} />
      )}
      {kind === "upcoming" && (
        <circle cx={7} cy={7} r={5.5} fill="hsl(var(--card))" stroke={UPCOMING} strokeWidth={2.5} />
      )}
      {kind === "today" && <line x1={7} x2={7} y1={1} y2={13} stroke="currentColor" strokeWidth={2} strokeDasharray="2 2" />}
    </svg>
  );
}

export function AgeTimeline({ rows }: { rows: Row[] }) {
  const [active, setActive] = useState<{ rowId: string; key: string } | null>(null);
  const [viewMode, setViewMode] = useState<"timeline" | "table">("timeline");
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

  const chartLabel = `ไทม์ไลน์วัคซีนของลูก ${rows.length} คน`;

  let tip: { style: CSSProperties; points: Point[]; below: boolean } | null = null;
  if (active) {
    const ri = rows.findIndex((r) => r.id === active.rowId);
    const g = ri >= 0 ? groupsByRow[ri].find((q) => q[0].doseId === active.key) : undefined;
    if (g) {
      const xPct = (groupX(g) / W) * 100;
      const below = ri === 0;
      const rowPct = (rowY(ri) / H) * 100;
      const style: CSSProperties = { top: below ? `calc(${rowPct}% + 28px)` : `calc(${rowPct}% - 28px)` };
      if (xPct < 35) style.left = `${Math.max(xPct, 5)}%`;
      else if (xPct > 65) style.right = `${Math.max(100 - xPct, 5)}%`;
      else {
        style.left = `${xPct}%`;
        style.transform = "translateX(-50%)";
      }
      tip = { style, points: g, below };
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
        <div>
          <h3 className="font-bold text-base">ไทม์ไลน์วัคซีนตามอายุ</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            แสดงการรับวัคซีนเทียบกับช่วงอายุตั้งแต่แรกเกิดถึง 5 ปี
          </p>
        </div>
        <div className="flex items-center gap-1 self-start sm:self-center bg-secondary/80 p-0.5 rounded-lg border text-xs">
          <button
            type="button"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
              viewMode === "timeline" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setViewMode("timeline")}
          >
            <BarChart3 size={13} /> ไทม์ไลน์
          </button>
          <button
            type="button"
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
              viewMode === "table" ? "bg-background text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setViewMode("table")}
          >
            <List size={13} /> รายการสรุป
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <LegendIcon kind="given" />
          ฉีดแล้ว
        </span>
        <span className="flex items-center gap-1.5">
          <LegendIcon kind="overdue" />
          เลยกำหนด
        </span>
        <span className="flex items-center gap-1.5">
          <LegendIcon kind="upcoming" />
          ยังไม่ถึงวัย
        </span>
        <span className="flex items-center gap-1.5">
          <LegendIcon kind="today" />
          อายุวันนี้
        </span>
      </div>

      {viewMode === "timeline" ? (
        <div ref={ref} className="relative mt-2 overflow-x-auto">
          {tip && (
            <div
              className={`pointer-events-none absolute z-20 min-w-[200px] max-w-[90%] ${
                tip.below ? "" : "-translate-y-full"
              } rounded-xl border bg-card/95 backdrop-blur-md p-3 text-xs text-foreground shadow-xl`}
              style={tip.style}
            >
              <div className="font-bold border-b pb-1.5 mb-1.5 text-muted-foreground">
                วัคซีน ณ ช่วงอายุนี้ ({tip.points.length} เข็ม)
              </div>
              <div className="space-y-1.5">
                {tip.points.map((p) => {
                  const statusColor =
                    p.status === "given"
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                      : p.status === "overdue"
                      ? "text-rose-400 bg-rose-500/10 border-rose-500/30"
                      : "text-muted-foreground bg-muted border-border";
                  return (
                    <div key={p.doseId} className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{p.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${statusColor}`}>
                        {STATUS_TEXT[p.status]}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground pt-1.5 mt-1 border-t">
                {formatThaiDate(tip.points[0].date)}
              </p>
            </div>
          )}

          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            className="block select-none"
            role="group"
            aria-label={chartLabel}
          >
            {rows.map((r, i) => {
              const cy = rowY(i);
              return (
                <g key={r.id}>
                  {/* Child Name */}
                  <text
                    x={8}
                    y={cy + 4}
                    fontSize={13}
                    fontWeight="600"
                    fill="currentColor"
                    className="text-foreground"
                  >
                    {r.name}
                  </text>

                  {/* Horizontal Axis Bar */}
                  <line
                    x1={X0}
                    x2={X_END}
                    y1={cy}
                    y2={cy}
                    stroke="currentColor"
                    opacity={0.12}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />

                  {/* Empty state or Today Age Line */}
                  {r.data.points.length === 0 ? (
                    <g className="text-muted-foreground">
                      <text x={X0 + 10} y={cy + 4} fontSize={12} fill="currentColor">
                        {r.hasDoses ? "ไม่มีวันที่ให้แสดง" : "ยังไม่มีข้อมูลวัคซีน"}
                      </text>
                    </g>
                  ) : (
                    <line
                      x1={x(r.data.todayAgeMonths)}
                      x2={x(r.data.todayAgeMonths)}
                      y1={cy - 34}
                      y2={cy + 34}
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      opacity={0.7}
                    />
                  )}

                  {/* Vaccine Milestone Groups */}
                  {groupsByRow[i].map((g) => {
                    const n = g.length;
                    const gx = groupX(g);
                    // เรียง: given -> overdue -> upcoming
                    const order: Record<TimelineStatus, number> = { given: 1, overdue: 2, upcoming: 3 };
                    const sorted = [...g].sort((a, b) => (order[a.status] || 0) - (order[b.status] || 0));

                    // คำนวณระยะห่างแนวตั้ง: ขั้นต่ำ 15px เพื่อไม่ให้ทับกันเด็ดขาด
                    const spacing = Math.min(15, 60 / Math.max(n - 1, 1));
                    const startY = cy - ((n - 1) * spacing) / 2;

                    return (
                      <g key={`m-${g[0].doseId}`}>
                        {/* Connecting Pillar Line for multi-dose milestones */}
                        {n > 1 && (
                          <line
                            x1={gx}
                            x2={gx}
                            y1={startY}
                            y2={cy + ((n - 1) * spacing) / 2}
                            stroke="currentColor"
                            opacity={0.25}
                            strokeWidth={3}
                            strokeLinecap="round"
                          />
                        )}

                        {/* Distinct Stacked Markers */}
                        {sorted.map((p, j) => {
                          const my = n === 1 ? cy : startY + j * spacing;
                          return (
                            <g key={p.doseId}>
                              {p.status === "given" && (
                                <circle cx={gx} cy={my} r={5.5} fill={GIVEN} stroke={RING} strokeWidth={1.5} />
                              )}
                              {p.status === "overdue" && (
                                <rect
                                  x={-4.5}
                                  y={-4.5}
                                  width={9}
                                  height={9}
                                  transform={`translate(${gx} ${my}) rotate(45)`}
                                  fill={OVERDUE}
                                  stroke={RING}
                                  strokeWidth={1.5}
                                />
                              )}
                              {p.status === "upcoming" && (
                                <circle
                                  cx={gx}
                                  cy={my}
                                  r={5.5}
                                  fill="hsl(var(--card))"
                                  stroke={UPCOMING}
                                  strokeWidth={2.5}
                                />
                              )}
                            </g>
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Hit Target Pill for whole milestone stack */}
                  {groupsByRow[i].map((g) => {
                    const n = g.length;
                    const gx = groupX(g);
                    const spacing = Math.min(15, 60 / Math.max(n - 1, 1));
                    const totalHeight = n === 1 ? 24 : (n - 1) * spacing + 20;
                    const topY = n === 1 ? cy - 12 : cy - ((n - 1) * spacing) / 2 - 10;
                    const select = () => setActive({ rowId: r.id, key: g[0].doseId });

                    return (
                      <rect
                        key={`h-${g[0].doseId}`}
                        x={gx - 12}
                        y={topY}
                        width={24}
                        height={totalHeight}
                        rx={10}
                        fill="transparent"
                        tabIndex={0}
                        role="img"
                        className="outline-none hover:stroke-primary/50 focus-visible:stroke-foreground cursor-pointer transition-colors"
                        strokeWidth={1.5}
                        aria-label={`${r.name}: ${g.map((p) => `${p.label} ${formatThaiDate(p.date)} ${STATUS_TEXT[p.status]}`).join(", ")}`}
                        onMouseEnter={select}
                        onMouseLeave={clear}
                        onPointerDown={select}
                        onFocus={select}
                        onBlur={clear}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Time Axis Ticks */}
            <g className="text-muted-foreground">
              {ticks.map((m) => (
                <text
                  key={m}
                  x={x(m)}
                  y={H - 12}
                  fontSize={12}
                  fontWeight="500"
                  fill="currentColor"
                  textAnchor={m === 0 ? "start" : m === maxAge ? "end" : "middle"}
                >
                  {tickLabel(m)}
                </text>
              ))}
            </g>
          </svg>
        </div>
      ) : (
        /* Milestone Table View */
        <div className="space-y-4 pt-1">
          {rows.map((r) => {
            const groups = groupPoints(r.data.points);
            return (
              <div key={r.id} className="space-y-2.5 rounded-xl border bg-muted/10 p-3.5">
                <p className="font-bold text-sm text-foreground">{r.name}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {groups.map((g, idx) => {
                    const m = g[0].ageMonths;
                    const ageLabel = m === 0 ? "แรกเกิด" : m < 12 ? `${m} เดือน` : `${Math.floor(m / 12)} ปี ${m % 12 ? `${m % 12} ด.` : ""}`;
                    return (
                      <div key={idx} className="rounded-lg border bg-card p-2.5 space-y-1.5 text-xs shadow-2xs">
                        <div className="flex items-center justify-between font-semibold text-muted-foreground border-b pb-1">
                          <span>{ageLabel}</span>
                          <span className="text-[11px] font-normal">{formatThaiDate(g[0].date)}</span>
                        </div>
                        <ul className="space-y-1">
                          {g.map((p) => (
                            <li key={p.doseId} className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="truncate">{p.label}</span>
                              <span
                                className={`shrink-0 font-semibold px-1.5 py-0.2 rounded text-[10px] ${
                                  p.status === "given"
                                    ? "text-emerald-400 bg-emerald-500/15"
                                    : p.status === "overdue"
                                    ? "text-rose-400 bg-rose-500/15"
                                    : "text-muted-foreground bg-muted"
                                }`}
                              >
                                {STATUS_TEXT[p.status]}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Screen Reader Table */}
      <div className="sr-only">
        <table>
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
    </div>
  );
}
